import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({
  producePictureModule: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const producePictureModule = require('../../../src/producePictureModule');

describe('JobRunner - stop and retry behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stopJob marks job failed and persists status to backendAdapter', async () => {
    const runner = new JobRunner();
    const updateSpy = vi.fn().mockResolvedValue({ success: true });

    runner.backendAdapter = { updateJobExecution: updateSpy };
    runner.databaseExecutionId = 'exec-123';
    runner.configurationId = 'cfg-789';
    runner.persistedLabel = 'job-label';
    runner.jobState = {
      ...runner.jobState,
      status: 'running',
      startTime: new Date('2024-01-01T00:00:00Z'),
      totalImages: 3,
      generatedImages: 2,
      failedImages: 1,
    };

    await runner.stopJob();

    expect(runner.jobState.status).toBe('failed');
    expect(updateSpy).toHaveBeenCalledWith(
      'exec-123',
      expect.objectContaining({
        status: 'failed',
        totalImages: 3,
        successfulImages: 2,
        failedImages: 1,
        errorMessage: 'Stopped by user',
        label: 'job-label',
      }),
    );
  });

  it('retries a generation with backoff before succeeding', async () => {
    const runner = new JobRunner();
    vi.spyOn(runner, 'generateParameters').mockResolvedValue({
      prompt: 'p',
      promptContext: '',
      aspectRatios: ['1:1'],
    });

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    producePictureModule.producePictureModule = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail once'))
      .mockResolvedValueOnce([{ outputPath: '/tmp/out.png', settings: {} }]);

    const config = {
      apiKeys: { openai: 'key', runware: 'run' },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: {
        processMode: 'single',
        aspectRatios: ['1:1'],
        count: 1,
        generationRetryAttempts: 1,
        generationRetryBackoffMs: 50,
        enablePollingTimeout: false,
      },
      processing: {},
      ai: {},
    };
    const parameters = { prompt: 'p', promptContext: '', aspectRatios: ['1:1'] };

    const promise = runner._generateImagesPerGeneration(config, parameters, 1);
    await vi.runAllTimersAsync();
    const images = await promise;

    expect(producePictureModule.producePictureModule).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 50);
    expect(images.length).toBe(1);
  });

  it('withTimeout rejects when duration elapses', async () => {
    const runner = new JobRunner();
    const never = new Promise(() => {});

    const timed = runner.withTimeout(never, 100, 'timeout!');
    const assertion = expect(timed).rejects.toThrow(/timeout!/);

    await vi.runAllTimersAsync();
    await assertion;
  });

  it('forceStopAll aborts controller and persists failed status', async () => {
    const runner = new JobRunner();
    const abortSpy = vi.fn();
    const updateSpy = vi.fn().mockResolvedValue({ success: true });
    runner.abortController = { abort: abortSpy };
    runner.backendAdapter = { updateJobExecution: updateSpy };
    runner.databaseExecutionId = 'exec-555';
    runner.configurationId = 'cfg-555';
    runner.persistedLabel = 'label-555';
    runner.jobState = {
      ...runner.jobState,
      status: 'running',
      startTime: new Date('2024-01-02T00:00:00Z'),
      totalImages: 4,
      generatedImages: 3,
      failedImages: 1,
    };

    await runner.forceStopAll();

    expect(runner.jobState.status).toBe('failed');
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      'exec-555',
      expect.objectContaining({
        status: 'failed',
        totalImages: 4,
        successfulImages: 3,
        failedImages: 1,
        errorMessage: 'Force-stopped by user',
        label: 'label-555',
      }),
    );
  });
});
