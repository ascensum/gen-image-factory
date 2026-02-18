/**
 * CHARACTERIZATION TEST: RetryExecutor Baseline
 *
 * Purpose: Capture CURRENT behavior of retryExecutor.js BEFORE extraction (ADR-011).
 * Baseline: queue management, image retry processing flow, event emissions, edge cases.
 *
 * CRITICAL: These tests must pass against CURRENT retryExecutor code (100% pass rate).
 * New services (RetryQueueService, RetryProcessorService) must pass the SAME tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

vi.mock('../../src/producePictureModule', () => ({
  processImage: vi.fn().mockResolvedValue('/tmp/processed.png'),
}));

vi.mock('../../src/aiVision', () => ({
  generateMetadata: vi.fn().mockResolvedValue({ new_title: 'Test', new_description: 'Desc', uploadTags: [] }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RetryExecutor = require('../../src/services/retryExecutor');

function getQueue(executor) {
  return process.env.FEATURE_MODULAR_RETRY_QUEUE === 'true' ? executor.retryQueueService.queue : executor.queue;
}
function getIsProcessing(executor) {
  return process.env.FEATURE_MODULAR_RETRY_QUEUE === 'true' ? executor.retryQueueService.isProcessing : executor.isProcessing;
}
function setQueueState(executor, queue, isProcessing) {
  if (process.env.FEATURE_MODULAR_RETRY_QUEUE === 'true') {
    executor.retryQueueService.queue = queue;
    executor.retryQueueService.isProcessing = isProcessing;
  } else {
    executor.queue = queue;
    executor.isProcessing = isProcessing;
  }
}

describe('RetryExecutor Characterization Tests (Baseline)', () => {
  const jobConfigStub = {
    getDefaultSettings: () => ({
      filePaths: {
        outputDirectory: path.join('/tmp', 'out'),
        tempDirectory: path.join('/tmp', 'tmp'),
      },
    }),
    getConfigurationById: vi.fn().mockResolvedValue({ success: false }),
    init: vi.fn().mockResolvedValue(undefined),
  };

  const generatedImageStub = {
    updateQCStatus: vi.fn().mockResolvedValue(undefined),
    getGeneratedImage: vi.fn().mockResolvedValue({ success: false }),
    updateGeneratedImage: vi.fn().mockResolvedValue(undefined),
    updateMetadataById: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Queue management baseline ---

  it('should be instantiable with options', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    expect(executor).toBeDefined();
    expect(getQueue(executor)).toEqual([]);
    expect(getIsProcessing(executor)).toBe(false);
  });

  it('should reject addBatchRetryJob when imageIds is empty or not an array', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });

    const empty = await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: [],
      useOriginalSettings: true,
      modifiedSettings: {},
    });
    expect(empty.success).toBe(false);
    expect(empty.error).toMatch(/No image IDs/);
    expect(getQueue(executor).length).toBe(0);

    const notArray = await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: 'not-array',
      useOriginalSettings: true,
      modifiedSettings: {},
    });
    expect(notArray.success).toBe(false);
    expect(getQueue(executor).length).toBe(0);
  });

  it('should add batch retry jobs to queue and return success with job counts', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [], true);

    const result = await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: ['img-1', 'img-2'],
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
    });

    expect(result.success).toBe(true);
    expect(result.queuedJobs).toBe(2);
    expect(result.queueLength).toBe(2);
    expect(result.message).toMatch(/Successfully queued 2 retry jobs/);
    expect(getQueue(executor).length).toBe(2);
    expect(getQueue(executor).every((j) => j.status === 'pending')).toBe(true);
  });

  it('should emit queue-updated on add with queueLength, addedJobs, timestamp, context', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [], true);
    const events = [];
    executor.on('queue-updated', (p) => events.push(p));

    await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: ['img-1'],
      useOriginalSettings: true,
      modifiedSettings: {},
    });

    expect(events.length).toBe(1);
    expect(events[0]).toHaveProperty('queueLength', 1);
    expect(events[0]).toHaveProperty('addedJobs', 1);
    expect(events[0]).toHaveProperty('timestamp');
    expect(events[0]).toHaveProperty('context', 'retry');
  });

  it('should return getQueueStatus with isProcessing, queueLength, pendingJobs, processingJobs, completedJobs, failedJobs', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [
      { id: '1', status: 'pending' },
      { id: '2', status: 'processing' },
      { id: '3', status: 'completed' },
      { id: '4', status: 'failed' },
    ], true);

    const status = executor.getQueueStatus();

    expect(status).toEqual({
      isProcessing: true,
      queueLength: 4,
      pendingJobs: 1,
      processingJobs: 1,
      completedJobs: 1,
      failedJobs: 1,
    });
  });

  it('should clearCompletedJobs remove only completed entries and emit queue-updated with queueLength', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'pending' },
      { id: 'c', status: 'failed' },
    ], false);
    const events = [];
    executor.on('queue-updated', (p) => events.push(p));

    executor.clearCompletedJobs();

    expect(getQueue(executor)).toHaveLength(2);
    expect(getQueue(executor).map((j) => j.status).sort()).toEqual(['failed', 'pending']);
    expect(events.length).toBe(1);
    expect(events[0]).toHaveProperty('queueLength', 2);
  });

  it('should stop() clear queue, set isProcessing false, and emit stopped with timestamp', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [{ id: 'x', status: 'pending' }], true);
    const events = [];
    executor.on('stopped', (p) => events.push(p));

    executor.stop();

    expect(getQueue(executor).length).toBe(0);
    expect(getIsProcessing(executor)).toBe(false);
    expect(events.length).toBe(1);
    expect(events[0]).toHaveProperty('timestamp');
  });

  // --- Event emissions baseline (job lifecycle) ---

  it('should emit job-status-updated with jobId, status, timestamp when job moves to processing', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    generatedImageStub.getGeneratedImage.mockResolvedValue({ success: false });

    const statusEvents = [];
    executor.on('job-status-updated', (p) => statusEvents.push(p));

    const job = {
      id: 'retry_1',
      imageId: 'img-1',
      useOriginalSettings: true,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
      status: 'pending',
    };
    if (process.env.FEATURE_MODULAR_RETRY_QUEUE === 'true') {
      executor.retryQueueService.queue = [job];
    } else {
      executor.queue = [job];
    }
    executor.processQueue();

    await vi.waitFor(
      () => {
        expect(statusEvents.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 500 }
    );
    expect(statusEvents[0]).toMatchObject({
      jobId: 'retry_1',
      status: 'processing',
      context: 'retry',
    });
    expect(statusEvents[0]).toHaveProperty('timestamp');
  });

  it('should emit job-error when processSingleImage fails (e.g. no image data) and progress with context retry', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    generatedImageStub.getGeneratedImage.mockResolvedValue({ success: false });

    const jobErrors = [];
    const progressEvents = [];
    executor.on('job-error', (p) => jobErrors.push(p));
    executor.on('progress', (p) => progressEvents.push(p));

    const errJob = {
      id: 'retry_err_1',
      imageId: 'img-missing',
      useOriginalSettings: true,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
      status: 'pending',
    };
    if (process.env.FEATURE_MODULAR_RETRY_QUEUE === 'true') {
      executor.retryQueueService.queue = [errJob];
    } else {
      executor.queue = [errJob];
    }
    executor.processQueue();

    await vi.waitFor(
      () => {
        expect(jobErrors.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 2000 }
    );
    expect(jobErrors[0]).toMatchObject({
      jobId: 'retry_err_1',
      imageId: 'img-missing',
      context: 'retry',
    });
    expect(jobErrors[0]).toHaveProperty('error');
    expect(jobErrors[0]).toHaveProperty('timestamp');
    expect(progressEvents.some((p) => p.context === 'retry')).toBe(true);
  });

  it('should emit image-status-updated when updateImageStatus is called', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const events = [];
    executor.on('image-status-updated', (p) => events.push(p));

    await executor.updateImageStatus('img-99', 'retry_failed', 'processing_failed:remove_bg');

    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
      imageId: 'img-99',
      status: 'retry_failed',
      reason: 'processing_failed:remove_bg',
      context: 'retry',
    });
    expect(events[0]).toHaveProperty('timestamp');
    expect(generatedImageStub.updateQCStatus).toHaveBeenCalledWith('img-99', 'retry_failed', 'processing_failed:remove_bg');
  });

  // --- Fallback and config baseline ---

  it('should return getFallbackConfiguration with id fallback and default file paths', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });

    const fallback = executor.getFallbackConfiguration();

    expect(fallback.id).toBe('fallback');
    expect(fallback.name).toBe('Fallback Configuration');
    expect(fallback.settings.filePaths.outputDirectory).toContain('/tmp');
    expect(fallback.settings.filePaths.tempDirectory).toContain('/tmp');
    expect(fallback).toHaveProperty('createdAt');
    expect(fallback).toHaveProperty('updatedAt');
  });

  it('should return getOriginalProcessingSettings defaults when image has no processingSettings', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const image = { id: 'i1', processingSettings: null };

    const settings = await executor.getOriginalProcessingSettings(image);

    expect(settings).toMatchObject({
      imageEnhancement: false,
      sharpening: 0,
      saturation: 1.0,
      imageConvert: false,
      removeBg: false,
      trimTransparentBackground: false,
    });
  });

  it('should return getOriginalProcessingSettings parsed from image.processingSettings when present', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    const image = {
      id: 'i2',
      processingSettings: JSON.stringify({
        removeBg: true,
        imageConvert: true,
        convertToWebp: true,
        webpQuality: 80,
      }),
    };

    const settings = await executor.getOriginalProcessingSettings(image);

    expect(settings.removeBg).toBe(true);
    expect(settings.imageConvert).toBe(true);
    expect(settings.convertToWebp).toBe(true);
    expect(settings.webpQuality).toBe(80);
  });

  // --- Edge cases: empty queue, concurrent add, processQueue no-op when already processing ---

  it('should not start processQueue when addBatchRetryJob is called and isProcessing is already true', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [], true);
    const processQueueSpy = vi.spyOn(executor, 'processQueue');

    await executor.addBatchRetryJob({
      type: 'retry',
      imageIds: ['img-1'],
      useOriginalSettings: true,
      modifiedSettings: {},
    });

    expect(getQueue(executor).length).toBe(1);
    expect(processQueueSpy).not.toHaveBeenCalled();
    processQueueSpy.mockRestore();
  });

  it('should processQueue return immediately when isProcessing is true', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    setQueueState(executor, [{ id: 'x', status: 'pending' }], true);

    await executor.processQueue();

    expect(getQueue(executor).length).toBe(1);
    expect(getIsProcessing(executor)).toBe(true);
  });

  it('should processQueue be no-op when queue is empty', async () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    expect(executor.queue.length).toBe(0);

    await executor.processQueue();

    expect(executor.queue.length).toBe(0);
    expect(executor.isProcessing).toBe(false);
  });

  it('should have EventEmitter interface (on, emit, once)', () => {
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    expect(typeof executor.on).toBe('function');
    expect(typeof executor.emit).toBe('function');
    expect(typeof executor.once).toBe('function');
  });
});
