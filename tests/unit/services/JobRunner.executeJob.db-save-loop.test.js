import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({
  runQualityCheck: vi.fn(),
  generateMetadata: vi.fn(),
}));

const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner.executeJob DB save loop (prompt sanitization + qc init)', () => {
  let runner;
  let prevGlobalRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;
    runner = new JobRunner();
    runner.isStopping = false;

    // keep logs/progress silent in unit tests
    runner._logStructured = vi.fn();
    runner.emitProgress = vi.fn();

    runner.jobState = {
      status: 'running',
      startTime: new Date('2025-01-01T00:00:00.000Z'),
      endTime: null,
      totalImages: 0,
      generatedImages: 0,
      failedImages: 0,
      error: null,
    };

    runner.databaseExecutionId = 555;
    runner.configurationId = 999;
    runner.persistedLabel = 'lbl';

    // QC enabled for this test so initial QC status should be qc_failed (pending review)
    runner.jobConfiguration = { ai: { runQualityCheck: true }, processing: {} };

    runner.backendAdapter = {
      saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 555 } }),
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
    };

    // Avoid QC settle waits touching real DB
    runner.getSavedImagesForExecution = vi.fn().mockResolvedValue([]);
    runner.waitForQCToSettle = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
  });

  it('sanitizes generationPrompt and saves initial image record with qc_failed status', async () => {
    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p' });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      {
        path: '/tmp/a.png',
        status: 'generated',
        mappingId: 'map-1',
        aspectRatio: '1:1',
        metadata: { prompt: 'food --v 6 --ar 1:1 --q 2 --seed 123 --style 100', extra: 'x' },
      },
      {
        path: '/tmp/b.png',
        status: 'failed',
        mappingId: 'map-2',
        metadata: { prompt: 'ignored' },
      },
    ]);

    await runner.executeJob(
      { parameters: { enablePollingTimeout: false }, processing: {} },
      'job-xyz',
    );

    expect(runner.backendAdapter.saveGeneratedImage).toHaveBeenCalledTimes(1);
    const payload = runner.backendAdapter.saveGeneratedImage.mock.calls[0][0];

    expect(payload).toEqual(expect.objectContaining({
      imageMappingId: 'map-1',
      executionId: 555,
      generationPrompt: 'food',
      qcStatus: 'qc_failed',
      qcReason: null,
      tempImagePath: '/tmp/a.png',
      finalImagePath: null,
    }));

    // metadata and processingSettings are stored as JSON strings
    expect(() => JSON.parse(payload.metadata)).not.toThrow();
    const meta = JSON.parse(payload.metadata);
    expect(meta).toEqual(expect.objectContaining({ prompt: expect.any(String), extra: 'x' }));

    expect(() => JSON.parse(payload.processingSettings)).not.toThrow();
    const ps = JSON.parse(payload.processingSettings);
    expect(ps).toEqual(expect.objectContaining({
      removeBgFailureMode: 'approve',
      removeBgSize: 'auto',
    }));
  });
});


