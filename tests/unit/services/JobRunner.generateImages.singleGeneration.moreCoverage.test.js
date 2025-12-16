import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const mockProduce = { producePictureModule: vi.fn() };
const installCjsMocks = () => {
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: mockProduce };

  const paramsId = require.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  require.cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: {} };

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
  return require('../../../src/services/jobRunner.js');
};

describe('JobRunner.generateImages (single-generation) - extra coverage', () => {
  let runner;
  let prevGlobalRunner;
  let JobRunner;
  let producePictureModule;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProduce.producePictureModule.mockReset();
    prevGlobalRunner = global.currentJobRunner;
    ({ JobRunner } = loadSut());
    producePictureModule = mockProduce;
    runner = new JobRunner({ parameters: { count: 1 } });
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('processes array result, cycles aspect ratios, and sanitizes runwareAdvanced when toggle is off', async () => {
    producePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: '/tmp/a.png', mappingId: 'm1', settings: { title: { title: 't1' }, uploadTags: ['x'] } },
      { outputPath: '/tmp/b.png', mappingId: 'm2', settings: { title: { description: 'd2' } } },
      { outputPath: '/tmp/c.png', mappingId: 'm3', settings: { title: { title: 't3', description: 'd3' }, uploadTags: ['y'] } },
    ]);

    const config = {
      apiKeys: { runware: 'rk' },
      filePaths: { tempDirectory: '/tmp/generated', outputDirectory: '/tmp/toupload' },
      parameters: {
        count: 1,
        processMode: 'batch',
        variations: 3,
        // advanced gate OFF → should clear runwareAdvanced but keep lora
        runwareAdvancedEnabled: false,
        runwareAdvanced: { steps: 123, lora: [{ id: 'l1' }] },
      },
      processing: { imageConvert: true, convertToJpg: true, removeBg: true, trimTransparentBackground: true, removeBgSize: 'full' },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    const parameters = {
      prompt: 'p',
      promptContext: 'ctx',
      aspectRatios: ['1:1', '16:9'],
    };

    const imgs = await runner.generateImages(config, parameters);

    expect(producePictureModule.producePictureModule).toHaveBeenCalledTimes(1);
    const settingsArg = producePictureModule.producePictureModule.mock.calls[0][0];
    expect(settingsArg.parameters.runwareAdvancedEnabled).toBe(false);
    expect(settingsArg.parameters.runwareAdvanced).toEqual({});
    expect(settingsArg.parameters.lora).toEqual([{ id: 'l1' }]);

    expect(imgs).toHaveLength(3);
    expect(imgs[0]).toEqual(expect.objectContaining({ mappingId: 'm1', aspectRatio: '1:1' }));
    expect(imgs[1]).toEqual(expect.objectContaining({ mappingId: 'm2', aspectRatio: '16:9' }));
    expect(imgs[2]).toEqual(expect.objectContaining({ mappingId: 'm3', aspectRatio: '1:1' }));
    expect(imgs[0].metadata).toEqual(expect.objectContaining({ prompt: 'p', title: 't1', uploadTags: ['x'] }));
  });

  it('handles structured result object with processedImages', async () => {
    producePictureModule.producePictureModule.mockResolvedValueOnce({
      processedImages: [{ outputPath: '/tmp/a.png', mappingId: 'm1', settings: { title: { title: 't' } } }],
      failedItems: [{ mappingId: 'f1', stage: 'convert' }],
    });

    const config = {
      apiKeys: { runware: 'rk' },
      filePaths: { tempDirectory: '/tmp/generated', outputDirectory: '/tmp/toupload' },
      parameters: { count: 1, processMode: 'single' },
      processing: {},
      ai: { runQualityCheck: false, runMetadataGen: false },
    };
    const parameters = { prompt: 'p', promptContext: 'ctx', aspectRatios: ['9:16'] };

    const imgs = await runner.generateImages(config, parameters);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toEqual(expect.objectContaining({ mappingId: 'm1', aspectRatio: '9:16' }));
  });

  it('handles fallback string result', async () => {
    producePictureModule.producePictureModule.mockResolvedValueOnce('/tmp/single.png');
    const config = {
      apiKeys: { runware: 'rk' },
      filePaths: { tempDirectory: '/tmp/generated', outputDirectory: '/tmp/toupload' },
      parameters: { count: 1, processMode: 'single' },
      processing: {},
      ai: { runQualityCheck: false, runMetadataGen: false },
    };
    const parameters = { prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] };
    const imgs = await runner.generateImages(config, parameters);
    expect(imgs).toEqual([
      expect.objectContaining({ path: '/tmp/single.png', status: 'generated', aspectRatio: '1:1' }),
    ]);
  });

  it('throws a wrapped error when module returns invalid format', async () => {
    producePictureModule.producePictureModule.mockResolvedValueOnce(null);
    const config = {
      apiKeys: { runware: 'rk' },
      filePaths: { tempDirectory: '/tmp/generated', outputDirectory: '/tmp/toupload' },
      parameters: { count: 1, processMode: 'single' },
      processing: {},
      ai: { runQualityCheck: false, runMetadataGen: false },
    };
    const parameters = { prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] };
    await expect(runner.generateImages(config, parameters)).rejects.toThrow(/Failed to generate images/);
  });
});

