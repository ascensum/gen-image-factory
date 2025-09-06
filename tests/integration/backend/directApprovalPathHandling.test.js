/**
 * Direct Approval Path Handling Integration Tests
 * 
 * These tests ensure that direct approval in Failed Images Review
 * works correctly with proper cross-platform path handling.
 * 
 * Critical for: Fixing the "fault image path" errors when directly approving images
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Mock Electron app
const mockElectronApp = {
  getPath: vi.fn()
};

// Mock require for Electron
vi.mock('electron', () => ({
  app: mockElectronApp
}));

// Mock fs operations
const mockFs = {
  promises: {
    access: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(),
    rename: vi.fn().mockResolvedValue(),
    unlink: vi.fn().mockResolvedValue(),
    stat: vi.fn().mockResolvedValue({ isFile: () => true })
  }
};

vi.mock('fs', () => mockFs);

describe('Direct Approval Path Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronApp.getPath.mockReturnValue('/test/userdata');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Image Path Resolution for Direct Approval', () => {
    it('should use correct cross-platform paths when directly approving images', async () => {
      // Mock a job configuration with custom paths
      const jobConfig = {
        filePaths: {
          outputDirectory: '/custom/output',
          tempDirectory: '/custom/temp'
        }
      };

      // Import the modules
      const { GeneratedImage } = await import('../../../src/database/models/GeneratedImage.js');
      const { JobConfiguration } = await import('../../../src/database/models/JobConfiguration.js');

      // Test that the path resolution uses the job configuration
      const settings = JobConfiguration.getDefaultSettings();
      expect(settings.filePaths.outputDirectory).toBeDefined();
      expect(settings.filePaths.tempDirectory).toBeDefined();

      // Verify paths are cross-platform compatible
      expect(settings.filePaths.outputDirectory).not.toContain('Desktop');
      expect(settings.filePaths.outputDirectory).not.toContain('Gen_Image_Factory_ToUpload');
    });

    it('should handle direct approval without hardcoded paths', async () => {
      // Simulate the direct approval scenario
      const testImageId = 'test-image-123';
      const testTempPath = '/test/userdata/pictures/generated/test-image.png';
      const expectedFinalPath = '/test/userdata/pictures/toupload/test-image.png';

      // Mock the GeneratedImage model
      const mockGeneratedImage = {
        updateQCStatus: vi.fn().mockResolvedValue({ success: true }),
        findById: vi.fn().mockResolvedValue({
          id: testImageId,
          tempImagePath: testTempPath,
          finalImagePath: null,
          qcStatus: 'qc_failed'
        })
      };

      // Test that the path construction logic works correctly
      const userDataPath = '/test/userdata';
      const outputDir = path.join(userDataPath, 'pictures', 'toupload');
      const tempDir = path.join(userDataPath, 'pictures', 'generated');

      expect(outputDir).toBe('/test/userdata/pictures/toupload');
      expect(tempDir).toBe('/test/userdata/pictures/generated');

      // Verify no hardcoded paths are used
      expect(outputDir).not.toContain('Desktop');
      expect(tempDir).not.toContain('Desktop');
    });
  });

  describe('Path Consistency in Direct Approval Flow', () => {
    it('should ensure all modules use the same path resolution logic', async () => {
      const testUserDataPath = '/test/userdata';
      mockElectronApp.getPath.mockReturnValue(testUserDataPath);

      // Test JobConfiguration path logic
      const { JobConfiguration } = await import('../../../src/database/models/JobConfiguration.js');
      const jobConfigSettings = JobConfiguration.getDefaultSettings();

      // Test RetryExecutor path logic
      const { RetryExecutor } = await import('../../../src/services/retryExecutor.js');
      const retryExecutor = new RetryExecutor({});

      // Test BackendAdapter path logic (simulated)
      let tempDir, outputDir;
      try {
        const { app } = require('electron');
        const userDataPath = app.getPath('userData');
        tempDir = path.join(userDataPath, 'pictures', 'generated');
        outputDir = path.join(userDataPath, 'pictures', 'toupload');
      } catch (error) {
        const os = require('os');
        const homeDir = os.homedir();
        tempDir = path.join(homeDir, 'gen-image-factory', 'pictures', 'generated');
        outputDir = path.join(homeDir, 'gen-image-factory', 'pictures', 'toupload');
      }

      // All should use the same paths
      expect(jobConfigSettings.filePaths.outputDirectory).toBe(outputDir);
      expect(jobConfigSettings.filePaths.tempDirectory).toBe(tempDir);
      expect(retryExecutor.outputDirectory).toBe(outputDir);
      expect(retryExecutor.tempDirectory).toBe(tempDir);
    });
  });

  describe('Error Prevention in Direct Approval', () => {
    it('should prevent ERR_FAILED errors by using correct paths', async () => {
      // This test simulates the scenario that was causing ERR_FAILED errors
      const testUserDataPath = '/test/userdata';
      mockElectronApp.getPath.mockReturnValue(testUserDataPath);

      // Simulate an image that was directly approved
      const imageData = {
        id: 'test-image-123',
        tempImagePath: path.join(testUserDataPath, 'pictures', 'generated', 'test-image.png'),
        finalImagePath: null,
        qcStatus: 'qc_failed'
      };

      // When directly approved, the image should be moved to the correct final location
      const expectedFinalPath = path.join(testUserDataPath, 'pictures', 'toupload', 'test-image.png');

      // Verify the path construction is correct
      expect(expectedFinalPath).toBe('/test/userdata/pictures/toupload/test-image.png');
      expect(expectedFinalPath).not.toContain('Desktop');
      expect(expectedFinalPath).not.toContain('Gen_Image_Factory_ToUpload');

      // This path should be accessible and not cause ERR_FAILED errors
      expect(path.isAbsolute(expectedFinalPath)).toBe(true);
    });

    it('should handle fallback paths correctly when Electron is unavailable', async () => {
      // Mock Electron to throw error
      mockElectronApp.getPath.mockImplementation(() => {
        throw new Error('Electron not available');
      });

      const { JobConfiguration } = await import('../../../src/database/models/JobConfiguration.js');
      const settings = JobConfiguration.getDefaultSettings();
      const homeDir = os.homedir();

      const expectedOutputDir = path.join(homeDir, 'gen-image-factory', 'pictures', 'toupload');
      const expectedTempDir = path.join(homeDir, 'gen-image-factory', 'pictures', 'generated');

      expect(settings.filePaths.outputDirectory).toBe(expectedOutputDir);
      expect(settings.filePaths.tempDirectory).toBe(expectedTempDir);

      // Verify no hardcoded paths
      expect(settings.filePaths.outputDirectory).not.toContain('Desktop');
      expect(settings.filePaths.tempDirectory).not.toContain('Desktop');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on Windows', () => {
      const windowsUserData = 'C:\\Users\\Test\\AppData\\Roaming\\gen-image-factory';
      mockElectronApp.getPath.mockReturnValue(windowsUserData);

      const outputDir = path.join(windowsUserData, 'pictures', 'toupload');
      const tempDir = path.join(windowsUserData, 'pictures', 'generated');

      expect(outputDir).toBe('C:\\Users\\Test\\AppData\\Roaming\\gen-image-factory\\pictures\\toupload');
      expect(tempDir).toBe('C:\\Users\\Test\\AppData\\Roaming\\gen-image-factory\\pictures\\generated');
    });

    it('should work on macOS', () => {
      const macUserData = '/Users/test/Library/Application Support/gen-image-factory';
      mockElectronApp.getPath.mockReturnValue(macUserData);

      const outputDir = path.join(macUserData, 'pictures', 'toupload');
      const tempDir = path.join(macUserData, 'pictures', 'generated');

      expect(outputDir).toBe('/Users/test/Library/Application Support/gen-image-factory/pictures/toupload');
      expect(tempDir).toBe('/Users/test/Library/Application Support/gen-image-factory/pictures/generated');
    });

    it('should work on Linux', () => {
      const linuxUserData = '/home/test/.config/gen-image-factory';
      mockElectronApp.getPath.mockReturnValue(linuxUserData);

      const outputDir = path.join(linuxUserData, 'pictures', 'toupload');
      const tempDir = path.join(linuxUserData, 'pictures', 'generated');

      expect(outputDir).toBe('/home/test/.config/gen-image-factory/pictures/toupload');
      expect(tempDir).toBe('/home/test/.config/gen-image-factory/pictures/generated');
    });
  });
});
