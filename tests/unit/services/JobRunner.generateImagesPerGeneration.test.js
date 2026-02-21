import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const producePictureModule = require('../../../src/producePictureModule');
const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner._generateImagesPerGeneration', () => {
  let runner;
  let prevGlobalRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;
    runner = new JobRunner();
    runner._logStructured = vi.fn();
    runner.jobState = { totalImages: 0, generatedImages: 0, failedImages: 0, gensDone: 0 };
    producePictureModule.producePictureModule = vi.fn();
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
  });

  it('continues after per-generation parameter generation failure and reconciles expected totals', async () => {
    vi.spyOn(runner, 'generateParameters')
      .mockRejectedValueOnce(new Error('no network'))
      .mockResolvedValueOnce({ prompt: 'ok', aspectRatios: ['1:1'] });

    producePictureModule.producePictureModule.mockResolvedValueOnce([
      { path: '/tmp/1.png', mappingId: 'm1' },
      { path: '/tmp/2.png', mappingId: 'm2' },
      { path: '/tmp/3.png', mappingId: 'm3' },
    ]);

    const config = { parameters: { variations: 3, generationRetryAttempts: 0 }, apiKeys: {}, processing: {}, ai: {} };
    const out = await runner._generateImagesPerGeneration(config, { prompt: 'initial' }, 2);

    expect(out).toHaveLength(3);
    // expectedTotalAcrossGens = 3 + 3, but first generation failed param gen -> 3 failures
    expect(runner.jobState.totalImages).toBe(6);
    expect(runner.jobState.failedImages).toBe(3);
    expect(runner.jobState.generatedImages).toBe(3);
    expect(runner.jobState.gensDone).toBe(2);
  });

  it('persists per-image failures from structured module results', async () => {
    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', aspectRatios: ['1:1'] });

    runner.databaseExecutionId = 111;
    runner.jobConfiguration = { processing: {} };
    runner.backendAdapter = { saveGeneratedImage: vi.fn().mockResolvedValue({ success: true }) };

    producePictureModule.producePictureModule.mockResolvedValueOnce({
      processedImages: [{ path: '/tmp/ok.png', mappingId: 'ok-1', settings: { title: { title: 't' } } }],
      failedItems: [
        { mappingId: 'fail-1', stage: 'convert', vendor: 'runware', message: 'oops' },
        { stage: 'convert' }, // skipped (no mappingId)
      ],
    });

    const config = { parameters: { variations: 1 }, apiKeys: {}, processing: {}, ai: {} };
    const out = await runner._generateImagesPerGeneration(config, { prompt: 'initial' }, 1);

    expect(out).toHaveLength(1);
    expect(runner.backendAdapter.saveGeneratedImage).toHaveBeenCalledTimes(1);
    expect(runner.backendAdapter.saveGeneratedImage).toHaveBeenCalledWith(expect.objectContaining({
      imageMappingId: 'fail-1',
      executionId: 111,
      qcReason: 'processing_failed:convert',
      qcStatus: 'qc_failed',
    }));
  });

  it('throws a wrapped error when no images are produced (invalid result format)', async () => {
    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', aspectRatios: ['1:1'] });
    producePictureModule.producePictureModule.mockResolvedValueOnce(123);

    const config = { parameters: { variations: 2 }, apiKeys: {}, processing: {}, ai: {} };
    await expect(runner._generateImagesPerGeneration(config, { prompt: 'initial' }, 1))
      .rejects
      .toThrow(/Failed to generate images: No images were generated across all generations/);

    expect(runner.jobState.failedImages).toBe(2);
  });
});

