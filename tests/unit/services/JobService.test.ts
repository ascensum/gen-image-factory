/**
 * Unit Tests: JobService
 * 
 * Purpose: Test JobService coordination layer in isolation with mocked dependencies
 * Coverage Goal: ≥70% statement and branch coverage
 * 
 * Testing Strategy:
 * - Mock JobEngine and JobRepository
 * - Test event-based coordination (JobEngine events → JobService → JobRepository)
 * - Test job lifecycle: start → execute → persist → complete
 * - Test error handling and cleanup
 * 
 * Related: Story 3.1 Phase 4 Task 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'events';

const req = createRequire(import.meta.url);

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 50));

describe('JobService Unit Tests', () => {
  let JobService: any;
  let jobService: any;
  let mockJobEngine: any;
  let mockJobRepository: any;

  beforeEach(() => {
    // Clear module cache
    delete req.cache[req.resolve('../../../src/services/JobService.js')];
    
    // Load JobService
    const module = req('../../../src/services/JobService.js');
    JobService = module.JobService;

    // Create mock JobEngine (EventEmitter)
    mockJobEngine = new EventEmitter();
    mockJobEngine.executeJob = vi.fn().mockResolvedValue({
      status: 'completed',
      totalImages: 10,
      successfulImages: 8,
      failedImages: 2
    });

    // Create mock JobRepository
    mockJobRepository = {
      saveJobExecution: vi.fn().mockResolvedValue({
        success: true,
        id: 123,
        jobId: 'job-456'
      }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatus: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({
        success: true,
        execution: { id: 123, status: 'completed' }
      }),
      getJobHistory: vi.fn().mockResolvedValue({
        success: true,
        executions: []
      }),
      getJobStatistics: vi.fn().mockResolvedValue({
        success: true,
        totalJobs: 42,
        completedJobs: 40,
        failedJobs: 2
      }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true })
    };
  });

  describe('Constructor', () => {
    it('should require jobEngine dependency', () => {
      expect(() => {
        new JobService({ jobRepository: mockJobRepository });
      }).toThrow('JobService requires jobEngine dependency');
    });

    it('should require jobRepository dependency', () => {
      expect(() => {
        new JobService({ jobEngine: mockJobEngine });
      }).toThrow('JobService requires jobRepository dependency');
    });

    it('should initialize with both dependencies', () => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });

      expect(jobService.jobEngine).toBe(mockJobEngine);
      expect(jobService.jobRepository).toBe(mockJobRepository);
    });

    it('should setup event listeners for JobEngine', () => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });

      // Verify event listeners are registered
      expect(mockJobEngine.listenerCount('progress')).toBeGreaterThan(0);
      expect(mockJobEngine.listenerCount('image-generated')).toBeGreaterThan(0);
      expect(mockJobEngine.listenerCount('error')).toBeGreaterThan(0);
      // job-complete is emitted by JobService after persist/post-processing, not forwarded from JobEngine
      expect(mockJobEngine.listenerCount('job-complete')).toBe(0);
    });
  });

  describe('startJobAsync()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should create job execution record via JobRepository', async () => {
      const config = { parameters: { count: 5 } };
      const options = { configurationId: 'cfg-1', label: 'Test Job' };

      await jobService.startJobAsync(config, options);

      expect(mockJobRepository.saveJobExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationId: 'cfg-1',
          label: 'Test Job',
          status: 'running',
          configurationSnapshot: expect.objectContaining({
            parameters: expect.objectContaining({ count: 5 })
          })
        })
      );
    });

    it('should fire background execution via JobEngine', async () => {
      const config = { parameters: { count: 5 } };

      await jobService.startJobAsync(config);
      await flushPromises();

      expect(mockJobEngine.executeJob).toHaveBeenCalledWith(
        config,
        expect.any(Object) // AbortSignal
      );
    });

    it('should return execution ID', async () => {
      const config = { parameters: { count: 5 } };

      const result = await jobService.startJobAsync(config);

      expect(result).toBe(123);
    });

    it('should handle JobRepository save failure', async () => {
      mockJobRepository.saveJobExecution.mockResolvedValue({ success: false });

      const config = { parameters: { count: 5 } };

      await expect(jobService.startJobAsync(config)).rejects.toThrow('Failed to create job execution record');
    });

    it('should update execution status on background error', async () => {
      mockJobEngine.executeJob.mockRejectedValue(new Error('Execution failed'));

      const config = { parameters: { count: 5 } };

      await jobService.startJobAsync(config);
      await flushPromises();

      expect(mockJobRepository.updateJobExecutionStatus).toHaveBeenCalledWith(
        123,
        'failed',
        'job-456',
        'Execution failed'
      );
    });

    it('should set liveProgress to running state', async () => {
      const config = { parameters: { count: 5, variations: 2 } };

      await jobService.startJobAsync(config);

      expect(jobService.liveProgress.state).toBe('running');
      expect(jobService.liveProgress.totalGenerations).toBe(5);
      expect(jobService.liveProgress.variations).toBe(2);
    });
  });

  describe('startJob() rerun API', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
      mockJobRepository.getJobExecution.mockResolvedValue({
        success: true,
        execution: {
          id: 77,
          configurationId: 'cfg-r',
          label: 'Prior',
          startedAt: new Date('2020-01-01')
        }
      });
    });

    it('should fail when databaseExecutionId is not set', async () => {
      const r = await jobService.startJob({ parameters: { count: 1 } });
      expect(r.success).toBe(false);
      expect(mockJobEngine.executeJob).not.toHaveBeenCalled();
    });

    it('should start without saveJobExecution and call JobEngine', async () => {
      jobService.databaseExecutionId = 77;
      jobService.persistedLabel = 'My (Rerun)';

      const r = await jobService.startJob({ parameters: { count: 2 } });
      expect(r.success).toBe(true);
      expect(r.jobId).toBe('77');
      expect(mockJobRepository.saveJobExecution).not.toHaveBeenCalled();
      await flushPromises();
      expect(mockJobEngine.executeJob).toHaveBeenCalled();
    });
  });

  describe('Event Coordination', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should forward progress events from JobEngine', async () => {
      const eventPromise = new Promise((resolve) => {
        jobService.on('progress', (data: any) => {
          expect(data.step).toBe('initialization');
          expect(data.progress).toBe(50);
          resolve(true);
        });
      });

      mockJobEngine.emit('progress', { step: 'initialization', progress: 50 });
      await eventPromise;
    });

    it('should forward image-generated events from JobEngine', async () => {
      const eventPromise = new Promise((resolve) => {
        jobService.on('image-generated', (data: any) => {
          expect(data.image).toBe('image-data');
          resolve(true);
        });
      });

      mockJobEngine.emit('image-generated', { image: 'image-data' });
      await eventPromise;
    });

    it('should forward error events from JobEngine', async () => {
      const eventPromise = new Promise((resolve) => {
        jobService.on('error', (error: any) => {
          expect(error.message).toBe('Test error');
          resolve(true);
        });
      });

      mockJobEngine.emit('error', new Error('Test error'));
      await eventPromise;
    });

    it('should update execution status on JobEngine error (integration)', async () => {
      jobService.on('error', () => {});

      mockJobEngine.executeJob.mockImplementation(async () => {
        mockJobEngine.emit('error', { error: 'Pipeline error' });
        throw new Error('Pipeline error');
      });

      const config = { parameters: { count: 5 } };

      await jobService.startJobAsync(config);
      await flushPromises();

      expect(mockJobRepository.updateJobExecutionStatus).toHaveBeenCalledWith(
        123,
        'failed',
        'job-456',
        'Pipeline error'
      );
    });

    it('should persist final results after executeJob returns (integration)', async () => {
      const approvedRows = Array.from({ length: 5 }, (_, i) => ({
        qcStatus: 'approved',
        imageMappingId: `m${i}`,
        tempImagePath: `/tmp/${i}.png`
      }));
      mockJobEngine.executeJob.mockImplementation(async () => ({
        status: 'completed',
        images: approvedRows,
        totalImages: 5,
        successfulImages: 5,
        failedImages: 0
      }));

      const config = { parameters: { count: 5, variations: 1 } };
      await jobService.startJobAsync(config);
      await flushPromises();

      expect(mockJobRepository.updateJobExecution).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          status: 'completed',
          totalImages: 5,
          successfulImages: 5,
          failedImages: 0
        })
      );
    });
  });

  describe('stopJob()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should return error if no active job', async () => {
      const result = await jobService.stopJob();

      expect(result.success).toBe(false);
      expect(result.message).toBe('No active job to stop');
    });

    it('should abort job execution and update status', async () => {
      mockJobEngine.executeJob.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { status: 'completed' };
      });

      await jobService.startJobAsync({ parameters: { count: 5 } });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stopResult = await jobService.stopJob();

      expect(stopResult.success).toBe(true);
      expect(mockJobRepository.updateJobExecutionStatus).toHaveBeenCalledWith(
        123,
        'stopped',
        'job-456',
        'Job stopped by user'
      );

      await flushPromises();
    });
  });

  describe('getJobStatus()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should return running/idle when called with no args (rerun services)', async () => {
      const idle = await jobService.getJobStatus();
      expect(idle).toEqual({ status: 'idle' });
      expect(mockJobRepository.getJobExecution).not.toHaveBeenCalled();

      (jobService as any).currentExecutionId = 99;
      const running = await jobService.getJobStatus();
      expect(running).toEqual({ status: 'running' });
    });

    it('should delegate to JobRepository', async () => {
      const result = await jobService.getJobStatus(123);

      expect(mockJobRepository.getJobExecution).toHaveBeenCalledWith(123);
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockJobRepository.getJobExecution.mockRejectedValue(new Error('DB error'));

      const result = await jobService.getJobStatus(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('getJobHistory()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should delegate to JobRepository with default limit', async () => {
      await jobService.getJobHistory();

      expect(mockJobRepository.getJobHistory).toHaveBeenCalledWith(50);
    });

    it('should delegate with custom limit', async () => {
      await jobService.getJobHistory(100);

      expect(mockJobRepository.getJobHistory).toHaveBeenCalledWith(100);
    });
  });

  describe('getJobStatistics()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should delegate to JobRepository', async () => {
      const result = await jobService.getJobStatistics();

      expect(mockJobRepository.getJobStatistics).toHaveBeenCalled();
      expect(result.totalJobs).toBe(42);
    });
  });

  describe('updateJobStatistics()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should delegate to JobRepository', async () => {
      await jobService.updateJobStatistics(123);

      expect(mockJobRepository.updateJobExecutionStatistics).toHaveBeenCalledWith(123);
    });
  });

  describe('cleanup()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should abort active job if running', async () => {
      mockJobEngine.executeJob.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { status: 'completed' };
      });

      const config = { parameters: { count: 5 } };
      await jobService.startJobAsync(config);

      const result = await jobService.cleanup();

      expect(result.success).toBe(true);

      await flushPromises();
    });

    it('should remove all event listeners', async () => {
      const initialListenerCount = mockJobEngine.listenerCount('progress');

      await jobService.cleanup();

      expect(mockJobEngine.listenerCount('progress')).toBe(0);
    });
  });
});
