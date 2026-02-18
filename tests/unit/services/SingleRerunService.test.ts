/**
 * UNIT TEST: SingleRerunService
 *
 * Tests SingleRerunService in isolation with mocked dependencies.
 * Goal: ≥70% coverage, verify interface contracts, test edge cases.
 *
 * Story 3.1 pattern: DI-based; mock jobExecution, jobConfig, jobRunner, saveJobExecution, getSettings.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('SingleRerunService Unit Tests', () => {
  let SingleRerunService: any;
  let service: any;
  let mockJobExecution: any;
  let mockJobConfig: any;
  let mockJobRunner: any;
  let mockSaveJobExecution: any;
  let mockGetSettings: any;

  beforeEach(() => {
    mockJobExecution = {
      getJobExecution: vi.fn(),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true })
    };
    mockJobConfig = {
      getConfigurationById: vi.fn()
    };
    mockJobRunner = {
      getJobStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
      startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'job-1' })
    };
    mockSaveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 2, execution: { id: 2 } });
    mockGetSettings = vi.fn().mockResolvedValue({ settings: { apiKeys: {} } });

    const module = req('../../../src/services/SingleRerunService.js');
    SingleRerunService = module.SingleRerunService;
    service = new SingleRerunService({
      jobExecution: mockJobExecution,
      jobConfig: mockJobConfig,
      jobRunner: mockJobRunner,
      saveJobExecution: mockSaveJobExecution,
      getSettings: mockGetSettings
    });

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('rerunJobExecution', () => {
    const validJobData = {
      success: true,
      execution: {
        id: 1,
        configurationId: 10,
        label: 'Original Job'
      }
    };
    const validConfig = {
      success: true,
      configuration: {
        name: 'My Config',
        settings: {
          parameters: { label: 'Config Label' },
          processing: {}
        }
      }
    };

    it('should return error when job execution is not found', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue({ success: false });

      const result = await service.rerunJobExecution(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job execution not found');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return error when job has no configurationId', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue({
        success: true,
        execution: { id: 1, label: 'No config', configurationId: null }
      });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no configuration');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return error when job configuration is not found', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue(validJobData);
      mockJobConfig.getConfigurationById.mockResolvedValue({ success: false });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Job configuration not found or invalid');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return error when another job is running', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue(validJobData);
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig);
      mockJobRunner.getJobStatus.mockResolvedValue({ status: 'running' });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Another job is currently running');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return error when saveJobExecution fails', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue(validJobData);
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig);
      mockSaveJobExecution.mockResolvedValue({ success: false });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create job execution record');
      expect(mockJobRunner.startJob).not.toHaveBeenCalled();
    });

    it('should return error when startJob fails and mark execution failed', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue(validJobData);
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig);
      mockJobRunner.startJob.mockResolvedValue({ success: false, error: 'Start failed' });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start job rerun');
      expect(mockJobExecution.updateJobExecution).toHaveBeenCalledWith(2, { status: 'failed' });
    });

    it('should succeed and return jobId and newExecutionId when all steps succeed', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue(validJobData);
      mockJobConfig.getConfigurationById.mockResolvedValue(validConfig);

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job rerun started successfully');
      expect(result.jobId).toBe('job-1');
      expect(result.originalJobId).toBe(1);
      expect(result.newExecutionId).toBe(2);
      expect(mockSaveJobExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationId: 10,
          label: 'Config Label (Rerun)',
          status: 'running'
        })
      );
      expect(mockJobRunner.startJob).toHaveBeenCalled();
      expect(service.jobRunner.isRerun).toBe(true);
      expect(service.jobRunner.databaseExecutionId).toBe(2);
    });

    it('should use config name when parameters.label is missing', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue(validJobData);
      mockJobConfig.getConfigurationById.mockResolvedValue({
        success: true,
        configuration: {
          name: 'Named Config',
          settings: { parameters: {}, processing: {} }
        }
      });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(true);
      expect(mockSaveJobExecution).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Named Config (Rerun)' })
      );
    });

    it('should use prior execution label when config has no label or name', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue({
        success: true,
        execution: { id: 1, configurationId: 10, label: 'Prior Label' }
      });
      mockJobConfig.getConfigurationById.mockResolvedValue({
        success: true,
        configuration: { name: '', settings: { parameters: {}, processing: {} } }
      });

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(true);
      expect(mockSaveJobExecution).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Prior Label (Rerun)' })
      );
    });

    it('should return generic error message when unexpected error is thrown', async () => {
      mockJobExecution.getJobExecution.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.rerunJobExecution(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB connection lost');
    });
  });
});
