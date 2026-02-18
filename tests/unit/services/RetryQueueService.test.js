/**
 * Unit tests for RetryQueueService (Story 3.5 Phase 1).
 * Coverage target: ≥70%. Mock processOneJob and emit.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { RetryQueueService } = await import('../../../src/services/RetryQueueService.js');

describe('RetryQueueService', () => {
  let processOneJob;
  let emit;
  let service;

  beforeEach(() => {
    processOneJob = vi.fn().mockResolvedValue({ success: true });
    emit = vi.fn();
    service = new RetryQueueService({ processOneJob, emit });
  });

  describe('constructor', () => {
    it('should initialize with empty queue and not processing', () => {
      expect(service.queue).toEqual([]);
      expect(service.isProcessing).toBe(false);
    });

    it('should use no-op processOneJob and emit when not provided', async () => {
      const s = new RetryQueueService({});
      expect(s.queue).toEqual([]);
      s.isProcessing = true;
      await s.addToQueue('img-1', {});
      expect(s.queue.length).toBe(1);
    });
  });

  describe('addToQueue', () => {
    it('should add one job and emit queue-updated', async () => {
      service.isProcessing = true;
      const result = await service.addToQueue('img-1', { useOriginalSettings: true });
      expect(result.success).toBe(true);
      expect(result.queuedJobs).toBe(1);
      expect(result.queueLength).toBe(1);
      expect(service.queue.length).toBe(1);
      expect(service.queue[0].imageId).toBe('img-1');
      expect(emit).toHaveBeenCalledWith('queue-updated', expect.objectContaining({
        queueLength: 1,
        addedJobs: 1,
        context: 'retry',
      }));
    });

    it('should reject empty imageId when passed as single-element array in batch', async () => {
      const result = await service.addBatchRetryJob({
        type: 'retry',
        imageIds: [],
        useOriginalSettings: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No image IDs/);
      expect(service.queue.length).toBe(0);
    });
  });

  describe('addBatchRetryJob', () => {
    it('should add multiple jobs and return counts', async () => {
      service.isProcessing = true;
      const result = await service.addBatchRetryJob({
        type: 'retry',
        imageIds: ['a', 'b'],
        useOriginalSettings: false,
        modifiedSettings: {},
      });
      expect(result.success).toBe(true);
      expect(result.queuedJobs).toBe(2);
      expect(result.queueLength).toBe(2);
      expect(service.queue).toHaveLength(2);
      expect(service.queue.every(j => j.status === 'pending')).toBe(true);
    });

    it('should reject when imageIds is not an array', async () => {
      const result = await service.addBatchRetryJob({
        type: 'retry',
        imageIds: null,
        useOriginalSettings: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No image IDs/);
    });
  });

  describe('removeFromQueue', () => {
    it('should remove all jobs for given imageId', async () => {
      service.isProcessing = true;
      await service.addBatchRetryJob({
        type: 'retry',
        imageIds: ['x', 'y', 'x'],
        useOriginalSettings: true,
      });
      service.removeFromQueue('x');
      expect(service.queue).toHaveLength(1);
      expect(service.queue[0].imageId).toBe('y');
      expect(emit).toHaveBeenCalledWith('queue-updated', expect.objectContaining({ queueLength: 1 }));
    });

    it('should not emit when no jobs removed', async () => {
      service.isProcessing = true;
      await service.addToQueue('img-1', {});
      emit.mockClear();
      service.removeFromQueue('other');
      expect(service.queue.length).toBe(1);
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('getQueueStatus', () => {
    it('should return isProcessing, queueLength, and status counts', async () => {
      service.isProcessing = true;
      await service.addBatchRetryJob({
        type: 'retry',
        imageIds: ['1', '2'],
        useOriginalSettings: true,
      });
      service.queue[0].status = 'processing';
      service.queue[1].status = 'pending';
      const status = service.getQueueStatus();
      expect(status).toEqual({
        isProcessing: true,
        queueLength: 2,
        pendingJobs: 1,
        processingJobs: 1,
        completedJobs: 0,
        failedJobs: 0,
      });
    });
  });

  describe('startProcessing', () => {
    it('should call processOneJob for each job and emit events', async () => {
      await service.addBatchRetryJob({
        type: 'retry',
        imageIds: ['img-1'],
        useOriginalSettings: true,
      });
      processOneJob.mockResolvedValue({ success: true });

      service.startProcessing();
      await vi.waitFor(() => expect(processOneJob).toHaveBeenCalled(), { timeout: 500 });

      expect(emit).toHaveBeenCalledWith('job-status-updated', expect.objectContaining({
        status: 'processing',
        context: 'retry',
      }));
      expect(emit).toHaveBeenCalledWith('job-completed', expect.objectContaining({
        imageId: 'img-1',
        context: 'retry',
      }));
      expect(emit).toHaveBeenCalledWith('progress', expect.objectContaining({ context: 'retry' }));
    });

    it('should emit job-error when processOneJob returns success: false', async () => {
      service.isProcessing = true;
      await service.addToQueue('fail-img', {});
      processOneJob.mockResolvedValue({ success: false, error: 'Failed' });
      service.isProcessing = false;

      await service.startProcessing();

      const errorCalls = emit.mock.calls.filter(c => c[0] === 'job-error');
      expect(errorCalls.length).toBeGreaterThanOrEqual(1);
      expect(emit).toHaveBeenCalledWith('job-error', expect.objectContaining({
        imageId: 'fail-img',
        error: 'Failed',
        context: 'retry',
      }));
    });

    it('should return immediately when already processing', async () => {
      service.isProcessing = true;
      service.queue = [{ id: 'j1', imageId: 'i1', status: 'pending' }];
      service.startProcessing();
      await new Promise(r => setTimeout(r, 50));
      expect(processOneJob).not.toHaveBeenCalled();
    });

    it('should be no-op when queue is empty', async () => {
      service.startProcessing();
      await new Promise(r => setTimeout(r, 50));
      expect(processOneJob).not.toHaveBeenCalled();
    });
  });

  describe('stopProcessing', () => {
    it('should clear queue and emit stopped', async () => {
      service.isProcessing = true;
      await service.addToQueue('img-1', {});
      service.stopProcessing();
      expect(service.queue.length).toBe(0);
      expect(service.isProcessing).toBe(false);
      expect(emit).toHaveBeenCalledWith('stopped', expect.objectContaining({ timestamp: expect.any(Date) }));
    });
  });

  describe('clearCompletedJobs', () => {
    it('should remove only completed jobs and emit queue-updated', async () => {
      service.isProcessing = true;
      await service.addBatchRetryJob({
        type: 'retry',
        imageIds: ['a', 'b', 'c'],
        useOriginalSettings: true,
      });
      service.queue[0].status = 'completed';
      service.queue[1].status = 'pending';
      service.queue[2].status = 'failed';
      emit.mockClear();

      service.clearCompletedJobs();

      expect(service.queue).toHaveLength(2);
      expect(emit).toHaveBeenCalledWith('queue-updated', { queueLength: 2 });
    });
  });
});
