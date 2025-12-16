import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: vi.fn().mockResolvedValue('/tmp/processed.png'),
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RetryExecutor = require('../../../src/services/retryExecutor');

describe('RetryExecutor - queue and fallback behavior', () => {
  const jobConfigStub = {
    getDefaultSettings: () => ({
      filePaths: {
        outputDirectory: path.join('/tmp', 'out'),
        tempDirectory: path.join('/tmp', 'tmp'),
      },
    }),
  };

  const generatedImageStub = {
    updateQCStatus: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guards against empty image list when adding batch retry jobs', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });

    const result = await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: [],
      useOriginalSettings: true,
      modifiedSettings: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No image IDs/);
    expect(executor.queue.length).toBe(0);
  });

  it('enqueues jobs and emits queue-updated without starting processing when already running', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const events = [];
    executor.on('queue-updated', payload => events.push(payload));

    // Simulate active processing to skip processQueue side-effects
    executor.isProcessing = true;

    const result = await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: ['img-1', 'img-2'],
      useOriginalSettings: false,
      modifiedSettings: { convertToWebp: true },
      includeMetadata: false,
    });

    expect(result.success).toBe(true);
    expect(result.queuedJobs).toBe(2);
    expect(executor.queue.length).toBe(2);
    expect(events.length).toBe(1);
    expect(events[0].queueLength).toBe(2);
  });

  it('updates image status via generatedImage model and emits status event', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const events = [];
    executor.on('image-status-updated', payload => events.push(payload));

    await executor.updateImageStatus('img-123', 'qc_failed', 'processing_error');

    expect(generatedImageStub.updateQCStatus).toHaveBeenCalledWith('img-123', 'qc_failed', 'processing_error');
    expect(events[0]).toMatchObject({ imageId: 'img-123', status: 'qc_failed', reason: 'processing_error' });
  });

  it('returns fallback configuration with default file paths when original config unavailable', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });

    const fallback = executor.getFallbackConfiguration();

    expect(fallback.id).toBe('fallback');
    expect(fallback.settings.filePaths.outputDirectory).toContain('/tmp/out');
    expect(fallback.settings.filePaths.tempDirectory).toContain('/tmp/tmp');
  });

  it('stop clears queue and emits stopped event', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const events = [];
    executor.on('stopped', payload => events.push(payload));

    executor.queue = [
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'pending' },
    ];
    executor.isProcessing = true;

    executor.stop();

    expect(executor.queue.length).toBe(0);
    expect(executor.isProcessing).toBe(false);
    expect(events.length).toBe(1);
  });

  it('clearCompletedJobs removes completed entries and emits queue-updated', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const events = [];
    executor.on('queue-updated', payload => events.push(payload));

    executor.queue = [
      { id: 'done', status: 'completed' },
      { id: 'pending', status: 'pending' },
    ];

    executor.clearCompletedJobs();

    expect(executor.queue).toEqual([{ id: 'pending', status: 'pending' }]);
    expect(events[0].queueLength).toBe(1);
  });
});
