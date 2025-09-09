import { describe, it, expect, beforeEach, vi } from 'vitest';

// Avoid native sqlite3 init in integration tests
vi.mock('sqlite3', () => ({ verbose: () => ({ Database: vi.fn() }), Database: vi.fn() }));

// Mock electron app.getPath for fallback paths
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/Desktop') }
}));

// Mock fs to avoid real filesystem operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
  }
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

  beforeEach(() => {
    adapter = new BackendAdapter({ ipc: { handle: vi.fn(), removeHandler: vi.fn() }, skipIpcSetup: true });
    // Stub model instances directly to avoid sqlite3 usage fully
    adapter.generatedImage = {
      getGeneratedImage: vi.fn(),
      updateGeneratedImage: vi.fn().mockResolvedValue({ success: true })
    } as any;
    adapter.jobExecution = {
      getJobExecution: vi.fn()
    } as any;
    adapter.jobConfig = {
      getConfiguration: vi.fn(),
      getDefaultSettings: vi.fn().mockReturnValue({ filePaths: { outputDirectory: '/fallback/toupload', tempDirectory: '/fallback/generated' }})
    } as any;
  });

  it('moves temp image to custom outputDirectory and approves', async () => {
    // Arrange: image has only tempImagePath
    const imageId = 123;
    const tempPath = '/tmp/generated/job_X_1.png';
    (adapter.generatedImage.getGeneratedImage as any).mockResolvedValue({ success: true, image: { id: imageId, executionId: 9, tempImagePath: tempPath, finalImagePath: null } });
    (adapter.jobExecution.getJobExecution as any).mockResolvedValue({ success: true, execution: { id: 9, configurationId: 7 }});
    (adapter.jobConfig.getConfiguration as any).mockResolvedValue({ success: true, configuration: { settings: { filePaths: { outputDirectory: '/custom/toupload' }}}});

    const updateSpy = vi.spyOn(adapter.generatedImage, 'updateGeneratedImage');
    const qcSpy = vi.spyOn(adapter, 'updateQCStatus').mockResolvedValue({ success: true } as any);

    // Act
    const result = await adapter.manualApproveImage(imageId);

    // Assert
    expect(result.success).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    const updateArgs = updateSpy.mock.calls[0][1];
    expect(updateArgs.finalImagePath).toBe('/custom/toupload/job_X_1.png');
    expect(updateArgs.tempImagePath).toBeNull();
    expect(qcSpy).toHaveBeenCalledWith(imageId, 'approved', expect.stringContaining('Manually approved'));
  });

  it('falls back to default toupload path when custom missing', async () => {
    const imageId = 456;
    const tempPath = '/tmp/generated/job_Y_2.png';
    (adapter.generatedImage.getGeneratedImage as any).mockResolvedValue({ success: true, image: { id: imageId, executionId: 11, tempImagePath: tempPath, finalImagePath: null } });
    (adapter.jobExecution.getJobExecution as any).mockResolvedValue({ success: true, execution: { id: 11, configurationId: 8 }});
    // Return config without filePaths to trigger fallback
    (adapter.jobConfig.getConfiguration as any).mockResolvedValue({ success: true, configuration: { settings: {} }});

    const updateSpy = vi.spyOn(adapter.generatedImage, 'updateGeneratedImage');
    vi.spyOn(adapter, 'updateQCStatus').mockResolvedValue({ success: true });

    const result = await adapter.manualApproveImage(imageId);
    expect(result.success).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    const finalPath = updateSpy.mock.calls[0][1].finalImagePath as string;
    expect(finalPath.endsWith('/gen-image-factory/pictures/toupload/job_Y_2.png')).toBe(true);
  });
});


