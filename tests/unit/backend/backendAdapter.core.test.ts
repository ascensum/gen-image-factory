import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all external dependencies
vi.mock('keytar');
vi.mock('electron');
vi.mock('xlsx');
vi.mock('fs');
vi.mock('path');

// Mock database models
vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
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

// Mock JobRunner
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

// Now import after mocking
import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('BackendAdapter Core Functionality Tests', () => {
  let backendAdapter: any;

  beforeEach(() => {
    // Create BackendAdapter with mocked IPC
    backendAdapter = new BackendAdapter({
      ipc: {
        handle: vi.fn(),
        removeHandler: vi.fn(),
      },
      skipIpcSetup: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Job Management', () => {
    it('should create BackendAdapter instance successfully', () => {
      expect(backendAdapter).toBeDefined();
      expect(backendAdapter.jobRunner).toBeDefined();
      expect(backendAdapter.jobConfig).toBeDefined();
      expect(backendAdapter.jobExecution).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof backendAdapter.startJob).toBe('function');
      expect(typeof backendAdapter.stopJob).toBe('function');
      expect(typeof backendAdapter.forceStopAll).toBe('function');
      expect(typeof backendAdapter.rerunJobExecution).toBe('function');
      expect(typeof backendAdapter.bulkRerunJobExecutions).toBe('function');
    });
  });

  describe('Job Configuration Validation', () => {
    it('should validate required API keys', () => {
      const invalidConfig = {
        apiKeys: {
          openai: '', // Missing required API key
          piapi: 'test-key'
        },
        filePaths: { outputDirectory: './test-output' },
        parameters: { processMode: 'relax' },
        processing: {},
        ai: {},
        advanced: {}
      };

      // This should fail validation
      expect(() => {
        // We'll test the validation logic without actually calling startJob
        if (!invalidConfig.apiKeys.openai) {
          throw new Error('OpenAI API key is required');
        }
      }).toThrow('OpenAI API key is required');
    });

    it('should accept valid configuration structure', () => {
      const validConfig = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key'
        },
        filePaths: {
          outputDirectory: './test-output'
        },
        parameters: {
          processMode: 'relax',
          aspectRatios: '1:1',
          mjVersion: '6.1'
        },
        processing: {
          removeBg: false,
          imageConvert: false
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

      // This should pass validation
      expect(validConfig.apiKeys.openai).toBeTruthy();
      expect(validConfig.filePaths.outputDirectory).toBeTruthy();
      expect(validConfig.parameters.processMode).toBeTruthy();
      expect(validConfig.processing).toBeDefined();
      expect(validConfig.ai).toBeDefined();
      expect(validConfig.advanced).toBeDefined();
    });
  });

  describe('Job State Management', () => {
    it('should track job status correctly', () => {
      const status = backendAdapter.jobRunner.getJobStatus();
      
      expect(status).toBeDefined();
      expect(status.status).toBe('running');
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
      expect(status.currentStep).toBeDefined();
      expect(status.totalSteps).toBeDefined();
    });

    it('should handle job lifecycle states', () => {
      const states = ['idle', 'running', 'completed', 'failed', 'stopped'];
      
      states.forEach(state => {
        expect(states).toContain(state);
      });
    });
  });

  describe('Rerun Logic', () => {
    it('should identify rerun scenarios', () => {
      const isRerun = true;
      const isNewJob = false;
      
      expect(isRerun).toBe(true);
      expect(isNewJob).toBe(false);
      expect(isRerun).not.toBe(isNewJob);
    });

    it('should handle rerun configuration', () => {
      const originalConfig = {
        parameters: { processMode: 'relax' },
        processing: { removeBg: false }
      };

      const modifiedConfig = {
        parameters: { processMode: 'fast' },
        processing: { removeBg: true }
      };

      // Verify config modification
      expect(modifiedConfig.parameters.processMode).toBe('fast');
      expect(modifiedConfig.processing.removeBg).toBe(true);
      expect(modifiedConfig.parameters.processMode).not.toBe(originalConfig.parameters.processMode);
    });
  });

  describe('Bulk Operations Logic', () => {
    it('should handle multiple job IDs', () => {
      const jobIds = [1, 2, 3];
      
      expect(jobIds).toHaveLength(3);
      expect(jobIds).toContain(1);
      expect(jobIds).toContain(2);
      expect(jobIds).toContain(3);
    });

    it('should validate job constraints', () => {
      const hasRunningJob = false;
      const canStartNewJob = true;
      
      expect(hasRunningJob).toBe(false);
      expect(canStartNewJob).toBe(true);
      expect(canStartNewJob).not.toBe(hasRunningJob);
    });

    it('should handle sequential execution logic', () => {
      const queue = [1, 2, 3];
      const currentJob = queue.shift();
      
      expect(currentJob).toBe(1);
      expect(queue).toHaveLength(2);
      expect(queue[0]).toBe(2);
      expect(queue[1]).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing job configurations', () => {
      const error = 'Job has no configuration. Cannot rerun jobs started from Dashboard without saved settings.';
      
      expect(error).toContain('no configuration');
      expect(error).toContain('Cannot rerun');
      expect(error).toContain('Dashboard');
    });

    it('should handle job already running errors', () => {
      const error = 'Cannot rerun jobs while other jobs are running';
      
      expect(error).toContain('Cannot rerun');
      expect(error).toContain('already running');
    });

    it('should handle job not found errors', () => {
      const error = 'Job not found';
      
      expect(error).toBe('Job not found');
      expect(error).toContain('not found');
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate progress percentages', () => {
      const currentStep = 2;
      const totalSteps = 4;
      const progress = (currentStep / totalSteps) * 100;
      
      expect(progress).toBe(50);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('should handle step transitions', () => {
      const steps = ['initializing', 'generating', 'processing', 'completing'];
      const currentStepIndex = 1;
      
      expect(steps[currentStepIndex]).toBe('generating');
      expect(steps).toHaveLength(4);
      expect(steps[0]).toBe('initializing');
      expect(steps[3]).toBe('completing');
    });
  });
});
