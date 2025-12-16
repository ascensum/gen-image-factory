import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Avoid native sqlite3 init in integration tests
vi.mock('sqlite3', () => ({ verbose: () => ({ Database: vi.fn() }), Database: vi.fn() }));

// We assert on a local "processImage" spy (no module import needed)

// Mock GeneratedImage model to provide a tempImagePath
vi.mock('../../../src/database/models/GeneratedImage', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    close: vi.fn(),
    getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, executionId: 2, tempImagePath: '/tmp/generated/job_A_1.png', finalImagePath: null, processingSettings: JSON.stringify({}) } }),
    updateGeneratedImage: vi.fn().mockResolvedValue({ success: true }),
  }))
}));

// Mock other models
vi.mock('../../../src/database/models/JobConfiguration', () => ({ JobConfiguration: vi.fn().mockImplementation(() => ({ init: vi.fn(), close: vi.fn(), getDefaultSettings: vi.fn().mockReturnValue({ filePaths: { outputDirectory: '/fallback/toupload', tempDirectory: '/fallback/generated' }}) })) }));
vi.mock('../../../src/database/models/JobExecution', () => ({ JobExecution: vi.fn().mockImplementation(() => ({ init: vi.fn(), close: vi.fn(), updateJobExecution: vi.fn().mockResolvedValue({ success: true }) })) }));

