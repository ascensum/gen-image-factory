import { describe, it, expect, beforeEach } from 'vitest';

describe('Path Normalization Regression Tests', () => {
  let mockGetDefaultSettings;

  beforeEach(() => {
    // Mock the JobConfiguration.getDefaultSettings method
    mockGetDefaultSettings = () => ({
      filePaths: {
        outputDirectory: '/Users/test/Desktop/gen-image-factory/pictures/toupload',
        tempDirectory: '/Users/test/Desktop/gen-image-factory/pictures/generated'
      }
    });
  });

  it('should preserve custom paths when they are provided', () => {
    const config = {
      filePaths: {
        outputDirectory: '/Users/test/Desktop/Gen_Image_Factory_ToUpload',
        tempDirectory: '/Users/test/Desktop/Gen_Image_Factory_Generated',
        systemPromptFile: '',
        keywordsFile: '',
        qualityCheckPromptFile: '',
        metadataPromptFile: ''
      }
    };

    const defaultSettings = mockGetDefaultSettings();
    const defaultFilePaths = defaultSettings.filePaths;

    const normalizedConfig = {
      ...config,
      filePaths: {
        ...config.filePaths,
        outputDirectory: config.filePaths.outputDirectory && config.filePaths.outputDirectory.trim() !== '' 
          ? config.filePaths.outputDirectory 
          : defaultFilePaths.outputDirectory,
        tempDirectory: config.filePaths.tempDirectory && config.filePaths.tempDirectory.trim() !== '' 
          ? config.filePaths.tempDirectory 
          : defaultFilePaths.tempDirectory
      }
    };

    expect(normalizedConfig.filePaths.outputDirectory).toBe('/Users/test/Desktop/Gen_Image_Factory_ToUpload');
    expect(normalizedConfig.filePaths.tempDirectory).toBe('/Users/test/Desktop/Gen_Image_Factory_Generated');
  });

  it('should use fallback paths when custom paths are empty strings', () => {
    const config = {
      filePaths: {
        outputDirectory: '',
        tempDirectory: '',
        systemPromptFile: '',
        keywordsFile: '',
        qualityCheckPromptFile: '',
        metadataPromptFile: ''
      }
    };

    const defaultSettings = mockGetDefaultSettings();
    const defaultFilePaths = defaultSettings.filePaths;

    const normalizedConfig = {
      ...config,
      filePaths: {
        ...config.filePaths,
        outputDirectory: config.filePaths.outputDirectory && config.filePaths.outputDirectory.trim() !== '' 
          ? config.filePaths.outputDirectory 
          : defaultFilePaths.outputDirectory,
        tempDirectory: config.filePaths.tempDirectory && config.filePaths.tempDirectory.trim() !== '' 
          ? config.filePaths.tempDirectory 
          : defaultFilePaths.tempDirectory
      }
    };

    expect(normalizedConfig.filePaths.outputDirectory).toBe('/Users/test/Desktop/gen-image-factory/pictures/toupload');
    expect(normalizedConfig.filePaths.tempDirectory).toBe('/Users/test/Desktop/gen-image-factory/pictures/generated');
  });

  it('should handle mixed paths (custom output, empty temp)', () => {
    const config = {
      filePaths: {
        outputDirectory: '/Users/test/Desktop/Gen_Image_Factory_ToUpload',
        tempDirectory: '',
        systemPromptFile: '',
        keywordsFile: '',
        qualityCheckPromptFile: '',
        metadataPromptFile: ''
      }
    };

    const defaultSettings = mockGetDefaultSettings();
    const defaultFilePaths = defaultSettings.filePaths;

    const normalizedConfig = {
      ...config,
      filePaths: {
        ...config.filePaths,
        outputDirectory: config.filePaths.outputDirectory && config.filePaths.outputDirectory.trim() !== '' 
          ? config.filePaths.outputDirectory 
          : defaultFilePaths.outputDirectory,
        tempDirectory: config.filePaths.tempDirectory && config.filePaths.tempDirectory.trim() !== '' 
          ? config.filePaths.tempDirectory 
          : defaultFilePaths.tempDirectory
      }
    };

    expect(normalizedConfig.filePaths.outputDirectory).toBe('/Users/test/Desktop/Gen_Image_Factory_ToUpload');
    expect(normalizedConfig.filePaths.tempDirectory).toBe('/Users/test/Desktop/gen-image-factory/pictures/generated');
  });

  it('should handle mixed paths (empty output, custom temp)', () => {
    const config = {
      filePaths: {
        outputDirectory: '',
        tempDirectory: '/Users/test/Desktop/Gen_Image_Factory_Generated',
        systemPromptFile: '',
        keywordsFile: '',
        qualityCheckPromptFile: '',
        metadataPromptFile: ''
      }
    };

    const defaultSettings = mockGetDefaultSettings();
    const defaultFilePaths = defaultSettings.filePaths;

    const normalizedConfig = {
      ...config,
      filePaths: {
        ...config.filePaths,
        outputDirectory: config.filePaths.outputDirectory && config.filePaths.outputDirectory.trim() !== '' 
          ? config.filePaths.outputDirectory 
          : defaultFilePaths.outputDirectory,
        tempDirectory: config.filePaths.tempDirectory && config.filePaths.tempDirectory.trim() !== '' 
          ? config.filePaths.tempDirectory 
          : defaultFilePaths.tempDirectory
      }
    };

    expect(normalizedConfig.filePaths.outputDirectory).toBe('/Users/test/Desktop/gen-image-factory/pictures/toupload');
    expect(normalizedConfig.filePaths.tempDirectory).toBe('/Users/test/Desktop/Gen_Image_Factory_Generated');
  });

  it('should handle whitespace-only paths as empty', () => {
    const config = {
      filePaths: {
        outputDirectory: '   ',
        tempDirectory: '\t\n',
        systemPromptFile: '',
        keywordsFile: '',
        qualityCheckPromptFile: '',
        metadataPromptFile: ''
      }
    };

    const defaultSettings = mockGetDefaultSettings();
    const defaultFilePaths = defaultSettings.filePaths;

    const normalizedConfig = {
      ...config,
      filePaths: {
        ...config.filePaths,
        outputDirectory: config.filePaths.outputDirectory && config.filePaths.outputDirectory.trim() !== '' 
          ? config.filePaths.outputDirectory 
          : defaultFilePaths.outputDirectory,
        tempDirectory: config.filePaths.tempDirectory && config.filePaths.tempDirectory.trim() !== '' 
          ? config.filePaths.tempDirectory 
          : defaultFilePaths.tempDirectory
      }
    };

    expect(normalizedConfig.filePaths.outputDirectory).toBe('/Users/test/Desktop/gen-image-factory/pictures/toupload');
    expect(normalizedConfig.filePaths.tempDirectory).toBe('/Users/test/Desktop/gen-image-factory/pictures/generated');
  });
});
