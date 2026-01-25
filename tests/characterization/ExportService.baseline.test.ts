/**
 * CHARACTERIZATION TEST: ExportService Baseline
 * 
 * Purpose: Capture CURRENT behavior of BackendAdapter export methods BEFORE extraction.
 * This test documents the EXACT behavior (including quirks) that must be preserved.
 * 
 * CRITICAL: These tests must pass against LEGACY code (backendAdapter.js lines ~1754-2783, ~3224-3404)
 * AND against the new ExportService after extraction (1:1 parity verification).
 * 
 * NO OPTIMIZATIONS - We test what IS, not what SHOULD BE.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'path';

const req = createRequire(import.meta.url);

describe('ExportService Characterization Tests (Baseline)', () => {
  let BackendAdapter: any;
  let adapter: any;
  let mockJobExecution: any;
  let mockGeneratedImage: any;
  let mockJobConfig: any;
  let mockExcelJS: any;
  let mockArchiver: any;
  let prevCache: Record<string, any> = {};

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => { 
      remember(id); 
      req.cache[id] = { id, filename: id, loaded: true, exports }; 
    };

    // Mock keytar
    set(req.resolve('keytar'), {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn()
    });

    // Mock JobConfiguration
    mockJobConfig = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
      getDefaultSettings: vi.fn(() => ({
        apiKeys: {},
        parameters: {},
        filePaths: {}
      })),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true),
      getConfigurationById: vi.fn()
    };

    // Mock JobExecution
    mockJobExecution = {
      getJobExecution: vi.fn(),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true)
    };

    // Mock GeneratedImage
    mockGeneratedImage = {
      getGeneratedImagesByExecution: vi.fn(),
      getGeneratedImage: vi.fn(),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true)
    };

    set(req.resolve('../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return mockJobConfig; }
    });

    set(req.resolve('../../src/database/models/JobExecution.js'), {
      JobExecution: function () { return mockJobExecution; }
    });

    set(req.resolve('../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () { return mockGeneratedImage; }
    });

    set(req.resolve('../../src/services/jobRunner.js'), {
      JobRunner: function () { return { on: vi.fn() }; }
    });

    set(req.resolve('../../src/services/retryExecutor.js'), function () { return {}; });

    set(req.resolve('../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () { return {}; }
    });

    set(req.resolve('../../src/utils/logMasking.js'), {
      safeLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
      }
    });

    // Mock ExcelJS
    const mockWorksheet = {
      addRows: vi.fn(),
      columns: []
    };
    const mockWorkbook = {
      addWorksheet: vi.fn(() => mockWorksheet),
      xlsx: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        writeBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-excel-data'))
      }
    };
    mockExcelJS = {
      Workbook: vi.fn(() => mockWorkbook)
    };
    set(req.resolve('exceljs'), mockExcelJS);

    // Mock archiver
    const mockArchive = {
      pipe: vi.fn(),
      file: vi.fn(),
      append: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined)
    };
    mockArchiver = vi.fn(() => mockArchive);
    set(req.resolve('archiver'), mockArchiver);

    // Mock electron
    set(req.resolve('electron'), {
      ipcMain: undefined,
      app: { 
        getPath: vi.fn((type: string) => {
          if (type === 'userData') return '/mock/userData';
          if (type === 'desktop') return '/mock/desktop';
          return '/tmp';
        })
      }
    });

    // Mock fs module
    const mockFs = {
      existsSync: vi.fn((filePath: string) => {
        // Simulate that written files exist after write
        if (filePath && (filePath.includes('.xlsx') || filePath.includes('.zip'))) {
          return true;
        }
        return false;
      }),
      mkdirSync: vi.fn(),
      unlinkSync: vi.fn(),
      statSync: vi.fn(() => ({ size: 1024 })),
      createWriteStream: vi.fn(() => ({
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'close') setTimeout(cb, 0);
        })
      }))
    };
    set(req.resolve('fs'), mockFs);

    // Mock fs/promises
    set(req.resolve('fs/promises'), {
      access: vi.fn().mockResolvedValue(undefined)
    });
  };

  const unpatchCjs = () => {
    for (const id in prevCache) {
      if (prevCache[id] === undefined) {
        delete req.cache[id];
      } else {
        req.cache[id] = prevCache[id];
      }
    }
    prevCache = {};
  };

  beforeEach(async () => {
    patchCjs();
    
    // Load BackendAdapter with mocked dependencies
    delete req.cache[req.resolve('../../src/adapter/backendAdapter.js')];
    const module = req('../../src/adapter/backendAdapter.js');
    BackendAdapter = module.BackendAdapter;
    
    // Create adapter instance with IPC setup skipped
    adapter = new BackendAdapter({ skipIpcSetup: true });
    
    // Mock ensureInitialized method
    adapter.ensureInitialized = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    unpatchCjs();
  });

  describe('exportJobToExcel() - Baseline Behavior', () => {
    it('should export job execution to Excel successfully', async () => {
      // Arrange
      const mockJob = {
        id: 'job-123',
        label: 'Test Job',
        status: 'completed',
        startedAt: '2026-01-25T10:00:00Z',
        completedAt: '2026-01-25T10:30:00Z',
        totalImages: 10,
        successfulImages: 8,
        failedImages: 2,
        errorMessage: null,
        configurationId: 'config-456'
      };

      const mockImages = [
        {
          id: 'img-1',
          executionId: 'job-123',
          generationPrompt: 'Test prompt',
          seed: '12345',
          qcStatus: 'passed',
          qcReason: null,
          finalImagePath: '/path/to/image1.png',
          createdAt: '2026-01-25T10:15:00Z'
        }
      ];

      mockJobExecution.getJobExecution.mockResolvedValue({
        success: true,
        execution: mockJob
      });

      mockGeneratedImage.getGeneratedImagesByExecution.mockResolvedValue({
        success: true,
        images: mockImages
      });

      mockJobConfig.getConfigurationById.mockResolvedValue({
        success: true,
        configuration: {
          name: 'Test Config',
          createdAt: '2026-01-20T10:00:00Z',
          updatedAt: '2026-01-20T10:00:00Z',
          settings: {}
        }
      });

      // Act
      const result = await adapter.exportJobToExcel('job-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.filePath).toBeTruthy();
      expect(result.filename).toBeTruthy();
      expect(result.message).toContain('Export created successfully');
      expect(mockJobExecution.getJobExecution).toHaveBeenCalledWith('job-123');
      expect(mockGeneratedImage.getGeneratedImagesByExecution).toHaveBeenCalledWith('job-123');
    });

    it('should return error when job execution not found', async () => {
      // Arrange
      mockJobExecution.getJobExecution.mockResolvedValue({
        success: false
      });

      // Act
      const result = await adapter.exportJobToExcel('invalid-job');

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to get job execution'
      });
    });

    it('should handle export with custom output path', async () => {
      // Arrange
      const mockJob = {
        id: 'job-123',
        label: 'Test Job',
        status: 'completed',
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0
      };

      mockJobExecution.getJobExecution.mockResolvedValue({
        success: true,
        execution: mockJob
      });

      mockGeneratedImage.getGeneratedImagesByExecution.mockResolvedValue({
        success: true,
        images: []
      });

      const options = {
        outputPath: '/custom/path/export.xlsx'
      };

      // Act
      const result = await adapter.exportJobToExcel('job-123', options);

      // Assert: Legacy behavior appends (n) when file exists
      expect(result.success).toBe(true);
      expect(result.filePath).toContain('export');
      expect(result.filePath).toContain('.xlsx');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockJobExecution.getJobExecution.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await adapter.exportJobToExcel('job-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('createZipExport() - Baseline Behavior', () => {
    it('should create ZIP export successfully', async () => {
      // Arrange
      const mockImage = {
        id: 'img-1',
        finalImagePath: '/path/to/image1.png',
        metadata: JSON.stringify({
          title: 'Test Image',
          description: 'Test description',
          uploadTags: 'tag1, tag2'
        }),
        createdAt: '2026-01-25T10:15:00Z'
      };

      mockGeneratedImage.getGeneratedImage.mockResolvedValue({
        success: true,
        image: mockImage
      });

      // Act
      const result = await adapter.createZipExport(['img-1'], true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.zipPath).toBeTruthy();
      expect(result.message).toBe('ZIP export created successfully');
      expect(mockGeneratedImage.getGeneratedImage).toHaveBeenCalledWith('img-1');
    });

    it('should return error when no image IDs provided', async () => {
      // Act
      const result = await adapter.createZipExport([]);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'No image IDs provided'
      });
    });

    it('should return error when imageIds is not an array', async () => {
      // Act
      const result = await adapter.createZipExport(null as any);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'No image IDs provided'
      });
    });

    it('should create ZIP without Excel metadata when includeExcel is false', async () => {
      // Arrange
      const mockImage = {
        id: 'img-1',
        finalImagePath: '/path/to/image1.png',
        metadata: '{}',
        createdAt: '2026-01-25T10:15:00Z'
      };

      mockGeneratedImage.getGeneratedImage.mockResolvedValue({
        success: true,
        image: mockImage
      });

      // Act
      const result = await adapter.createZipExport(['img-1'], false);

      // Assert
      expect(result.success).toBe(true);
      // Verify Excel workbook was not created
      expect(mockExcelJS.Workbook).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockGeneratedImage.getGeneratedImage.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await adapter.createZipExport(['img-1']);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle custom output path', async () => {
      // Arrange
      const mockImage = {
        id: 'img-1',
        finalImagePath: '/path/to/image1.png',
        metadata: '{}',
        createdAt: '2026-01-25T10:15:00Z'
      };

      mockGeneratedImage.getGeneratedImage.mockResolvedValue({
        success: true,
        image: mockImage
      });

      const options = {
        outputPath: '/custom/path/export.zip'
      };

      // Act
      const result = await adapter.createZipExport(['img-1'], true, options);

      // Assert: Legacy behavior appends (n) when file exists
      expect(result.success).toBe(true);
      expect(result.zipPath).toContain('export');
      expect(result.zipPath).toContain('.zip');
    });
  });

  describe('Edge Cases - Baseline Behavior', () => {
    it('should handle job with no images', async () => {
      // Arrange
      const mockJob = {
        id: 'job-123',
        label: 'Empty Job',
        status: 'completed',
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0
      };

      mockJobExecution.getJobExecution.mockResolvedValue({
        success: true,
        execution: mockJob
      });

      mockGeneratedImage.getGeneratedImagesByExecution.mockResolvedValue({
        success: true,
        images: []
      });

      // Act
      const result = await adapter.exportJobToExcel('job-123');

      // Assert
      expect(result.success).toBe(true);
      // Should still create Excel file with job summary only
    });

    it('should handle images with missing file paths', async () => {
      // Arrange
      const mockImage = {
        id: 'img-1',
        finalImagePath: null,
        tempImagePath: null,
        metadata: '{}',
        createdAt: '2026-01-25T10:15:00Z'
      };

      mockGeneratedImage.getGeneratedImage.mockResolvedValue({
        success: true,
        image: mockImage
      });

      // Act
      const result = await adapter.createZipExport(['img-1']);

      // Assert
      // Should succeed but skip the image with missing path
      expect(result.success).toBe(true);
    });
  });
});
