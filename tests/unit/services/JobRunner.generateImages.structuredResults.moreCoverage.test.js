import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const mockProducePictureModule = { producePictureModule: vi.fn() };

const installCjsMocks = () => {
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: mockProducePictureModule };

  const paramsId = require.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  require.cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: { paramsGeneratorModule: vi.fn() } };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = { id: aiVisionId, filename: aiVisionId, loaded: true, exports: {} };

  const sutId = require.resolve('../../../src/services/jobRunner.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/services/jobRunner.js').JobRunner;
};

describe('JobRunner.generateImages (structured result + QC-first config)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProducePictureModule.producePictureModule.mockReset();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('maps structured { processedImages } results into JobRunner image objects and updates jobState counts', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce({
      processedImages: [
        {
          outputPath: '/tmp/out.png',
          mappingId: 'm1',
          settings: { title: { title: 'T', description: 'D' }, uploadTags: ['x'] },
        },
      ],
      failedItems: [],
    });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { tempDirectory: path.join(os.tmpdir(), 'jr-tmp') },
      parameters: {
        processMode: 'single',
        variations: 1,
        enablePollingTimeout: false,
        count: 1,
        runwareAdvancedEnabled: false,
        runwareAdvanced: { CFGScale: 7 },
      },
      processing: { removeBg: true, imageConvert: true, convertToJpg: true },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    const parameters = { prompt: 'P', promptContext: 'C', aspectRatios: ['1:1'] };

    const images = await runner.generateImages(config, parameters);

    expect(images).toHaveLength(1);
    expect(images[0]).toEqual(
      expect.objectContaining({
        path: '/tmp/out.png',
        status: 'generated',
        aspectRatio: '1:1',
        mappingId: 'm1',
        metadata: expect.objectContaining({ prompt: 'P', title: 'T', description: 'D', uploadTags: ['x'] }),
      }),
    );

    expect(runner.jobState.totalImages).toBeGreaterThan(0);
    expect(runner.jobState.generatedImages).toBeGreaterThan(0);
  });

  it('QC-first: when runQualityCheck=true, processing flags are disabled in moduleConfig and LoRA is preserved from advanced when advanced toggle is off', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: '/tmp/out.png', mappingId: 'm1', settings: {} },
    ]);

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { tempDirectory: path.join(os.tmpdir(), 'jr-tmp') },
      parameters: {
        processMode: 'single',
        variations: 1,
        enablePollingTimeout: false,
        count: 1,
        runwareAdvancedEnabled: false,
        runwareAdvanced: { lora: [{ model: 'lora-1', weight: 0.8 }], CFGScale: 7 },
      },
      processing: { removeBg: true, imageConvert: true, convertToWebp: true, trimTransparentBackground: true },
      ai: { runQualityCheck: true, runMetadataGen: false },
      __abortSignal: { aborted: false },
    };

    const parameters = { prompt: 'P', promptContext: 'C', aspectRatios: ['1:1', '16:9'] };

    await runner.generateImages(config, parameters);

    expect(mockProducePictureModule.producePictureModule).toHaveBeenCalledTimes(1);

    const [settingsArg, _imgNameBase, _customMetaPrompt, moduleConfigArg] = mockProducePictureModule.producePictureModule.mock.calls[0];

    // advanced toggle off: advanced cleared, but LoRA lifted
    expect(settingsArg.parameters.runwareAdvancedEnabled).toBe(false);
    expect(settingsArg.parameters.runwareAdvanced).toEqual({});
    expect(settingsArg.parameters.lora).toEqual([{ model: 'lora-1', weight: 0.8 }]);

    // QC-first disables processing in moduleConfig
    expect(moduleConfigArg.removeBg).toBe(false);
    expect(moduleConfigArg.imageConvert).toBe(false);
    expect(moduleConfigArg.convertToJpg).toBe(false);
    expect(moduleConfigArg.trimTransparentBackground).toBe(false);

    // Abort signal passed through
    expect(moduleConfigArg.abortSignal).toBe(config.__abortSignal);
  });
});
