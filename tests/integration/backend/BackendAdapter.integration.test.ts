// Mock external dependencies BEFORE imports to prevent SQLite initialization
import { vi } from 'vitest';

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('fs', () => ({
  promises: {
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('test content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock database models to avoid SQLite crashes
vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobConfiguration: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
    saveJobConfiguration: vi.fn().mockResolvedValue({ success: true, id: 1 }),
  }))
}));

vi.mock('../../../src/database/models/JobExecution', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: {} }),
    saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    getJobExecutions: vi.fn().mockResolvedValue({ success: true, executions: [] }),
  }))
}));

vi.mock('../../../src/database/models/GeneratedImage', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: {} }),
    saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
  }))
}));

// Mock JobRunner to prevent actual job execution
vi.mock('../../../src/services/jobRunner', () => ({
  JobRunner: vi.fn().mockImplementation(() => ({
    startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-1' }),
    stopJob: vi.fn().mockResolvedValue({ success: true }),
    forceStop: vi.fn().mockResolvedValue({ success: true }),
    getJobStatus: vi.fn().mockReturnValue({
      status: 'running',
      progress: 50,
      currentStep: 'processing',
      totalSteps: 4
    }),
    on: vi.fn(),
    emit: vi.fn(),
  }))
}));

// Mock ErrorTranslationService
vi.mock('../../../src/services/errorTranslation', () => ({
  ErrorTranslationService: vi.fn().mockImplementation(() => ({
    translateError: vi.fn().mockReturnValue('Translated error message'),
  }))
}));

