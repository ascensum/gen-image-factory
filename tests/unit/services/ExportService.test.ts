/**
 * UNIT TEST: ExportService
 * 
 * Tests the ExportService in isolation with mocked dependencies.
 * Goal: ≥70% coverage, verify interface contracts, test edge cases.
 * 
 * Dependencies injected via constructor (ADR-003):
 * - jobExecution
 * - generatedImage
 * - jobConfig
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'path';
import fs from 'fs';

const req = createRequire(import.meta.url);

describe('ExportService Unit Tests', () => {
  let ExportService: any;
  let exportService: any;
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

    // Mock ExcelJS
    mockExcelJS = {
      Workbook: vi.fn().mockImplementation(() => ({
        addWorksheet: vi.fn().mockReturnValue({
          addRows: vi.fn()
        }),
        xlsx: {
          writeFile: vi.fn().mockResolvedValue(undefined),
          writeBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-excel-data'))
        }
      }))
    };

    // Mock archiver
    mockArchiver = vi.fn().mockReturnValue({
      pipe: vi.fn(),
      append: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined)
    });

    // Mock electron
    set(req.resolve('electron'), {
      app: {
        getPath: vi.fn((name: string) => {
          if (name === 'userData') return '/mock/user/data';
          if (name === 'desktop') return '/mock/desktop';
          return '/mock/path';
        })
      }
    });

    set(req.resolve('exceljs'), mockExcelJS);
    set(req.resolve('archiver'), mockArchiver);
  };

  const unpatchCjs = () => {
    for (const id in prevCache) {
      const cached = prevCache[id];
      if (cached === undefined) delete req.cache[id];
      else req.cache[id] = cached;
    }
    prevCache = {};
  };

  beforeEach(() => {
    patchCjs();

    // Mock dependencies
    mockJobExecution = {
      getJobExecution: vi.fn(),
      getJobExecutionsByIds: vi.fn()
    };

    mockGeneratedImage = {
      getGeneratedImagesByExecution: vi.fn()
    };

    mockJobConfig = {
      getConfigurationById: vi.fn()
    };

    // Load ExportService
    delete req.cache[req.resolve('../../../src/services/ExportService.js')];
    ExportService = req('../../../src/services/ExportService.js');
    exportService = new ExportService(mockJobExecution, mockGeneratedImage, mockJobConfig);

    // Mock fs operations
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    vi.spyOn(fs, 'createWriteStream').mockReturnValue({
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    } as any);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    unpatchCjs();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should inject dependencies via constructor (ADR-003)', () => {
      expect(exportService.jobExecution).toBe(mockJobExecution);
      expect(exportService.generatedImage).toBe(mockGeneratedImage);
      expect(exportService.jobConfig).toBe(mockJobConfig);
    });
  });

  describe('exportJobToExcel', () => {
    const mockJob = {
      id: 123,
      label: 'Test Job',
      status: 'completed',
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T01:00:00.000Z',
      totalImages: 10,
      successfulImages: 8,
      failedImages: 2,
      errorMessage: null,
      configurationId: 456,
      configurationSnapshot: null
    };

    const mockImages = [
      {
        id: 1,
        executionId: 123,
        generationPrompt: 'Test prompt',
        seed: '12345',
        qcStatus: 'approved',
        qcReason: null,
        finalImagePath: '/path/to/image.png',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    ];

    const mockConfig = {
      name: 'Test Config',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      settings: {
        parameters: {
          runwareModel: 'test-model'
        },
        processing: {
          removeBg: true
        }
      }
    };

    beforeEach(() => {
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
        configuration: mockConfig
      });
    });

    it('should export job to Excel successfully', async () => {
      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeTruthy();
      expect(result.filename).toBeTruthy();
      expect(result.message).toContain('Export created successfully');
    });

    it('should return error when job execution fetch fails', async () => {
      mockJobExecution.getJobExecution.mockResolvedValue({
        success: false,
        error: 'Job not found'
      });

      const result = await exportService.exportJobToExcel(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get job execution');
    });

    it('should handle missing job configuration gracefully', async () => {
      mockJobConfig.getConfigurationById.mockResolvedValue({
        success: false,
        error: 'Config not found'
      });

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(true);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle job configuration fetch error', async () => {
      mockJobConfig.getConfigurationById.mockRejectedValue(new Error('Database error'));

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(true);
      expect(console.warn).toHaveBeenCalledWith('Could not load job configuration:', expect.any(Error));
    });

    it('should handle empty images array', async () => {
      mockGeneratedImage.getGeneratedImagesByExecution.mockResolvedValue({
        success: true,
        images: []
      });

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(true);
    });

    it('should handle custom output path with options', async () => {
      const options = {
        outputPath: '/custom/path/export.xlsx',
        duplicatePolicy: 'overwrite'
      };

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // directory doesn't exist
        .mockReturnValueOnce(true)  // file exists after write
        .mockReturnValue(true);

      const result = await exportService.exportJobToExcel(123, options);

      expect(result.success).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should handle duplicate file with append policy', async () => {
      const options = {
        outputPath: '/custom/path/export.xlsx',
        duplicatePolicy: 'append'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await exportService.exportJobToExcel(123, options);

      expect(result.success).toBe(true);
    });

    it('should return error when export file creation fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true) // dir exists
        .mockReturnValueOnce(false); // file doesn't exist after write

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export file was not created successfully');
    });

    it('should return error when export file is empty', async () => {
      vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as any);

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export file is empty');
    });

    it('should use configurationSnapshot when available', async () => {
      const jobWithSnapshot = {
        ...mockJob,
        configurationSnapshot: {
          parameters: {
            runwareModel: 'snapshot-model'
          }
        }
      };

      mockJobExecution.getJobExecution.mockResolvedValue({
        success: true,
        execution: jobWithSnapshot
      });

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(true);
    });

    it('should filter out sensitive API keys from export', async () => {
      const configWithApiKeys = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          apiKeys: {
            runware: 'secret-key'
          }
        }
      };

      mockJobConfig.getConfigurationById.mockResolvedValue({
        success: true,
        configuration: configWithApiKeys
      });

      const result = await exportService.exportJobToExcel(123);

      expect(result.success).toBe(true);
      // API keys should be filtered out by _flattenSettings
    });
  });

  describe('bulkExportJobExecutions', () => {
    const mockJobs = [
      {
        id: 1,
        label: 'Job 1',
        status: 'completed',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T01:00:00.000Z',
        totalImages: 5,
        successfulImages: 5,
        failedImages: 0,
        errorMessage: null,
        configurationId: 1
      },
      {
        id: 2,
        label: 'Job 2',
        status: 'completed',
        startedAt: '2024-01-02T00:00:00.000Z',
        completedAt: '2024-01-02T01:00:00.000Z',
        totalImages: 3,
        successfulImages: 3,
        failedImages: 0,
        errorMessage: null,
        configurationId: 2
      }
    ];

    beforeEach(() => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: mockJobs
      });

      mockGeneratedImage.getGeneratedImagesByExecution.mockResolvedValue({
        success: true,
        images: []
      });

      mockJobConfig.getConfigurationById.mockResolvedValue({
        success: true,
        configuration: {
          name: 'Test Config',
          settings: {}
        }
      });
    });

    it('should export multiple jobs to ZIP successfully', async () => {
      const result = await exportService.bulkExportJobExecutions([1, 2]);

      expect(result.success).toBe(true);
      expect(result.exportedFiles).toHaveLength(2);
      expect(result.totalJobs).toBe(2);
      expect(result.successfulExports).toBe(2);
      expect(result.message).toContain('Successfully exported 2 out of 2 jobs');
    });

    it('should return error when jobs fetch fails', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const result = await exportService.bulkExportJobExecutions([1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve jobs for export');
    });

    it('should return error when no jobs found', async () => {
      mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
        success: true,
        executions: []
      });

      const result = await exportService.bulkExportJobExecutions([1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No jobs found for export');
    });

    it('should handle individual job export failures gracefully', async () => {
      mockGeneratedImage.getGeneratedImagesByExecution
        .mockResolvedValueOnce({ success: true, images: [] })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await exportService.bulkExportJobExecutions([1, 2]);

      expect(result.success).toBe(true);
      expect(result.successfulExports).toBe(1); // Only first job exported
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return error when all jobs fail to export', async () => {
      mockGeneratedImage.getGeneratedImagesByExecution.mockRejectedValue(new Error('Database error'));

      const result = await exportService.bulkExportJobExecutions([1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to export any jobs');
    });

    it('should handle custom output path with options', async () => {
      const options = {
        outputPath: '/custom/path/bulk-export.zip',
        duplicatePolicy: 'overwrite'
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await exportService.bulkExportJobExecutions([1, 2], options);

      expect(result.success).toBe(true);
    });

    it('should include summary text file in ZIP', async () => {
      const result = await exportService.bulkExportJobExecutions([1, 2]);

      expect(result.success).toBe(true);
      expect(mockArchiver).toHaveBeenCalled();
      const archiveInstance = mockArchiver.mock.results[0].value;
      expect(archiveInstance.append).toHaveBeenCalledWith(
        expect.stringContaining('Bulk Export Summary'),
        { name: 'export_summary.txt' }
      );
    });
  });

  describe('_formatSettingLabel (private helper)', () => {
    it('should format known parameter keys', () => {
      expect(exportService._formatSettingLabel('parameters.runwareModel')).toBe('Runware Model');
      expect(exportService._formatSettingLabel('processing.removeBg')).toBe('Remove Background');
      expect(exportService._formatSettingLabel('ai.runQualityCheck')).toBe('Run Quality Check');
    });

    it('should format unknown keys by humanizing camelCase', () => {
      expect(exportService._formatSettingLabel('customSetting')).toBe('Custom Setting');
      expect(exportService._formatSettingLabel('parameters.customValue')).toBe('Custom Value');
    });
  });

  describe('_flattenSettings (private helper)', () => {
    it('should flatten nested objects', () => {
      const settings = {
        parameters: {
          runwareModel: 'test-model',
          runwareAdvanced: {
            CFGScale: 7
          }
        },
        processing: {
          removeBg: true
        }
      };

      const flattened = exportService._flattenSettings(settings);

      expect(flattened).toContainEqual(['parameters.runwareModel', 'test-model']);
      expect(flattened).toContainEqual(['parameters.runwareAdvanced.CFGScale', 7]);
      expect(flattened).toContainEqual(['processing.removeBg', true]);
    });

    it('should handle empty objects', () => {
      const flattened = exportService._flattenSettings({});
      expect(flattened).toEqual([]);
    });

    it('should handle arrays as leaf values', () => {
      const settings = {
        items: [1, 2, 3]
      };

      const flattened = exportService._flattenSettings(settings);
      expect(flattened).toContainEqual(['items', [1, 2, 3]]);
    });
  });

  describe('_createJobSummaryData (private helper)', () => {
    it('should create job summary with config', () => {
      const job = {
        id: 123,
        label: 'Test Job',
        status: 'completed',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T01:00:00.000Z',
        totalImages: 10,
        successfulImages: 8,
        failedImages: 2,
        errorMessage: null,
        configurationId: 456,
        configurationSnapshot: null
      };

      const config = {
        name: 'Test Config',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        settings: {
          parameters: {
            runwareModel: 'test-model'
          }
        }
      };

      const summaryData = exportService._createJobSummaryData(job, config);

      expect(summaryData).toBeTruthy();
      expect(summaryData[0]).toContain('Job ID');
      expect(summaryData[0]).toContain('Configuration Name');
      expect(summaryData[1]).toContain(123);
      expect(summaryData[1]).toContain('Test Job');
      expect(summaryData[1]).toContain('Test Config');
    });

    it('should create job summary without config', () => {
      const job = {
        id: 123,
        label: 'Test Job',
        status: 'completed',
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T01:00:00.000Z',
        totalImages: 10,
        successfulImages: 8,
        failedImages: 2,
        errorMessage: null,
        configurationId: null,
        configurationSnapshot: null
      };

      const summaryData = exportService._createJobSummaryData(job, null);

      expect(summaryData).toBeTruthy();
      expect(summaryData[0]).toContain('Job ID');
      expect(summaryData[0]).not.toContain('Configuration Name');
    });
  });

  describe('_createImagesData (private helper)', () => {
    it('should create images data array', () => {
      const images = [
        {
          id: 1,
          executionId: 123,
          generationPrompt: 'Test prompt',
          seed: '12345',
          qcStatus: 'approved',
          qcReason: null,
          finalImagePath: '/path/to/image.png',
          createdAt: '2024-01-01T00:00:00.000Z'
        }
      ];

      const imagesData = exportService._createImagesData(images);

      expect(imagesData).toBeTruthy();
      expect(imagesData[0]).toContain('Image ID');
      expect(imagesData[1]).toContain(1);
      expect(imagesData[1]).toContain('Test prompt');
    });

    it('should handle images with null values', () => {
      const images = [
        {
          id: 1,
          executionId: 123,
          generationPrompt: null,
          seed: null,
          qcStatus: null,
          qcReason: null,
          finalImagePath: null,
          createdAt: null
        }
      ];

      const imagesData = exportService._createImagesData(images);

      expect(imagesData).toBeTruthy();
      expect(imagesData[1]).toContain('N/A');
    });
  });
});
