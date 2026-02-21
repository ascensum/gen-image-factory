import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, require.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
  originalCache.clear();
};

const mockParamsGeneratorModule = {
  paramsGeneratorModule: vi.fn(),
};

const installCjsMocks = () => {
  const paramsId = require.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  require.cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: mockParamsGeneratorModule };

  // Keep other deps inert
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: {} };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = { id: aiVisionId, filename: aiVisionId, loaded: true, exports: {} };

  const sutId = require.resolve('../../../src/services/jobRunner.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  return require('../../../src/services/jobRunner.js').JobRunner;
};

describe('JobRunner.generateParameters (keywords/systemPrompt/aspectRatios)', () => {
  let tmpRoot;

  beforeEach(() => {
    vi.clearAllMocks();
    mockParamsGeneratorModule.paramsGeneratorModule.mockReset();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-params-'));

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('parses CSV keywords, reads systemPromptFile, normalizes aspectRatios string, and calls paramsGeneratorModule with correct signature', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();

    const keywordsFile = path.join(tmpRoot, 'keywords.csv');
    fs.writeFileSync(
      keywordsFile,
      [
        '"food","style"',
        '"pizza","bold"',
        '"sushi","soft"',
      ].join('\n'),
      'utf8',
    );

    const systemPromptFile = path.join(tmpRoot, 'system.txt');
    fs.writeFileSync(systemPromptFile, 'SYSTEM_PROMPT', 'utf8');

    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValue({ prompt: 'P', promptContext: 'C' });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { keywordsFile, systemPromptFile },
      parameters: {
        keywordRandom: false,
        aspectRatios: '16:9, 1:1',
        mjVersion: '6.1',
        openaiModel: 'gpt-4o-mini',
      },
      __perGen: true,
      __forceSequentialIndex: 1, // pick second data row (sushi)
      __abortSignal: { aborted: false },
    };

    const res = await runner.generateParameters(config);

    expect(mockParamsGeneratorModule.paramsGeneratorModule).toHaveBeenCalledTimes(1);
    const [keywordsArg, systemPromptArg, keywordFilePathArg, optionsArg] = mockParamsGeneratorModule.paramsGeneratorModule.mock.calls[0];

    expect(keywordsArg).toEqual({ food: 'sushi', style: 'soft' });
    expect(systemPromptArg).toBe('SYSTEM_PROMPT');
    expect(keywordFilePathArg).toBe(null);
    expect(optionsArg).toEqual(
      expect.objectContaining({
        mjVersion: '6.1',
        appendMjVersion: false,
        openaiModel: 'gpt-4o-mini',
        signal: config.__abortSignal,
      }),
    );

    expect(res).toEqual(
      expect.objectContaining({
        prompt: 'P',
        promptContext: 'C',
        aspectRatios: ['16:9', '1:1'],
      }),
    );
  });

  it('falls back to defaults when keyword/systemPrompt files cannot be read', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();

    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValue({ prompt: 'P2', promptContext: '' });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { keywordsFile: path.join(tmpRoot, 'missing.txt'), systemPromptFile: path.join(tmpRoot, 'missing2.txt') },
      parameters: { aspectRatios: ['1:1'] },
    };

    const res = await runner.generateParameters(config);

    expect(mockParamsGeneratorModule.paramsGeneratorModule).toHaveBeenCalledTimes(1);
    const [keywordsArg, systemPromptArg] = mockParamsGeneratorModule.paramsGeneratorModule.mock.calls[0];

    expect(keywordsArg).toBe('default image');
    expect(systemPromptArg).toBe(null);
    expect(res).toHaveProperty('aspectRatios');
  });
});
