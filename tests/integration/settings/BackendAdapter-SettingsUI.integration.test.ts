import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('BackendAdapter-SettingsUI Integration Tests', () => {
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

  describe('Settings UI Data Structure Alignment', () => {
    it('should provide settings structure that matches SettingsPanel expectations', async () => {
      const result = await backendAdapter.getSettings();
      
      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
      
      const settings = result.settings;
      
      // Check that all required sections exist
      expect(settings.apiKeys).toBeDefined();
      expect(settings.filePaths).toBeDefined();
      expect(settings.parameters).toBeDefined();
      expect(settings.processing).toBeDefined();
      expect(settings.ai).toBeDefined();
      expect(settings.advanced).toBeDefined();
      
      // Check API Keys structure
      expect(settings.apiKeys.openai).toBeDefined();
      expect(settings.apiKeys.piapi).toBeDefined();
      expect(settings.apiKeys.removeBg).toBeDefined();
      
      // Check File Paths structure (Story 1.4 requirements)
      expect(settings.filePaths.outputDirectory).toBeDefined();
      expect(settings.filePaths.tempDirectory).toBeDefined();
      expect(settings.filePaths.systemPromptFile).toBeDefined();
      expect(settings.filePaths.keywordsFile).toBeDefined();
      expect(settings.filePaths.qualityCheckPromptFile).toBeDefined();
      expect(settings.filePaths.metadataPromptFile).toBeDefined();
      
      // Check Parameters structure (Story 1.4 requirements)
      expect(settings.parameters.processMode).toBeDefined();
      expect(settings.parameters.aspectRatios).toBeDefined();
      expect(settings.parameters.mjVersion).toBeDefined();
      expect(settings.parameters.openaiModel).toBeDefined();
      expect(settings.parameters.pollingTimeout).toBeDefined();
      expect(settings.parameters.enablePollingTimeout).toBeDefined();
      expect(settings.parameters.keywordRandom).toBeDefined();
      expect(settings.parameters.count).toBeDefined();
      
      // Check Processing structure (Story 1.4 requirements)
      expect(settings.processing.removeBg).toBeDefined();
      expect(settings.processing.imageConvert).toBeDefined();
      expect(settings.processing.imageEnhancement).toBeDefined();
      expect(settings.processing.sharpening).toBeDefined();
      expect(settings.processing.saturation).toBeDefined();
      expect(settings.processing.convertToJpg).toBeDefined();
      expect(settings.processing.trimTransparentBackground).toBeDefined();
      expect(settings.processing.jpgBackground).toBeDefined();
      expect(settings.processing.jpgQuality).toBeDefined();
      expect(settings.processing.pngQuality).toBeDefined();
      expect(settings.processing.removeBgSize).toBeDefined();
      
      // Check AI structure
      expect(settings.ai.runQualityCheck).toBeDefined();
      expect(settings.ai.runMetadataGen).toBeDefined();
      
      // Check Advanced structure
      expect(settings.advanced.debugMode).toBeDefined();
    });

    it('should save and load settings with Story 1.4 structure', async () => {
      const testSettings = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key',
          removeBg: 'test-removebg-key'
        },
        filePaths: {
          outputDirectory: './test-output',
          tempDirectory: './test-temp',
          systemPromptFile: './test-system-prompt.txt',
          keywordsFile: './test-keywords.txt',
          qualityCheckPromptFile: './test-quality-check.txt',
          metadataPromptFile: './test-metadata.txt'
        },
        parameters: {
          processMode: 'relax',
          aspectRatios: '1:1,16:9',
          mjVersion: '6.1',
          openaiModel: 'gpt-4o',
          pollingTimeout: 20,
          enablePollingTimeout: true,
          keywordRandom: true,
          count: 5
        },
        processing: {
          removeBg: true,
          imageConvert: true,
          imageEnhancement: true,
          sharpening: 7,
          saturation: 1.2,
          convertToJpg: true,
          trimTransparentBackground: true,
          jpgBackground: 'black',
          jpgQuality: 90,
          pngQuality: 95,
          removeBgSize: '4k'
        },
        ai: {
          runQualityCheck: true,
          runMetadataGen: false
        },
        advanced: {
          debugMode: true
        }
      };

      // Save settings
      const saveResult = await backendAdapter.saveSettings(testSettings);
      expect(saveResult.success).toBe(true);

      // Load settings
      const loadResult = await backendAdapter.getSettings();
      expect(loadResult.success).toBe(true);
      
      const loadedSettings = loadResult.settings;
      
      // Verify all fields are preserved
      expect(loadedSettings.apiKeys.openai).toBe(testSettings.apiKeys.openai);
      expect(loadedSettings.filePaths.systemPromptFile).toBe(testSettings.filePaths.systemPromptFile);
      expect(loadedSettings.parameters.enablePollingTimeout).toBe(testSettings.parameters.enablePollingTimeout);
      expect(loadedSettings.parameters.count).toBe(testSettings.parameters.count);
      expect(loadedSettings.processing.imageEnhancement).toBe(testSettings.processing.imageEnhancement);
      expect(loadedSettings.processing.sharpening).toBe(testSettings.processing.sharpening);
      expect(loadedSettings.processing.saturation).toBe(testSettings.processing.saturation);
    });

    it('should handle job execution with Story 1.4 settings structure', async () => {
      const config = {
        apiKeys: {
          openai: 'test-openai-key',
          piapi: 'test-piapi-key',
          removeBg: 'test-removebg-key'
        },
        filePaths: {
          outputDirectory: './test-output',
          tempDirectory: './test-temp',
          systemPromptFile: './test-system-prompt.txt',
          keywordsFile: './test-keywords.txt',
          qualityCheckPromptFile: './test-quality-check.txt',
          metadataPromptFile: './test-metadata.txt'
        },
        parameters: {
          processMode: 'relax',
          aspectRatios: '1:1,16:9',
          mjVersion: '6.1',
          openaiModel: 'gpt-4o',
          pollingTimeout: 15,
          enablePollingTimeout: true,
          keywordRandom: false,
          count: 1
        },
        processing: {
          removeBg: true,
          imageConvert: true,
          imageEnhancement: true,
          sharpening: 5,
          saturation: 1.4,
          convertToJpg: false,
          trimTransparentBackground: true,
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
          debugMode: false
        }
      };

      const result = await backendAdapter.startJob(config);
      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
    });
  });

  describe('IPC Communication Compatibility', () => {
    it('should expose all required methods for Settings UI', () => {
      // These methods should be available via window.electronAPI
      const requiredMethods = [
        'getSettings',
        'saveSettings',
        'getApiKey',
        'setApiKey',
        'selectFile',
        'jobStart',
        'jobStop',
        'jobForceStop'
      ];

      // In a real Electron environment, these would be available via window.electronAPI
      // For this test, we verify the BackendAdapter has these methods
      expect(typeof backendAdapter.getSettings).toBe('function');
      expect(typeof backendAdapter.saveSettings).toBe('function');
      expect(typeof backendAdapter.getApiKey).toBe('function');
      expect(typeof backendAdapter.setApiKey).toBe('function');
      expect(typeof backendAdapter.selectFile).toBe('function');
      expect(typeof backendAdapter.startJob).toBe('function');
      expect(typeof backendAdapter.stopJob).toBe('function');
      expect(typeof backendAdapter.forceStopAll).toBe('function');
    });
  });
});
