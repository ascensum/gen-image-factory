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
      expect(mockJobEngine.listenerCount('job-complete')).toBeGreaterThan(0);
    });
  });

  describe('startJob()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
    });

    it('should validate configuration is required', async () => {
      await expect(jobService.startJob(null)).rejects.toThrow('Job configuration is required');
    });

    it('should create job execution record via JobRepository', async () => {
      const config = { parameters: { count: 5 } };
      const options = { configurationId: 'cfg-1', label: 'Test Job' };

      await jobService.startJob(config, options);

      expect(mockJobRepository.saveJobExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationId: 'cfg-1',
          label: 'Test Job',
          status: 'running'
        })
      );
    });

    it('should execute job via JobEngine', async () => {
      const config = { parameters: { count: 5 } };

      await jobService.startJob(config);

      expect(mockJobEngine.executeJob).toHaveBeenCalledWith(
        config,
        expect.any(Object) // AbortSignal
      );
    });

    it('should return execution tracking info', async () => {
      const config = { parameters: { count: 5 } };

      const result = await jobService.startJob(config);

      expect(result.success).toBe(true);
      expect(result.executionId).toBe(123);
      expect(result.jobId).toBe('job-456');
      expect(result.result).toBeDefined();
    });

    it('should handle JobRepository save failure', async () => {
      mockJobRepository.saveJobExecution.mockResolvedValue({ success: false });

      const config = { parameters: { count: 5 } };

      await expect(jobService.startJob(config)).rejects.toThrow('Failed to create job execution record');
    });

    it('should update execution status on error', async () => {
      mockJobEngine.executeJob.mockRejectedValue(new Error('Execution failed'));

      const config = { parameters: { count: 5 } };

      await expect(jobService.startJob(config)).rejects.toThrow('Execution failed');
      expect(mockJobRepository.updateJobExecutionStatus).toHaveBeenCalledWith(
        123,
        'failed',
        'job-456',
        'Execution failed'
      );
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
      // Configure mock to emit error during execution
      mockJobEngine.executeJob.mockImplementation(async () => {
        // Simulate error during execution
        mockJobEngine.emit('error', new Error('Pipeline error'));
        throw new Error('Pipeline error');
      });

      const config = { parameters: { count: 5 } };

      // Start job (will fail)
      await jobService.startJob(config).catch(() => {});

      // Verify status update was called with failed status
      expect(mockJobRepository.updateJobExecutionStatus).toHaveBeenCalledWith(
        123,
        'failed',
        'job-456',
        'Pipeline error'
      );
    });

    it('should persist final results on job-complete event (integration)', async () => {
      // Configure mock to emit job-complete during execution
      mockJobEngine.executeJob.mockImplementation(async () => {
        const result = {
          status: 'completed',
          totalImages: 10,
          successfulImages: 8,
          failedImages: 2
        };
        mockJobEngine.emit('job-complete', result);
        return result;
      });

      const config = { parameters: { count: 5 } };
      await jobService.startJob(config);

      // Verify final update
      expect(mockJobRepository.updateJobExecution).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          status: 'completed',
          totalImages: 10,
          successfulImages: 8,
          failedImages: 2
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
      // Configure mock to delay execution so we can stop it
      let abortSignal: any;
      mockJobEngine.executeJob.mockImplementation(async (config, signal) => {
        abortSignal = signal;
        // Delay execution
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { status: 'completed' };
      });

      // Start a job (non-blocking)
      const startPromise = jobService.startJob({ parameters: { count: 5 } });

      // Wait a bit for job to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Stop the job
      const stopResult = await jobService.stopJob();

      expect(stopResult.success).toBe(true);
      expect(mockJobRepository.updateJobExecutionStatus).toHaveBeenCalledWith(
        123,
        'stopped',
        'job-456',
        'Job stopped by user'
      );

      // Clean up
      await startPromise.catch(() => {});
    });
  });

  describe('getJobStatus()', () => {
    beforeEach(() => {
      jobService = new JobService({
        jobEngine: mockJobEngine,
        jobRepository: mockJobRepository
      });
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
      // Start a job
      const config = { parameters: { count: 5 } };
      const startPromise = jobService.startJob(config);

      // Cleanup
      const result = await jobService.cleanup();

      expect(result.success).toBe(true);

      // Clean up
      await startPromise.catch(() => {});
    });

    it('should remove all event listeners', async () => {
      const initialListenerCount = mockJobEngine.listenerCount('progress');

      await jobService.cleanup();

      expect(mockJobEngine.listenerCount('progress')).toBe(0);
    });
  });
});