// Now import the modules after mocking
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('BackendAdapter Integration Tests', () => {
  let backendAdapter: any;

  beforeEach(() => {
    // Create BackendAdapter with mocked IPC for testing
    backendAdapter = new BackendAdapter({
      ipc: {
        handle: vi.fn(),
        removeHandler: vi.fn(),
      },
      skipIpcSetup: true
    });

    // Mock the database methods to return test data
    vi.spyOn(backendAdapter.jobExecution, 'getJobExecution').mockResolvedValue({
      success: true,
      execution: {
        id: 1,
        configurationId: 1,
        status: 'completed',
        totalImages: 4,
        successfulImages: 4,
        failedImages: 0,
        startedAt: new Date(),
        completedAt: new Date()
      }
    });

    vi.spyOn(backendAdapter.jobExecution, 'saveJobExecution').mockResolvedValue({
      success: true,
      id: 2
    });

    vi.spyOn(backendAdapter.jobConfig, 'getJobConfiguration').mockResolvedValue({
      success: true,
      configuration: {
        id: 1,
        name: 'Test Config',
        settings: {
          apiKeys: { openai: 'test-key' },
          parameters: { processMode: 'relax' }
        }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Single Job Run Functionality', () => {
    it('should start a job with valid configuration', async () => {
      const config = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key',
          removeBg: 'test-removebg-key'
        },
        filePaths: {
          outputDirectory: './test-output',
          tempDirectory: './test-temp',
          logDirectory: './test-logs'
        },
        parameters: {
          processMode: 'relax',
          aspectRatios: '1:1,16:9',
          mjVersion: '6.1',
          openaiModel: 'gpt-4o-mini',
          pollingTimeout: 15,
          keywordRandom: false
        },
        processing: {
          removeBg: false,
          imageConvert: false,
          convertToJpg: false,
          trimTransparentBackground: false,
          jpgBackground: 'white',
          jpgQuality: 100,
          pngQuality: 100,
          removeBgSize: 'auto'
        },
        ai: {
          runQualityCheck: true,
          runMetadataGen: true
        },
        advanced: {
          debugMode: false,
          autoSave: true
        }
      };

      const result = await backendAdapter.startJob(config);
      
      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.message).toBe('Job started successfully');
    });

    it('should reject job start with invalid configuration', async () => {
      const invalidConfig = {
        apiKeys: {
          openai: '', // Missing required API key
          piapi: 'test-piapi-key'
        },
        filePaths: {
          outputDirectory: './test-output'
        },
        parameters: {
          processMode: 'relax'
        },
        processing: {},
        ai: {},
        advanced: {}
      };

      const result = await backendAdapter.startJob(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API key is required');
      expect(result.code).toBe('JOB_CONFIGURATION_ERROR');
    });

    it('should prevent starting multiple jobs simultaneously', async () => {
      const config = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key'
        },
        filePaths: {
          outputDirectory: './test-output'
        },
        parameters: {
          processMode: 'relax'
        },
        processing: {},
        ai: {},
        advanced: {}
      };

      // Start first job
      const result1 = await backendAdapter.startJob(config);
      expect(result1.success).toBe(true);

      // Try to start second job
      const result2 = await backendAdapter.startJob(config);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already running');
      expect(result2.code).toBe('JOB_ALREADY_RUNNING');
    });

    it('should stop a running job', async () => {
      const config = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key'
        },
        filePaths: {
          outputDirectory: './test-output'
        },
        parameters: {
          processMode: 'relax'
        },
        processing: {},
        ai: {},
        advanced: {}
      };

      // Start job
      const startResult = await backendAdapter.startJob(config);
      expect(startResult.success).toBe(true);

      // Stop job
      const stopResult = await backendAdapter.stopJob();
      expect(stopResult.success).toBe(true);
    });

    it('should force stop all jobs', async () => {
      const config = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key'
        },
        filePaths: {
          outputDirectory: './test-output'
        },
        parameters: {
          processMode: 'relax'
        },
        processing: {},
        ai: {},
        advanced: {}
      };

      // Start job
      const startResult = await backendAdapter.startJob(config);
      expect(startResult.success).toBe(true);

      // Force stop all jobs
      const forceStopResult = await backendAdapter.forceStopAll();
      expect(forceStopResult.success).toBe(true);
    });

    it('should track job progress correctly', async () => {
      const config = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key'
        },
        filePaths: {
          outputDirectory: './test-output'
        },
        parameters: {
          processMode: 'relax'
        },
        processing: {},
        ai: {},
        advanced: {}
      };

      // Start job
      const startResult = await backendAdapter.startJob(config);
      expect(startResult.success).toBe(true);

      // Check job status
      const status = backendAdapter.jobRunner.getJobStatus();
      expect(status.status).toBe('running');
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
      expect(status.currentStep).toBeDefined();
      expect(status.totalSteps).toBeDefined();
    });
  });

  describe('Single Job Rerun Functionality', () => {
    it('should rerun a completed job successfully', async () => {
      const result = await backendAdapter.rerunJobExecution(1);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('rerun started');
      expect(result.jobId).toBeDefined();
    });

    it('should reject rerun for running job', async () => {
      // Mock a running job execution
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecution').mockResolvedValue({
        success: true,
        execution: {
          id: 1,
          configurationId: 1,
          status: 'running',
          totalImages: 4,
          successfulImages: 2,
          failedImages: 0,
          startedAt: new Date()
        }
      });

      const result = await backendAdapter.rerunJobExecution(1);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already running');
      expect(result.code).toBe('JOB_ALREADY_RUNNING');
    });

    it('should reject rerun for non-existent job', async () => {
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecution').mockResolvedValue({
        success: false,
        error: 'Job not found'
      });

      const result = await backendAdapter.rerunJobExecution(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.code).toBe('JOB_NOT_FOUND');
    });

    it('should preserve original job configuration during rerun', async () => {
      const result = await backendAdapter.rerunJobExecution(1);
      
      expect(result.success).toBe(true);
      // Verify that the rerun uses the original configuration
      expect(backendAdapter.jobConfig.getJobConfiguration).toHaveBeenCalledWith(1);
    });

    it('should handle rerun with modified configuration', async () => {
      // Test rerun with modified settings
      const modifiedSettings = {
        parameters: { processMode: 'fast' },
        processing: { removeBg: true }
      };

      const result = await backendAdapter.rerunJobExecution(1, modifiedSettings);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('rerun started');
    });
  });

  describe('Bulk Rerun Functionality', () => {
    it('should rerun multiple jobs sequentially', async () => {
      // Mock multiple completed job executions
      const mockJobExecutions = [
        {
          id: 1,
          configurationId: 1,
          status: 'completed',
          totalImages: 4,
          successfulImages: 4,
          failedImages: 0
        },
        {
          id: 2,
          configurationId: 2,
          status: 'completed',
          totalImages: 2,
          successfulImages: 2,
          failedImages: 0
        }
      ];

      // Mock database responses
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutions').mockResolvedValue({
        success: true,
        executions: mockJobExecutions
      });

      const result = await backendAdapter.bulkRerunJobExecutions([1, 2]);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Started rerun of');
      expect(result.jobIds).toEqual([1, 2]);
    });

    it('should reject bulk rerun when job is already running', async () => {
      // Start a job first
      const config = {
        apiKeys: { openai: 'test-key' },
        filePaths: { outputDirectory: './test-output' },
        parameters: { processMode: 'relax' },
        processing: {},
        ai: {},
        advanced: {}
      };

      await backendAdapter.startJob(config);

      // Try bulk rerun
      const result = await backendAdapter.bulkRerunJobExecutions([1, 2]);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot rerun jobs while other jobs are running');
      expect(result.code).toBe('JOB_ALREADY_RUNNING');
    });

    it('should handle partial failures in bulk rerun', async () => {
      // Mock one valid job and one invalid job
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutions').mockResolvedValue({
        success: true,
        executions: [
          {
            id: 1,
            configurationId: 1,
            status: 'completed',
            totalImages: 4,
            successfulImages: 4,
            failedImages: 0
          }
        ]
      });

      const result = await backendAdapter.bulkRerunJobExecutions([1, 999]);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No jobs found for rerun');
    });
  });

  describe('Settings Management', () => {
    it('should get settings', async () => {
      const result = await backendAdapter.getSettings();
      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
    });

    it('should save settings', async () => {
      const settings = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key',
          removeBg: 'test-removebg-key'
        },
        filePaths: {
          outputDirectory: './test-output',
          tempDirectory: './test-temp',
          logDirectory: './test-logs'
        },
        parameters: {
          processMode: 'relax',
          aspectRatios: '1:1,16:9',
          mjVersion: '6.1',
          openaiModel: 'gpt-4o-mini',
          pollingTimeout: 15,
          keywordRandom: false
        },
        processing: {
          removeBg: false,
          imageConvert: false,
          convertToJpg: false,
          trimTransparentBackground: false,
          jpgBackground: 'white',
          jpgQuality: 100,
          pngQuality: 100,
          removeBgSize: 'auto'
        },
        ai: {
          runQualityCheck: true,
          runMetadataGen: true
        },
        advanced: {
          debugMode: false,
          autoSave: true
        }
      };

      const result = await backendAdapter.saveSettings(settings);
      expect(result.success).toBe(true);
    });
  });

  describe('API Key Management', () => {
    it('should set and get API key', async () => {
      const serviceName = 'openai';
      const apiKey = 'test-api-key';

      // Set API key
      const setResult = await backendAdapter.setApiKey(serviceName, apiKey);
      expect(setResult.success).toBe(true);

      // Get API key
      const getResult = await backendAdapter.getApiKey(serviceName);
      expect(getResult.success).toBe(true);
      expect(getResult.apiKey).toBe(apiKey);
    });

    it('should handle unknown service', async () => {
      const result = await backendAdapter.getApiKey('unknown-service');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown service');
    });
  });
});