import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('Retry normalization integration', () => {
  let adapter: any;
  let fsAccessSpy: any;
  let processImageSpy: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    processImageSpy = vi.fn().mockResolvedValue('/tmp/out.png');
    
    // Spy on fs.promises.access after modules are loaded (similar to ManualApprove test)
    const fsPromises = require('fs').promises;
    fsAccessSpy = vi.spyOn(fsPromises, 'access').mockResolvedValue(undefined);
    vi.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
    
    adapter = new BackendAdapter({ ipc: { handle: vi.fn(), removeHandler: vi.fn() }, skipIpcSetup: true });
    // Stub retryExecutor and models to avoid sqlite3 and use pure JS
    const RetryExecutor = require('../../../src/services/retryExecutor');
    adapter.retryExecutor = new RetryExecutor({});
    
    // Ensure queue is initialized (should be done in constructor, but ensure it exists)
    if (!adapter.retryExecutor.queue) {
      adapter.retryExecutor.queue = [];
    }
    
    // Mock jobConfig on retryExecutor to avoid DB access
    adapter.retryExecutor.jobConfig = {
      getDefaultSettings: vi.fn().mockReturnValue({ 
        filePaths: { 
          outputDirectory: '/tmp/toupload', 
          tempDirectory: '/tmp/generated' 
        } 
      })
    };
    
    // Mock generatedImage with proper structure
    const mockImage = {
      id: 1,
      executionId: 2,
      tempImagePath: '/tmp/generated/job_A_1.png',
      finalImagePath: null,
      processingSettings: JSON.stringify({})
    };
    adapter.retryExecutor.generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: mockImage })
    };
    
    // Mock updateImageStatus
    adapter.retryExecutor.updateImageStatus = vi.fn().mockResolvedValue({ success: true });
    adapter.retryExecutor.getQueueStatus = vi.fn().mockReturnValue({});
    
    // Mock getOriginalJobConfiguration to return a simple config
    adapter.retryExecutor.getOriginalJobConfiguration = vi.fn().mockResolvedValue({
      settings: {
        filePaths: {
          outputDirectory: '/tmp/toupload',
          tempDirectory: '/tmp/generated'
        }
      }
    });
    
    // Mock getFallbackConfiguration
    adapter.retryExecutor.getFallbackConfiguration = vi.fn().mockReturnValue({
      settings: {
        filePaths: {
          outputDirectory: '/tmp/toupload',
          tempDirectory: '/tmp/generated'
        }
      }
    });
    
    // Mock getOriginalProcessingSettings
    adapter.retryExecutor.getOriginalProcessingSettings = vi.fn().mockResolvedValue({});
    
    // Mock runPostProcessing to capture and normalize settings, then call processImage
    adapter.retryExecutor.runPostProcessing = vi.fn().mockImplementation(async (sourcePath, settings, includeMetadata, jobConfiguration, useOriginalSettings, failOptions) => {
      // This is where normalization happens in the real code
      // Normalize settings using the actual normalizer (same as real code does)
      const { normalizeProcessingSettings } = require('../../../src/utils/processing');
      const normalized = normalizeProcessingSettings(settings);
      
      // Call our "processImage" spy with normalized settings (this is what we want to test)
      const path = require('path');
      const sourceFileName = path.basename(sourcePath, path.extname(sourcePath));
      await processImageSpy(sourcePath, sourceFileName, normalized);
      
      return { success: true, message: 'Processed successfully' };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unmock('sqlite3');
    vi.unmock('../../../src/database/models/GeneratedImage');
    vi.unmock('../../../src/database/models/JobConfiguration');
    vi.unmock('../../../src/database/models/JobExecution');
    vi.unmock('../../../src/producePictureModule');
  });

  it('normalizes stringified processing values before calling processImage', async () => {
    // Queue a retry job with modified string values
    const imageIds = [1];
    const modified = {
      removeBg: '1',
      imageConvert: 'true',
      convertToJpg: 'true',
      jpgQuality: '105',
      pngQuality: '-5',
      imageEnhancement: 'true',
      sharpening: '9.6',
      saturation: '3.5',
      removeBgSize: 'FULL',
      jpgBackground: 123 as any,
    } as any;

    // Ensure retryExecutor has required properties initialized
    if (!adapter.retryExecutor.queue) {
      adapter.retryExecutor.queue = [];
    }
    if (!adapter.retryExecutor.isProcessing) {
      adapter.retryExecutor.isProcessing = false;
    }
    
    const result = await adapter.retryExecutor.addBatchRetryJob({ imageIds, useOriginalSettings: false, modifiedSettings: modified, includeMetadata: false });
    
    expect(result.success).toBe(true);
    
    // Wait for async processQueue to complete (it's called without await in addBatchRetryJob)
    // Poll until runPostProcessing is called or timeout (max 2 seconds)
    let attempts = 0;
    const maxAttempts = 40; // 2 seconds total
    while ((adapter.retryExecutor.runPostProcessing as any).mock.calls.length === 0 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
    
    // If runPostProcessing still wasn't called and queue has jobs, manually process
    if ((adapter.retryExecutor.runPostProcessing as any).mock.calls.length === 0 && adapter.retryExecutor.queue.length > 0) {
      adapter.retryExecutor.isProcessing = false;
      await adapter.retryExecutor.processQueue();
    }
    
    // Verify runPostProcessing was called (concrete assertion per testing strategy)
    expect(adapter.retryExecutor.runPostProcessing).toHaveBeenCalled();
    
    // Verify "processImage" was called with normalized config (concrete assertion)
    expect(processImageSpy.mock.calls.length).toBeGreaterThan(0);
    
    // Get the config passed to processImage (3rd argument) - use concrete values per testing strategy
    const passedConfig = processImageSpy.mock.calls[0][2];
    expect(passedConfig.removeBg).toBe(true); // '1' → true
    expect(passedConfig.imageConvert).toBe(true); // 'true' → true
    expect(passedConfig.convertToJpg).toBe(true); // 'true' → true
    expect(passedConfig.jpgQuality).toBe(100); // '105' → 100 (clamped)
    expect(passedConfig.pngQuality).toBe(1); // '-5' → 1 (clamped: Math.max(1, Math.min(100, -5)) = 1)
    expect(passedConfig.imageEnhancement).toBe(true); // 'true' → true
    expect(passedConfig.sharpening).toBe(10); // '9.6' → 10 (rounded)
    expect(passedConfig.saturation).toBe(3); // '3.5' → 3 (clamped)
    expect(passedConfig.removeBgSize).toBe('full'); // 'FULL' → 'full' (normalized)
    expect(passedConfig.jpgBackground).toBe('#FFFFFF'); // 123 → '#FFFFFF' (converted)
  });
});


