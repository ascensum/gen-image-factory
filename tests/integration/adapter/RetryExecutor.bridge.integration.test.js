/**
 * Bridge Integration Tests: RetryExecutor <-> RetryQueueService (Story 3.5 Phase 1).
 * Coverage: FEATURE_MODULAR_RETRY_QUEUE = 'true' (service path), 'false' (legacy path), fallback when service fails.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp') },
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: vi.fn().mockResolvedValue('/tmp/processed.png'),
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: vi.fn().mockResolvedValue({ new_title: 'Test', uploadTags: [] }),
}));

const RetryExecutor = require('../../../src/services/retryExecutor');

describe('RetryExecutor RetryQueueService Bridge Integration', () => {
  const jobConfigStub = {
    getDefaultSettings: () => ({
      filePaths: { outputDirectory: path.join('/tmp', 'out'), tempDirectory: path.join('/tmp', 'tmp') },
    }),
    init: vi.fn().mockResolvedValue(undefined),
  };

  const generatedImageStub = {
    updateQCStatus: vi.fn().mockResolvedValue(undefined),
    getGeneratedImage: vi.fn().mockResolvedValue({ success: false }),
    updateGeneratedImage: vi.fn().mockResolvedValue(undefined),
    updateMetadataById: vi.fn().mockResolvedValue(undefined),
  };

  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.FEATURE_MODULAR_RETRY_QUEUE;
  });

  afterEach(() => {
    process.env.FEATURE_MODULAR_RETRY_QUEUE = originalEnv;
    vi.clearAllMocks();
  });

  describe('Feature flag disabled (legacy path)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_RETRY_QUEUE = 'false';
    });

    it('should use legacy queue: addBatchRetryJob updates executor queue', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.isProcessing = true;
      const result = await executor.addBatchRetryJob({
        type: 'retry',
        imageIds: ['img-1', 'img-2'],
        useOriginalSettings: true,
        modifiedSettings: {},
      });
      expect(result.success).toBe(true);
      expect(result.queuedJobs).toBe(2);
      expect(executor.queue).toHaveLength(2);
      expect(executor.retryQueueService.queue).toHaveLength(0);
    });

    it('should use legacy getQueueStatus', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.isProcessing = true;
      await executor.addBatchRetryJob({
        type: 'retry',
        imageIds: ['a'],
        useOriginalSettings: true,
        modifiedSettings: {},
      });
      const status = executor.getQueueStatus();
      expect(status.queueLength).toBe(1);
      expect(status.isProcessing).toBe(true);
    });

    it('should use legacy stop()', () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.queue = [{ id: '1', status: 'pending' }];
      executor.isProcessing = true;
      executor.stop();
      expect(executor.queue).toHaveLength(0);
      expect(executor.isProcessing).toBe(false);
    });
  });

  describe('Feature flag enabled (RetryQueueService path)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_RETRY_QUEUE = 'true';
    });

    it('should use RetryQueueService: addBatchRetryJob updates service queue', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryQueueService.isProcessing = true;
      const result = await executor.addBatchRetryJob({
        type: 'retry',
        imageIds: ['img-1', 'img-2'],
        useOriginalSettings: true,
        modifiedSettings: {},
      });
      expect(result.success).toBe(true);
      expect(result.queuedJobs).toBe(2);
      expect(executor.retryQueueService.queue).toHaveLength(2);
      expect(executor.queue).toHaveLength(0);
    });

    it('should use RetryQueueService getQueueStatus', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryQueueService.isProcessing = true;
      executor.retryQueueService.queue = [
        { id: '1', imageId: 'a', status: 'pending' },
        { id: '2', imageId: 'b', status: 'processing' },
      ];
      const status = executor.getQueueStatus();
      expect(status.queueLength).toBe(2);
      expect(status.pendingJobs).toBe(1);
      expect(status.processingJobs).toBe(1);
    });

    it('should use RetryQueueService stopProcessing on stop()', () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryQueueService.queue = [{ id: '1', status: 'pending' }];
      executor.stop();
      expect(executor.retryQueueService.queue).toHaveLength(0);
      expect(executor.retryQueueService.isProcessing).toBe(false);
    });

    it('should use RetryQueueService clearCompletedJobs', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryQueueService.queue = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'pending' },
      ];
      executor.clearCompletedJobs();
      expect(executor.retryQueueService.queue).toHaveLength(1);
    });
  });

  describe('Fallback when RetryQueueService fails', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_RETRY_QUEUE = 'true';
    });

    it('should fall back to legacy addBatchRetryJob when service.addBatchRetryJob throws', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryQueueService.addBatchRetryJob = vi.fn().mockRejectedValue(new Error('Service error'));
      executor.isProcessing = true;
      const result = await executor.addBatchRetryJob({
        type: 'retry',
        imageIds: ['img-1'],
        useOriginalSettings: true,
        modifiedSettings: {},
      });
      expect(result.success).toBe(true);
      expect(executor.queue).toHaveLength(1);
    });

    it('should fall back to legacy getQueueStatus when service.getQueueStatus throws', () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryQueueService.getQueueStatus = vi.fn().mockImplementation(() => {
        throw new Error('Service error');
      });
      executor.queue = [{ id: '1', status: 'pending' }];
      executor.isProcessing = false;
      const status = executor.getQueueStatus();
      expect(status.queueLength).toBe(1);
    });
  });
});
