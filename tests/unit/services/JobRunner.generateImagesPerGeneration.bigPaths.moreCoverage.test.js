import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner._generateImagesPerGeneration (big paths)', () => {
  let prevCache = {};

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const patchCjs = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };
  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/jobRunner.js');
    remember(sutId);
    delete req.cache[sutId];
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};
  });

  afterEach(() => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('handles structured results + failedItems persistence and reconciles expected totals', async () => {
    const producePictureModule = { producePictureModule: vi.fn() };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn(); // avoid noisy logs, but still executes callsites

    const savedFailures = [];
    runner.backendAdapter = {
      saveGeneratedImage: vi.fn(async (img) => { savedFailures.push(img); return { success: true, id: savedFailures.length }; }),
    };
    runner.databaseExecutionId = 99;

    const config = {
      apiKeys: { openai: 'k', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' },
      parameters: { processMode: 'relax', variations: 2, enablePollingTimeout: false, pollingTimeout: 1 },
      processing: { imageEnhancement: true, sharpening: 3, saturation: 1.2, removeBg: true, removeBgSize: 'auto' },
      ai: { runQualityCheck: true, runMetadataGen: false },
      advanced: {},
    };
    runner.jobConfiguration = config;

    runner.generateParameters = vi.fn(async (cfgForGen) => ({
      prompt: `prompt gen ${cfgForGen.__forceSequentialIndex}`,
      promptContext: 'ctx',
      aspectRatios: ['1:1'],
    }));

    producePictureModule.producePictureModule
      .mockResolvedValueOnce({
        processedImages: [
          { outputPath: '/tmp/a.png', mappingId: 'm1', settings: { title: { title: 't', description: 'd' } } },
          { path: '/tmp/b.png', mappingId: 'm2', softFailures: [{ stage: 'remove_bg', message: 'soft' }] },
        ],
        failedItems: [{ mappingId: 'failmap1', stage: 'remove_bg', vendor: 'remove.bg', message: 'hard fail' }],
      })
      .mockResolvedValueOnce([{ outputPath: '/tmp/c.png', mappingId: 'm3' }]);

    const images = await runner._generateImagesPerGeneration(config, { prompt: 'orig' }, 2);

    expect(images).toHaveLength(3);
    // expectedTotalAcrossGens = 2 per gen × 2 gens = 4; generatedTotal=3 => failedImages=1
    expect(runner.jobState.totalImages).toBe(4);
    expect(runner.jobState.generatedImages).toBe(3);
    expect(runner.jobState.failedImages).toBe(1);

    // failedItems were persisted as qc_failed images
    expect(runner.backendAdapter.saveGeneratedImage).toHaveBeenCalled();
    const persisted = savedFailures.find((x) => x.imageMappingId === 'failmap1');
    expect(persisted).toBeTruthy();
    expect(persisted.qcStatus).toBe('qc_failed');
    expect(persisted.qcReason).toBe('processing_failed:remove_bg');
    expect(persisted.executionId).toBe(99);
  });

  it('retries once on generation error and clamps variations when generations > 500', async () => {
    const producePictureModule = { producePictureModule: vi.fn() };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    const config = {
      apiKeys: { openai: 'k', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' },
      parameters: {
        processMode: 'relax',
        variations: 20,
        generationRetryAttempts: 1,
        generationRetryBackoffMs: 0,
        enablePollingTimeout: false,
        pollingTimeout: 1,
      },
      processing: {},
      ai: {},
      advanced: {},
    };

    // generations=501 => maxAllowed=floor(10000/501)=19; requested=20 => clamp to 19
    const generations = 501;
    runner.generateParameters = vi.fn(async (cfgForGen) => {
      if (cfgForGen.__forceSequentialIndex === 0) return { prompt: 'p0', promptContext: '', aspectRatios: ['2:3'] };
      throw new Error('skip remaining gens fast');
    });

    producePictureModule.producePictureModule
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('/tmp/one.png');

    const out = await runner._generateImagesPerGeneration(config, { prompt: 'orig' }, generations);
    expect(out).toHaveLength(1);

    // Called twice due to retry; ensure clamped variations is passed to moduleConfig
    expect(producePictureModule.producePictureModule).toHaveBeenCalled();
    const firstCallModuleConfig = producePictureModule.producePictureModule.mock.calls[0][3];
    expect(firstCallModuleConfig.variations).toBe(19);

    expect(runner.jobState.totalImages).toBe(19 * generations);
    expect(runner.jobState.generatedImages).toBe(1);
    expect(runner.jobState.failedImages).toBe((19 * generations) - 1);
  });

  it('throws when no images are generated across all generations', async () => {
    const producePictureModule = { producePictureModule: vi.fn() };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    const config = {
      apiKeys: { openai: 'k', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' },
      parameters: { processMode: 'relax', variations: 2, enablePollingTimeout: false, pollingTimeout: 1 },
      processing: {},
      ai: {},
      advanced: {},
    };

    runner.generateParameters = vi.fn(async () => { throw new Error('param fail'); });

    await expect(runner._generateImagesPerGeneration(config, { prompt: 'orig' }, 2)).rejects.toThrow(/Failed to generate images: No images were generated/);
  });
});

