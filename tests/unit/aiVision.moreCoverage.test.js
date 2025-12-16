import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, req.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) req.cache[id] = entry;
    else delete req.cache[id];
  }
  originalCache.clear();
};

describe('aiVision (runQualityCheck + generateMetadata)', () => {
  const mockCreate = vi.fn();
  const mockDefaultMetadataPrompt = vi.fn();

  let readFileSpy;

  const installCjsMocks = () => {
    // Mock openai CJS require
    const openaiId = req.resolve('openai');
    rememberCache(openaiId);
    req.cache[openaiId] = {
      id: openaiId,
      filename: openaiId,
      loaded: true,
      exports: {
        OpenAI: class OpenAI {
          constructor(_opts) {
            return {
              chat: { completions: { create: mockCreate } },
            };
          }
        },
      },
    };

    // Mock default prompts
    const qcPromptId = req.resolve('../../src/constant/defaultQualityCheckPrompt.js');
    rememberCache(qcPromptId);
    req.cache[qcPromptId] = { id: qcPromptId, filename: qcPromptId, loaded: true, exports: 'DEFAULT_QC_PROMPT' };

    const metaPromptId = req.resolve('../../src/constant/defaultMetadataPrompt.js');
    rememberCache(metaPromptId);
    req.cache[metaPromptId] = {
      id: metaPromptId,
      filename: metaPromptId,
      loaded: true,
      exports: (promptContext) => mockDefaultMetadataPrompt(promptContext),
    };

    const sutId = req.resolve('../../src/aiVision.js');
    rememberCache(sutId);
    delete req.cache[sutId];
  };

  const loadSut = () => {
    installCjsMocks();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return req('../../src/aiVision.js');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockDefaultMetadataPrompt.mockReset();

    process.env.OPENAI_API_KEY = 'sk-test';

    const fsMod = req('fs');
    readFileSpy = vi.spyOn(fsMod.promises, 'readFile').mockResolvedValue('BASE64');
  });

  afterEach(() => {
    readFileSpy?.mockRestore?.();
    delete process.env.OPENAI_API_KEY;
    restoreCache();
    vi.restoreAllMocks();
  });

  it('runQualityCheck parses JSON from fenced response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '```json\n{"passed":true,"reason":"ok"}\n```' } }],
    });

    const { runQualityCheck } = loadSut();

    const res = await runQualityCheck('/tmp/x.png', 'gpt-4o-mini', 'CUSTOM_QC_PROMPT');

    expect(res).toEqual({ passed: true, reason: 'ok' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: 'CUSTOM_QC_PROMPT' }),
        ]),
      }),
    );
  });

  it('runQualityCheck falls back when JSON parsing fails', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'passed: false; unable to analyze' } }],
    });

    const { runQualityCheck } = loadSut();

    const res = await runQualityCheck('/tmp/x.png', 'gpt-4o-mini');

    expect(res).toEqual(
      expect.objectContaining({
        passed: false,
        reason: expect.stringContaining('Raw response analysis:'),
      }),
    );
  });

  it('generateMetadata uses defaultMetadataPrompt(promptContext) when custom prompt is not provided', async () => {
    mockDefaultMetadataPrompt.mockReturnValueOnce('DEFAULT_META_PROMPT');

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"new_title":"T","new_description":"D","uploadTags":["x"]}' } }],
    });

    const { generateMetadata } = loadSut();

    const res = await generateMetadata('/tmp/x.png', 'CTX', null, 'gpt-4o-mini');

    expect(res).toEqual({ new_title: 'T', new_description: 'D', uploadTags: ['x'] });
    expect(mockDefaultMetadataPrompt).toHaveBeenCalledWith('CTX');
  });
});
