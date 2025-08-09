import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('BackendAdapter Integration Tests', () => {
  let backendAdapter: any;

  beforeEach(() => {
    backendAdapter = new BackendAdapter();
  });

  afterEach(() => {
    // Clean up any running jobs
    if (backendAdapter) {
      backendAdapter.forceStopAll();
    }
  });

  describe('Job Control', () => {
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

      // Wait a bit to ensure job state is set
      await new Promise(resolve => setTimeout(resolve, 50));

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
