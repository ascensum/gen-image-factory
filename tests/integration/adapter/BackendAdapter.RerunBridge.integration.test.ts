/**
 * BRIDGE INTEGRATION TEST: BackendAdapter Rerun Shadow Bridge
 *
 * Purpose: Verify Shadow Bridge routing logic for SingleRerunService and BulkRerunService.
 * Tests BOTH paths: new services (FEATURE_MODULAR_RERUN enabled) and legacy (flag disabled).
 * Tests fallback when service throws.
 *
 * Coverage Target: 100% of rerun bridge routing logic
 * ADR-006: Shadow Bridge Pattern with feature toggles
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter Rerun Bridge Integration Tests', () => {
  let BackendAdapter: any;
  let adapter: any;
  let mockJobExecution: any;
  let mockJobConfig: any;
  let mockJobRunnerInstance: any;
  let prevCache: Record<string, any> = {};
  let originalRerunEnv: string | undefined;

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => {
      remember(id);
      // Minimal module-like shape for require cache injection in tests
      req.cache[id] = { id, filename: id, loaded: true, exports } as any;
    };

    set(req.resolve('keytar'), {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn()
    });

    mockJobConfig = {
      getSettings: vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: {}, parameters: {}, filePaths: {} } }),
      saveSettings: vi.fn(),
      getDefaultSettings: vi.fn(() => ({ apiKeys: {}, parameters: {}, filePaths: {} })),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true),
      getConfigurationById: vi.fn()
    };

    mockJobExecution = {
      getJobExecution: vi.fn(),
      getJobExecutionsByIds: vi.fn(),
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 2, execution: { id: 2 } }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      init: vi.fn().mockResolvedValue(true),
      createTables: vi.fn().mockResolvedValue(true)
    };

    mockJobRunnerInstance = {
      on: vi.fn(),
      getJobStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
      startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'rerun-job-1' })
    };

    set(req.resolve('../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return mockJobConfig; }
    });

    set(req.resolve('../../../src/database/models/JobExecution.js'), {
      JobExecution: function () { return mockJobExecution; }
    });

    set(req.resolve('../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () {
        return {
          getGeneratedImagesByExecution: vi.fn(),
          init: vi.fn().mockResolvedValue(true),
          createTables: vi.fn().mockResolvedValue(true)
        };
      }
    });

    set(req.resolve('../../../src/services/jobRunner.js'), {
      JobRunner: function () { return mockJobRunnerInstance; }
    });

    set(req.resolve('../../../src/services/retryExecutor.js'), function () { return {}; });
    set(req.resolve('../../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () { return {}; }
    });

    set(req.resolve('../../../src/utils/logMasking.js'), {
      safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    });

    set(req.resolve('electron'), {
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') }
    });
  };

  const unpatchCjs = () => {
    for (const id in prevCache) {
      const cached = prevCache[id];
      if (cached === undefined) delete req.cache[id];
      else req.cache[id] = cached;
    }
    prevCache = {};
  };

  const setupRerunMocks = () => {
    mockJobExecution.getJobExecution.mockResolvedValue({
      success: true,
      execution: { id: 1, configurationId: 10, label: 'Original Job' }
    });
    mockJobExecution.getJobExecutionsByIds.mockResolvedValue({
      success: true,
      executions: [
        { id: 1, label: 'Job 1', status: 'completed', configurationId: 10 }
      ]
    });
    mockJobConfig.getConfigurationById.mockResolvedValue({
      success: true,
      configuration: {
        name: 'Test Config',
        settings: { parameters: { label: 'Test' }, processing: {} }
      }
    });
  };

  beforeEach(() => {
    originalRerunEnv = process.env.FEATURE_MODULAR_RERUN;
    process.env.FEATURE_MODULAR_JOB_SERVICE = 'false';
    patchCjs();
    setupRerunMocks();

    delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
    delete req.cache[req.resolve('../../../src/services/SingleRerunService.js')];
    delete req.cache[req.resolve('../../../src/services/BulkRerunService.js')];

    const backendAdapterModule = req('../../../src/adapter/backendAdapter.js');
    BackendAdapter = backendAdapterModule.BackendAdapter;
    adapter = new BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalRerunEnv === undefined) delete process.env.FEATURE_MODULAR_RERUN;
    else process.env.FEATURE_MODULAR_RERUN = originalRerunEnv;
    unpatchCjs();
    vi.restoreAllMocks();
  });

  describe('Shadow Bridge: rerunJobExecution', () => {
    it('should route to SingleRerunService when FEATURE_MODULAR_RERUN = true', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'true';
      const serviceSpy = vi.spyOn(adapter.singleRerunService, 'rerunJobExecution');

      const result = await adapter.rerunJobExecution(1);

      expect(serviceSpy).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('should route to legacy when FEATURE_MODULAR_RERUN = false', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'false';
      const legacySpy = vi.spyOn(adapter, '_legacyRerunJobExecution');

      const result = await adapter.rerunJobExecution(1);

      expect(legacySpy).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('should route to legacy when FEATURE_MODULAR_RERUN is undefined (default)', async () => {
      delete process.env.FEATURE_MODULAR_RERUN;
      const legacySpy = vi.spyOn(adapter, '_legacyRerunJobExecution');

      const result = await adapter.rerunJobExecution(1);

      expect(legacySpy).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('should fallback to legacy when SingleRerunService throws', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'true';
      vi.spyOn(adapter.singleRerunService, 'rerunJobExecution').mockRejectedValue(new Error('Service crashed'));
      const legacySpy = vi.spyOn(adapter, '_legacyRerunJobExecution');

      const result = await adapter.rerunJobExecution(1);

      expect(legacySpy).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        'SingleRerunService.rerunJobExecution failed, falling back to legacy:',
        expect.any(String)
      );
    });
  });

  describe('Shadow Bridge: bulkRerunJobExecutions', () => {
    it('should route to BulkRerunService when FEATURE_MODULAR_RERUN = true', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'true';
      const serviceSpy = vi.spyOn(adapter.bulkRerunService, 'bulkRerunJobExecutions');

      const result = await adapter.bulkRerunJobExecutions([1]);

      expect(serviceSpy).toHaveBeenCalledWith([1]);
      expect(result.success).toBe(true);
    });

    it('should route to legacy when FEATURE_MODULAR_RERUN = false', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'false';
      const legacySpy = vi.spyOn(adapter, '_legacyBulkRerunJobExecutions');

      const result = await adapter.bulkRerunJobExecutions([1]);

      expect(legacySpy).toHaveBeenCalledWith([1]);
      expect(result.success).toBe(true);
    });

    it('should fallback to legacy when BulkRerunService throws', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'true';
      vi.spyOn(adapter.bulkRerunService, 'bulkRerunJobExecutions').mockRejectedValue(new Error('Bulk service error'));
      const legacySpy = vi.spyOn(adapter, '_legacyBulkRerunJobExecutions');

      const result = await adapter.bulkRerunJobExecutions([1]);

      expect(legacySpy).toHaveBeenCalledWith([1]);
      expect(result.success).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        'BulkRerunService.bulkRerunJobExecutions failed, falling back to legacy:',
        expect.any(String)
      );
    });
  });

  describe('Shadow Bridge: processNextBulkRerunJob', () => {
    it('should route to BulkRerunService when FEATURE_MODULAR_RERUN = true', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'true';
      (global as any).bulkRerunQueue = [];
      const serviceSpy = vi.spyOn(adapter.bulkRerunService, 'processNextBulkRerunJob');

      await adapter.processNextBulkRerunJob();

      expect(serviceSpy).toHaveBeenCalled();
    });

    it('should route to legacy when FEATURE_MODULAR_RERUN = false', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'false';
      (global as any).bulkRerunQueue = [];
      const legacySpy = vi.spyOn(adapter, '_legacyProcessNextBulkRerunJob');

      await adapter.processNextBulkRerunJob();

      expect(legacySpy).toHaveBeenCalled();
    });

    it('should fallback to legacy when BulkRerunService.processNextBulkRerunJob throws', async () => {
      process.env.FEATURE_MODULAR_RERUN = 'true';
      (global as any).bulkRerunQueue = [];
      vi.spyOn(adapter.bulkRerunService, 'processNextBulkRerunJob').mockRejectedValue(new Error('Process next error'));
      const legacySpy = vi.spyOn(adapter, '_legacyProcessNextBulkRerunJob');

      await adapter.processNextBulkRerunJob();

      expect(legacySpy).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        'BulkRerunService.processNextBulkRerunJob failed, falling back to legacy:',
        expect.any(String)
      );
    });
  });

  describe('Rerun services initialization', () => {
    it('should initialize SingleRerunService and BulkRerunService in constructor', () => {
      expect(adapter.singleRerunService).toBeDefined();
      expect(adapter.bulkRerunService).toBeDefined();
      expect(adapter.singleRerunService.rerunJobExecution).toBeDefined();
      expect(adapter.bulkRerunService.bulkRerunJobExecutions).toBeDefined();
      expect(adapter.bulkRerunService.processNextBulkRerunJob).toBeDefined();
    });
  });
});
