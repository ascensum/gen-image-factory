import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({
  runQualityCheck: vi.fn(),
  generateMetadata: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner.executeJob error handling + bulk rerun advancement', () => {
  let runner;
  let prevGlobalRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;
    runner = new JobRunner();

    // Minimal job state expected by error handler
    runner.jobState = {
      status: 'running',
      startTime: new Date('2025-01-01T00:00:00.000Z'),
      endTime: null,
      totalImages: 0,
      generatedImages: 0,
      failedImages: 0,
      error: null,
    };
    runner.configurationId = 42;
    runner.databaseExecutionId = 777;
    runner.persistedLabel = 'lbl';
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
  });

  it('updates DB + emits error when image generation throws', async () => {
    const updateJobExecution = vi.fn().mockResolvedValue({ success: true });
    runner.backendAdapter = {
      updateJobExecution,
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
    };

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p' });
    vi.spyOn(runner, 'generateImages').mockRejectedValueOnce(new Error('boom'));

    const errorSpy = vi.fn();
    runner.on('error', errorSpy);

    await runner.executeJob({ parameters: { enablePollingTimeout: false } }, 'job-1');

    expect(runner.jobState.status).toBe('error');
    expect(String(runner.jobState.error)).toContain('boom');
    expect(updateJobExecution).toHaveBeenCalledWith(
      777,
      expect.objectContaining({
        configurationId: 42,
        status: 'failed',
        errorMessage: 'boom',
        label: 'lbl',
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        code: 'JOB_EXECUTION_ERROR',
        error: 'boom',
      }),
    );
  });

  it('advances bulk rerun queue on failure when isRerun=true', async () => {
    const processNextBulkRerunJob = vi.fn().mockResolvedValue({ success: true, message: 'Queued job started successfully' });
    runner.backendAdapter = {
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      processNextBulkRerunJob,
    };
    runner.isRerun = true;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p' });
    vi.spyOn(runner, 'generateImages').mockRejectedValueOnce(new Error('boom'));

    // Prevent EventEmitter from throwing on unhandled 'error' events
    runner.on('error', () => {});

    await runner.executeJob({ parameters: { enablePollingTimeout: false } }, 'job-2');

    expect(processNextBulkRerunJob).toHaveBeenCalled();
  });
});

