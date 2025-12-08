import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';

// Avoid native sqlite3 init in integration tests
vi.mock('sqlite3', () => ({ verbose: () => ({ Database: vi.fn() }), Database: vi.fn() }));

// Mock electron app.getPath for fallback paths
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/Desktop') }
}));

// Mock database models used inside BackendAdapter (prevent sqlite3 load). Must mock BEFORE importing BackendAdapter.
vi.mock('../../../src/database/models/GeneratedImage.js', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getGeneratedImage: vi.fn(),
    updateGeneratedImage: vi.fn().mockResolvedValue({ success: true }),
  }))
}));

vi.mock('../../../src/database/models/JobExecution.js', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobExecution: vi.fn(),
  }))
}));

vi.mock('../../../src/database/models/JobConfiguration.js', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getConfiguration: vi.fn(),
    getDefaultSettings: vi.fn().mockReturnValue({ filePaths: { outputDirectory: '/fallback/toupload', tempDirectory: '/fallback/generated' }})
  }))
}));

// Import after all mocks
import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('Manual Approve Integration', () => {
  let adapter: any;
  let fsMkdirSpy: any;
  let fsRenameSpy: any;

  beforeEach(() => {
    // Spy on fs.promises methods after BackendAdapter is imported
    // This works because BackendAdapter uses require('fs').promises at top level
    // and we need to intercept the actual fs module that was loaded
    const fsPromises = require('fs').promises;
    fsMkdirSpy = vi.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
    fsRenameSpy = vi.spyOn(fsPromises, 'rename').mockResolvedValue(undefined);
    
    adapter = new BackendAdapter({ ipc: { handle: vi.fn(), removeHandler: vi.fn() }, skipIpcSetup: true });
    // Stub initialization
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    // Stub model instances directly to avoid sqlite3 usage fully
    adapter.generatedImage = {
      getGeneratedImage: vi.fn(),
      updateGeneratedImage: vi.fn().mockResolvedValue({ success: true }),
      updateQCStatus: vi.fn().mockResolvedValue({ success: true }) // Add this for updateQCStatus
    } as any;
    adapter.jobExecution = {
      getJobExecution: vi.fn()
    } as any;
    adapter.jobConfig = {
      getConfigurationById: vi.fn(), // Note: method is getConfigurationById, not getConfiguration
      getDefaultSettings: vi.fn().mockReturnValue({ filePaths: { outputDirectory: '/fallback/toupload', tempDirectory: '/fallback/generated' }})
    } as any;
    // Mock getJobConfigurationForImage to avoid complex chain
    adapter.getJobConfigurationForImage = vi.fn();
    // updateQCStatus is a real method that calls this.generatedImage.updateQCStatus
    // We've already mocked generatedImage.updateQCStatus above, so the real method should work
  });

  it('moves temp image to custom outputDirectory and approves', async () => {
    // Arrange: image has only tempImagePath
    const imageId = 123;
    const tempPath = '/tmp/generated/job_X_1.png';
    const executionId = 9;
    const configurationId = 7;
    
    const imageData = { 
      id: imageId, 
      executionId: executionId, 
      tempImagePath: tempPath, 
      finalImagePath: null,
      generationPrompt: 'test prompt',
      qcStatus: 'pending',
      seed: null,
      metadata: null,
      processingSettings: null
    };
    
    // Mock getGeneratedImage - called in manualApproveImage
    (adapter.generatedImage.getGeneratedImage as any).mockResolvedValue({ 
      success: true, 
      image: imageData
    });
    // Mock getJobConfigurationForImage to return config directly
    (adapter.getJobConfigurationForImage as any).mockResolvedValue({ 
      settings: { filePaths: { outputDirectory: '/custom/toupload' }} 
    });

    const updateSpy = vi.spyOn(adapter.generatedImage, 'updateGeneratedImage');
    // Don't spy on updateQCStatus - let the real method run which calls adapter.generatedImage.updateQCStatus
    // We've already mocked adapter.generatedImage.updateQCStatus above

    // Act
    let result;
    try {
      result = await adapter.manualApproveImage(imageId);
    } catch (error: any) {
      console.error('ManualApprove threw exception:', error?.message || error);
      console.error('Stack:', error?.stack);
      throw error;
    }
    
    // Assert
    expect(result).toBeDefined();
    if (!result.success) {
      // Log detailed error information - use console.log so it shows in test output
      console.log('=== ManualApprove Test Failure ===');
      console.log('Result:', result);
      console.log('Result.error:', result.error);
      // fs mocks are inside vi.mock so we can't track them directly
      // But we can check if the error is fs-related
      console.log('updateQCStatus called:', (adapter.generatedImage.updateQCStatus as any).mock?.calls?.length || 0);
      console.log('updateGeneratedImage called:', (adapter.generatedImage.updateGeneratedImage as any).mock?.calls?.length || 0);
      // Fail with detailed message
      throw new Error(`ManualApprove failed: ${result.error || 'Unknown error'}. Result: ${JSON.stringify(result)}`);
    }
    expect(result.success).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    const updateArgs = updateSpy.mock.calls[0][1] as { finalImagePath: string };
    expect(updateArgs.finalImagePath).toBe('/custom/toupload/job_X_1.png');
    // Verify updateQCStatus was called on generatedImage
    expect(adapter.generatedImage.updateQCStatus).toHaveBeenCalledWith(imageId, 'approved', expect.stringContaining('Manually approved'));
    
    // Verify fs operations were called with correct arguments (concrete data per testing strategy)
    expect(fsMkdirSpy).toHaveBeenCalledWith('/custom/toupload', { recursive: true });
    expect(fsRenameSpy).toHaveBeenCalledWith('/tmp/generated/job_X_1.png', '/custom/toupload/job_X_1.png');
  });

  it('falls back to default toupload path when custom missing', async () => {
    const imageId = 456;
    const tempPath = '/tmp/generated/job_Y_2.png';
    const executionId = 11;
    
    const imageData = {
      id: imageId, 
      executionId: executionId, 
      tempImagePath: tempPath, 
      finalImagePath: null,
      generationPrompt: 'test prompt',
      qcStatus: 'pending',
      seed: null,
      metadata: null,
      processingSettings: null
    };
    
    // Mock getGeneratedImage
    (adapter.generatedImage.getGeneratedImage as any).mockResolvedValue({ 
      success: true, 
      image: imageData
    });
    // Mock getJobConfigurationForImage to return null to trigger fallback path
    (adapter.getJobConfigurationForImage as any).mockResolvedValue(null);

    const updateSpy = vi.spyOn(adapter.generatedImage, 'updateGeneratedImage');
    // Don't spy on updateQCStatus - let the real method run

    const result = await adapter.manualApproveImage(imageId);
    expect(result.success).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    const updateArgs = updateSpy.mock.calls[0][1] as { finalImagePath: string };
    const finalPath = updateArgs.finalImagePath;
    // Fallback path uses Desktop or Documents/gen-image-factory/pictures/toupload
    expect(finalPath).toContain('gen-image-factory');
    expect(finalPath).toContain('toupload');
    expect(finalPath).toContain('job_Y_2.png');
    
    // Verify fs operations were called (concrete assertions per testing strategy)
    expect(fsMkdirSpy).toHaveBeenCalled();
    expect(fsRenameSpy).toHaveBeenCalledWith('/tmp/generated/job_Y_2.png', expect.stringContaining('job_Y_2.png'));
  });
});


