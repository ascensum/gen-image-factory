/**
 * BRIDGE INTEGRATION TEST: BackendAdapter Export Shadow Bridge
 * 
 * Purpose: Verify Shadow Bridge routing logic for ExportService extraction.
 * Tests BOTH paths: new ExportService (flag enabled) and legacy (flag disabled).
 * 
 * Coverage Target: 100% of bridge routing logic
 * 
 * ADR-006: Shadow Bridge Pattern with feature toggles
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter Export Bridge Integration Tests', () => {
  let BackendAdapter: any;
  let adapter: any;
  let mockJobExecution: any;
  let mockGeneratedImage: any;
  let mockJobConfig: any;
  let prevCache: Record<string, any> = {};
  let originalEnv: string | undefined;

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
      getJobExecutionsByIds: vi.fn(),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true)
    };

    // Mock GeneratedImage
    mockGeneratedImage = {
      getGeneratedImagesByExecution: vi.fn(),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true)
    };

    set(req.resolve('../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return mockJobConfig; }
    });

    set(req.resolve('../../../src/database/models/JobExecution.js'), {
      JobExecution: function () { return mockJobExecution; }
    });

    set(req.resolve('../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () { return mockGeneratedImage; }
    });

    set(req.resolve('../../../src/services/jobRunner.js'), {
      JobRunner: function () { return { on: vi.fn() }; }
    });

    set(req.resolve('../../../src/services/retryExecutor.js'), function () { return {}; });

    set(req.resolve('../../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () { return {}; }
    });

    set(req.resolve('../../../src/utils/logMasking.js'), {
      safeLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
      }
    });

    // Mock ExcelJS
    const mockWorkbook = {
      addWorksheet: vi.fn().mockReturnValue({
        addRows: vi.fn()
      }),
      xlsx: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        writeBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-excel-data'))
      }
    };

    set(req.resolve('exceljs'), {
      Workbook: vi.fn().mockImplementation(() => mockWorkbook)
    });

    // Mock archiver
    const mockArchive = {
      pipe: vi.fn(),
      append: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined)
    };

    set(req.resolve('archiver'), vi.fn().mockReturnValue(mockArchive));

    // Mock electron
    set(req.resolve('electron'), {
      app: {
        getPath: vi.fn((name: string) => {
          if (name === 'userData') return '/mock/user/data';
          return '/mock/path';
        })
      }
    });

    // Mock fs
    const fs = require('fs');
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    vi.spyOn(fs, 'createWriteStream').mockReturnValue({
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    } as any);
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
    // Save original env
    originalEnv = process.env.FEATURE_MODULAR_EXPORT;

    patchCjs();

    // Setup mock data
    mockJobExecution.getJobExecution.mockResolvedValue({
      success: true,
      execution: {
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
      }
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

    mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
      success: true,
      executions: [
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
        }
      ]
    });

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Load BackendAdapter
    delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
    const backendAdapterModule = req('../../../src/adapter/backendAdapter.js');
    BackendAdapter = backendAdapterModule.BackendAdapter;
    adapter = new BackendAdapter({ skipIpcSetup: true });
    
    // Mock ensureInitialized to avoid initialization issues
    adapter.ensureInitialized = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env.FEATURE_MODULAR_EXPORT;
    } else {
      process.env.FEATURE_MODULAR_EXPORT = originalEnv;
    }

    unpatchCjs();
    vi.restoreAllMocks();
  });

  describe('Shadow Bridge: exportJobToExcel', () => {
    it('should route to ExportService when FEATURE_MODULAR_EXPORT = true', async () => {
      process.env.FEATURE_MODULAR_EXPORT = 'true';

      // Spy on ExportService method
      const exportServiceSpy = vi.spyOn(adapter.exportService, 'exportJobToExcel');

      const result = await adapter.exportJobToExcel(123);

      expect(exportServiceSpy).toHaveBeenCalledWith(123, {});
      expect(result.success).toBe(true);
    });

    it('should route to legacy when FEATURE_MODULAR_EXPORT = false', async () => {
      process.env.FEATURE_MODULAR_EXPORT = 'false';

      // Spy on legacy method
      const legacySpy = vi.spyOn(adapter, '_legacyExportJobToExcel');

      const result = await adapter.exportJobToExcel(123);

      expect(legacySpy).toHaveBeenCalledWith(123, {});
      expect(result.success).toBe(true);
    });

    it('should route to legacy when FEATURE_MODULAR_EXPORT is undefined (default)', async () => {
      delete process.env.FEATURE_MODULAR_EXPORT;

      // Spy on legacy method
      const legacySpy = vi.spyOn(adapter, '_legacyExportJobToExcel');

      const result = await adapter.exportJobToExcel(123);

      expect(legacySpy).toHaveBeenCalledWith(123, {});
      expect(result.success).toBe(true);
    });

    it('should fallback to legacy when ExportService throws error', async () => {
      process.env.FEATURE_MODULAR_EXPORT = 'true';

      // Make ExportService throw error
      vi.spyOn(adapter.exportService, 'exportJobToExcel').mockRejectedValue(new Error('ExportService error'));

      // Spy on legacy method
      const legacySpy = vi.spyOn(adapter, '_legacyExportJobToExcel');

      const result = await adapter.exportJobToExcel(123);

      expect(console.warn).toHaveBeenCalledWith(
        'ExportService.exportJobToExcel failed, falling back to legacy:',
        expect.any(Error)
      );
      expect(legacySpy).toHaveBeenCalledWith(123, {});
      expect(result.success).toBe(true);
    });

    it('should pass options to both ExportService and legacy', async () => {
      const options = {
        outputPath: '/custom/path/export.xlsx',
        duplicatePolicy: 'overwrite'
      };

      // Test ExportService path
      process.env.FEATURE_MODULAR_EXPORT = 'true';
      const exportServiceSpy = vi.spyOn(adapter.exportService, 'exportJobToExcel');

      await adapter.exportJobToExcel(123, options);

      expect(exportServiceSpy).toHaveBeenCalledWith(123, options);

      // Test legacy path
      process.env.FEATURE_MODULAR_EXPORT = 'false';
      const legacySpy = vi.spyOn(adapter, '_legacyExportJobToExcel');

      await adapter.exportJobToExcel(123, options);

      expect(legacySpy).toHaveBeenCalledWith(123, options);
    });
  });

  describe('Shadow Bridge: bulkExportJobExecutions', () => {
    it('should route to ExportService when FEATURE_MODULAR_EXPORT = true', async () => {
      process.env.FEATURE_MODULAR_EXPORT = 'true';

      // Spy on ExportService method
      const exportServiceSpy = vi.spyOn(adapter.exportService, 'bulkExportJobExecutions');

      await adapter.bulkExportJobExecutions([1, 2]);

      expect(exportServiceSpy).toHaveBeenCalledWith([1, 2], {});
    });

    it('should route to legacy when FEATURE_MODULAR_EXPORT = false', async () => {
      process.env.FEATURE_MODULAR_EXPORT = 'false';

      // Spy on legacy method
      const legacySpy = vi.spyOn(adapter, '_legacyBulkExportJobExecutions');

      const result = await adapter.bulkExportJobExecutions([1, 2]);

      expect(legacySpy).toHaveBeenCalledWith([1, 2], {});
      expect(result.success).toBe(true);
    });

    it('should route to legacy when FEATURE_MODULAR_EXPORT is undefined (default)', async () => {
      delete process.env.FEATURE_MODULAR_EXPORT;

      // Spy on legacy method
      const legacySpy = vi.spyOn(adapter, '_legacyBulkExportJobExecutions');

      const result = await adapter.bulkExportJobExecutions([1, 2]);

      expect(legacySpy).toHaveBeenCalledWith([1, 2], {});
      expect(result.success).toBe(true);
    });

    it('should fallback to legacy when ExportService throws error', async () => {
      process.env.FEATURE_MODULAR_EXPORT = 'true';

      // Make ExportService throw error
      vi.spyOn(adapter.exportService, 'bulkExportJobExecutions').mockRejectedValue(new Error('ExportService error'));

      // Spy on legacy method
      const legacySpy = vi.spyOn(adapter, '_legacyBulkExportJobExecutions');

      const result = await adapter.bulkExportJobExecutions([1, 2]);

      expect(console.warn).toHaveBeenCalledWith(
        'ExportService.bulkExportJobExecutions failed, falling back to legacy:',
        expect.any(Error)
      );
      expect(legacySpy).toHaveBeenCalledWith([1, 2], {});
      expect(result.success).toBe(true);
    });

    it('should pass options to both ExportService and legacy', async () => {
      const options = {
        outputPath: '/custom/path/bulk-export.zip',
        duplicatePolicy: 'append'
      };

      // Test ExportService path
      process.env.FEATURE_MODULAR_EXPORT = 'true';
      const exportServiceSpy = vi.spyOn(adapter.exportService, 'bulkExportJobExecutions');

      await adapter.bulkExportJobExecutions([1, 2], options);

      expect(exportServiceSpy).toHaveBeenCalledWith([1, 2], options);

      // Test legacy path
      process.env.FEATURE_MODULAR_EXPORT = 'false';
      const legacySpy = vi.spyOn(adapter, '_legacyBulkExportJobExecutions');

      await adapter.bulkExportJobExecutions([1, 2], options);

      expect(legacySpy).toHaveBeenCalledWith([1, 2], options);
    });
  });

  describe('Behavioral Parity Verification', () => {
    it('should verify routing works correctly for both paths (exportJobToExcel)', async () => {
      // Verify ExportService path is called when flag is true
      process.env.FEATURE_MODULAR_EXPORT = 'true';
      const exportServiceSpy = vi.spyOn(adapter.exportService, 'exportJobToExcel');
      await adapter.exportJobToExcel(123);
      expect(exportServiceSpy).toHaveBeenCalled();

      // Verify legacy path is called when flag is false
      process.env.FEATURE_MODULAR_EXPORT = 'false';
      const legacySpy = vi.spyOn(adapter, '_legacyExportJobToExcel');
      await adapter.exportJobToExcel(123);
      expect(legacySpy).toHaveBeenCalled();
    });

    it('should verify routing works correctly for both paths (bulkExportJobExecutions)', async () => {
      // Verify ExportService path is called when flag is true
      process.env.FEATURE_MODULAR_EXPORT = 'true';
      const exportServiceSpy = vi.spyOn(adapter.exportService, 'bulkExportJobExecutions');
      await adapter.bulkExportJobExecutions([1, 2]);
      expect(exportServiceSpy).toHaveBeenCalled();

      // Verify legacy path is called when flag is false
      process.env.FEATURE_MODULAR_EXPORT = 'false';
      const legacySpy = vi.spyOn(adapter, '_legacyBulkExportJobExecutions');
      await adapter.bulkExportJobExecutions([1, 2]);
      expect(legacySpy).toHaveBeenCalled();
    });
  });

  describe('ExportService Initialization', () => {
    it('should initialize ExportService in constructor with correct dependencies', () => {
      expect(adapter.exportService).toBeDefined();
      expect(adapter.exportService.jobExecution).toBe(adapter.jobExecution);
      expect(adapter.exportService.generatedImage).toBe(adapter.generatedImage);
      expect(adapter.exportService.jobConfig).toBe(adapter.jobConfig);
    });
  });
});
