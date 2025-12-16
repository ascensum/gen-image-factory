import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({
  runQualityCheck: vi.fn(),
  generateMetadata: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner.executeJob success completion + bulk rerun advancement', () => {
  let runner;
  let prevGlobalRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;
    runner = new JobRunner();

    runner.jobState = {
      status: 'running',
      startTime: new Date('2025-01-01T00:00:00.000Z'),
      endTime: null,
      totalImages: 3,
      generatedImages: 2,
      failedImages: 1,
      error: null,
    };
    runner.configurationId = 101;
    runner.databaseExecutionId = 202;
    runner.persistedLabel = 'label-x';
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
  });

  it('marks completed + updates DB + runs stats + verifies readback', async () => {
    const updateJobExecution = vi.fn().mockResolvedValue({ success: true, changes: 1 });
    const updateJobExecutionStatistics = vi.fn().mockResolvedValue({ success: true });
    const getJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 202 } });

    runner.backendAdapter = {
      updateJobExecution,
      updateJobExecutionStatistics,
      getJobExecution,
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
    };

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p' });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce(null);

    await runner.executeJob({ parameters: { enablePollingTimeout: false } }, 'job-ok');

    expect(runner.jobState.status).toBe('completed');
    expect(runner.jobState.endTime).toBeInstanceOf(Date);

    expect(updateJobExecution).toHaveBeenCalledWith(
      202,
      expect.objectContaining({
        configurationId: 101,
        status: 'completed',
        label: 'label-x',
        totalImages: 3,
        generatedImages: 2,
        failedImages: 1,
      }),
    );
    expect(updateJobExecutionStatistics).toHaveBeenCalledWith(202);
    expect(getJobExecution).toHaveBeenCalledWith(202);
  });

  it('advances bulk rerun queue on success when isRerun=true', async () => {
    const processNextBulkRerunJob = vi.fn().mockResolvedValue({ success: true, message: 'Queued job started successfully' });
    runner.backendAdapter = {
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 202 } }),
      processNextBulkRerunJob,
    };
    runner.isRerun = true;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p' });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce(null);

    await runner.executeJob({ parameters: { enablePollingTimeout: false } }, 'job-rerun-ok');

    expect(processNextBulkRerunJob).toHaveBeenCalled();
  });

  it('swallows stats failure and still completes', async () => {
    runner.backendAdapter = {
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockRejectedValue(new Error('stats down')),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 202 } }),
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
    };

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p' });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce(null);

    await runner.executeJob({ parameters: { enablePollingTimeout: false } }, 'job-stats-fail');
    expect(runner.jobState.status).toBe('completed');
  });
});


