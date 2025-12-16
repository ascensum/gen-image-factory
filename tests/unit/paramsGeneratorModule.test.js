import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const mockCreateCompletion = vi.fn();

class FakeOpenAI {
  constructor() {
    this.chat = {
      completions: {
        create: mockCreateCompletion,
      },
    };
  }
}

const installCjsMocks = () => {
  // `src/paramsGeneratorModule.js` is CJS and uses `require("openai")`.
  // Vitest module mocking doesn't reliably intercept that path in this repo,
  // so we override the Node CJS require cache for this suite only.
  const openaiId = require.resolve('openai');
  require.cache[openaiId] = {
    id: openaiId,
    filename: openaiId,
    loaded: true,
    exports: { OpenAI: FakeOpenAI },
  };

  const logDebugId = require.resolve('../../src/utils/logDebug.js');
  require.cache[logDebugId] = {
    id: logDebugId,
    filename: logDebugId,
    loaded: true,
    exports: { logDebug: vi.fn() },
  };
};

const loadSut = () => {
  installCjsMocks();
  vi.resetModules();
  const sutId = require.resolve('../../src/paramsGeneratorModule.js');
  delete require.cache[sutId];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { paramsGeneratorModule } = require('../../src/paramsGeneratorModule.js');
  return paramsGeneratorModule;
};

describe('paramsGeneratorModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Also clear any queued `mockResolvedValueOnce` implementations between tests.
    mockCreateCompletion.mockReset();
  });

  it('generates prompt from CSV-templated system prompt and appends MJ version by default', async () => {
    const paramsGeneratorModule = loadSut();
    mockCreateCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: '{"prompt":"Stock photo of Cat on a Beach"}' } }],
    });

    const selectedRow = { Subject: 'Cat', Setting: 'Beach' };
    const template = 'Make a prompt for ${{Subject}} in a ${{Setting}}.';

    const result = await paramsGeneratorModule(selectedRow, template, '/tmp/keywords.csv', {
      openaiModel: 'gpt-4o-mini',
      mjVersion: '6',
      appendMjVersion: true,
    });

    expect(mockCreateCompletion).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Make a prompt for Cat in a Beach.' },
        { role: 'user', content: 'Generate one prompt now based on your instructions.' },
      ],
      temperature: 0.7,
    });

    expect(result).toEqual({
      prompt: 'Stock photo of Cat on a Beach --v 6',
      promptContext: 'Cat',
    });
  });

  it('throws in CSV mode when system prompt template is missing', async () => {
    const paramsGeneratorModule = loadSut();
    const selectedRow = { Subject: 'Dog', Setting: 'Park' };

    await expect(
      paramsGeneratorModule(selectedRow, '', '/tmp/keywords.csv', { openaiModel: 'gpt-4o-mini' }),
    ).rejects.toThrow('System prompt template is required for CSV mode');
  });

  it('processes TXT template placeholders and clears unused CSV placeholders', async () => {
    const paramsGeneratorModule = loadSut();
    mockCreateCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: '{"prompt":"Subject: Tree; Setting=; Mood=; Style=."}' } }],
    });

    const template = 'Subject: {keyword}; Setting=${{Setting}}; Mood=${{Mood}}; Style=${{Style}}.';

    const result = await paramsGeneratorModule(['Tree'], template, '/tmp/keywords.txt', {
      openaiModel: 'gpt-4o-mini',
      mjVersion: '6',
      appendMjVersion: false,
    });

    expect(mockCreateCompletion).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Subject: Tree; Setting=; Mood=; Style=.' },
        { role: 'user', content: 'Generate one prompt now based on your instructions.' },
      ],
      temperature: 0.7,
    });

    expect(result).toEqual({
      prompt: 'Subject: Tree; Setting=; Mood=; Style=.',
      promptContext: 'Tree',
    });
  });

  it('parses quoted-string responses and strips JSON code fences', async () => {
    const paramsGeneratorModule = loadSut();
    mockCreateCompletion
      .mockResolvedValueOnce({
        // Intentionally includes a raw newline so JSON.parse throws, exercising the
        // "quoted string" salvage branch in the implementation.
        choices: [{ message: { content: '"A single quoted\nprompt"' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '```json\n{"prompt":"Fenced prompt"}\n```' } }],
      });

    const r1 = await paramsGeneratorModule('Keyword', null, '/tmp/keywords.txt', {
      openaiModel: 'gpt-4o-mini',
      appendMjVersion: false,
    });

    expect(r1).toEqual({
      prompt: 'A single quoted\nprompt',
      promptContext: 'Keyword',
    });

    const r2 = await paramsGeneratorModule('Keyword', null, '/tmp/keywords.txt', {
      openaiModel: 'gpt-4o-mini',
      appendMjVersion: false,
    });

    expect(r2).toEqual({
      prompt: 'Fenced prompt',
      promptContext: 'Keyword',
    });
  });

  it('uses temperature=1 for gpt-5* models', async () => {
    const paramsGeneratorModule = loadSut();
    mockCreateCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: '{"prompt":"Hello"}' } }],
    });

    await paramsGeneratorModule('Kitten', null, '/tmp/keywords.txt', {
      openaiModel: 'gpt-5-mini',
      appendMjVersion: false,
    });

    expect(mockCreateCompletion).toHaveBeenCalledWith({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an assistant creating high-quality stock photo prompts for an AI image generator. Your response must be a single JSON object with one key: "prompt". The prompt should describe a stock photo image based on the provided keywords. The prompt must be in a single line and in English.',
        },
        { role: 'user', content: 'Create a prompt for this keyword: Kitten' },
      ],
      temperature: 1,
    });
  });
});

