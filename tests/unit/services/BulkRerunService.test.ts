/**
 * UNIT TEST: BulkRerunService
 *
 * Tests BulkRerunService in isolation with mocked dependencies.
 * Goal: ≥70% coverage, verify interface contracts, test edge cases.
 *
 * Story 3.1 pattern: DI-based; mock jobExecution, jobConfig, jobRunner, getSettings.
 * Queue: global.bulkRerunQueue (set/cleared in tests).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BulkRerunService Unit Tests', () => {
  let BulkRerunService: any;
  let service: any;
  let mockJobExecution: any;
  let mockJobConfig: any;
  let mockJobRunner: any;
  let mockGetSettings: any;
  let originalBulkRerunQueue: any;

  const validExecution = (id: number, configId: number) => ({
    id,
    label: `Job ${id}`,
    status: 'completed',
    configurationId: configId
  });
  const validConfig = (name: string) => ({
    success: true,
    configuration: {
      name,
      settings: { parameters: { label: name }, processing: {} }
    }
  });

  beforeEach(() => {
    originalBulkRerunQueue = (global as any).bulkRerunQueue;
    (global as any).bulkRerunQueue = undefined;

    mockJobExecution = {
      getJobExecutionsByIds: vi.fn(),
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 20, execution: { id: 20 } }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true })
    };
    mockJobConfig = {
      getConfigurationById: vi.fn()
    };
    mockJobRunner = {
      getJobStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
      startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'bulk-job-1' })
    };
    mockGetSettings = vi.fn().mockResolvedValue({ settings: { apiKeys: {} } });

    const module = req('../../../src/services/BulkRerunService.js');
    BulkRerunService = module.BulkRerunService;
    service = new BulkRerunService({
      jobExecution: mockJobExecution,
      jobConfig: mockJobConfig,
      jobRunner: mockJobRunner,
      getSettings: mockGetSettings
    });

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (global as any).bulkRerunQueue = originalBulkRerunQueue;
  });

  describe('bulkRerunJobExecutions', () => {
    it('should return error when getJobExecutionsByIds fails', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({ success: false });

      const result = await service.bulkRerunJobExecutions([1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve jobs for rerun');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return error when no jobs found', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({ success: true, executions: [] });

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No jobs found for rerun');
    });

    it('should return error when any selected job is running', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [validExecution(1, 10), { ...validExecution(2, 11), status: 'running' }]
      });

      const result = await service.bulkRerunJobExecutions([1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot rerun jobs while other jobs are running');
    });

    it('should return error when jobRunner reports running', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [validExecution(1, 10)]
      });
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig('C1'));
      mockJobRunner.getJobStatus.mockResolvedValue({ status: 'running' });

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Another job is currently running');
    });

    it('should return error and failedJobs when no jobs can be queued (all missing config)', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [{ ...validExecution(1, 10), configurationId: null }]
      });

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No jobs could be queued for rerun');
      expect(result.failedJobs).toHaveLength(1);
      expect(result.failedJobs[0].error).toContain('no configuration');
    });

    it('should return error when saveJobExecution fails for first job', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [validExecution(1, 10)]
      });
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig('C1'));
      mockJobExecution.saveJobExecution.mockResolvedValue({ success: false });

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create job execution record');
    });

    it('should succeed for single job and not push to queue', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [validExecution(1, 10)]
      });
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig('C1'));

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(true);
      expect(result.startedJob).toBeDefined();
      expect(result.queuedJobs).toBe(0);
      expect(result.totalJobs).toBe(1);
      expect(mockJobRunner.startJob).toHaveBeenCalledTimes(1);
      expect((global as any).bulkRerunQueue).toBeUndefined();
    });

    it('should succeed for multiple jobs and push remaining to global.bulkRerunQueue', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [validExecution(1, 10), validExecution(2, 11)]
      });
      mockJobConfig.getConfigurationById
        .mockResolvedValueOnce(validConfig('C1'))
        .mockResolvedValueOnce(validConfig('C2'));

      const result = await service.bulkRerunJobExecutions([1, 2]);

      expect(result.success).toBe(true);
      expect(result.queuedJobs).toBe(1);
      expect(result.totalJobs).toBe(2);
      expect(Array.isArray((global as any).bulkRerunQueue)).toBe(true);
      expect((global as any).bulkRerunQueue.length).toBe(1);
      expect((global as any).bulkRerunQueue[0].jobId).toBe(2);
    });

    it('should return error when startJob fails and mark execution failed', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: [validExecution(1, 10)]
      });
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig('C1'));
      mockJobRunner.startJob.mockResolvedValue({ success: false, error: 'Runner error' });

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start job rerun');
      expect(mockJobExecution.updateJobExecution).toHaveBeenCalledWith(20, { status: 'failed' });
    });

    it('should catch and return error on unexpected throw', async () => {
      mockJobExecution.getJobExecutionsByIds.mockRejectedValue(new Error('Network error'));

      const result = await service.bulkRerunJobExecutions([1]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('processNextBulkRerunJob', () => {
    it('should return no jobs in queue when queue is empty', async () => {
      (global as any).bulkRerunQueue = [];

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(false);
      expect(result.message).toBe('No jobs in queue');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return message when queue is undefined', async () => {
      (global as any).bulkRerunQueue = undefined;

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(false);
      expect(result.message).toBe('No jobs in queue');
    });

    it('should return when another job is running', async () => {
      (global as any).bulkRerunQueue = [
        {
          jobId: 1,
          label: 'Q1',
          configurationId: 10,
          configuration: { parameters: {}, processing: {} }
        }
      ];
      mockJobRunner.getJobStatus.mockResolvedValue({ status: 'running' });

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Another job is running');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should start next job and return remainingInQueue', async () => {
      (global as any).bulkRerunQueue = [
        {
          jobId: 1,
          label: 'Queued Job',
          configurationId: 10,
          configuration: { parameters: { label: 'Q1' }, processing: {} }
        }
      ];

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Queued job started successfully');
      expect(result.jobId).toBe('bulk-job-1');
      expect(result.executionId).toBe(20);
      expect(result.remainingInQueue).toBe(0);
      expect(mockJobRunner.startJob).toHaveBeenCalledTimes(1);
      expect((global as any).bulkRerunQueue.length).toBe(0);
    });

    it('should return error when saveJobExecution fails in processNext', async () => {
      (global as any).bulkRerunQueue = [
        {
          jobId: 1,
          label: 'Q1',
          configurationId: 10,
          configuration: { parameters: {}, processing: {} }
        }
      ];
      mockJobExecution.saveJobExecution.mockResolvedValue({ success: false });

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create execution record');
    });

    it('should mark execution failed when startJob fails in processNext', async () => {
      (global as any).bulkRerunQueue = [
        {
          jobId: 1,
          label: 'Q1',
          configurationId: 10,
          configuration: { parameters: {}, processing: {} }
        }
      ];
      mockJobRunner.startJob.mockResolvedValue({ success: false, error: 'Start failed' });

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(false);
      expect(mockJobExecution.updateJobExecution).toHaveBeenCalledWith(20, { status: 'failed' });
    });

    it('should return error on unexpected throw', async () => {
      (global as any).bulkRerunQueue = [{ jobId: 1 }];
      mockJobExecution.saveJobExecution.mockRejectedValue(new Error('DB error'));

      const result = await service.processNextBulkRerunJob();

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
});
