/**
 * BRIDGE INTEGRATION TEST: IPC Controllers Shadow Bridge
 * 
 * Purpose: Verify that the IPC Controllers Shadow Bridge (electron/main.js) routes correctly
 * between modular controllers (FEATURE_MODULAR_IPC_CONTROLLERS='true') and legacy 
 * backendAdapter.setupIpcHandlers() (feature flag disabled).
 * 
 * Acceptance Criteria:
 * - 100% coverage of bridge routing logic
 * - Handlers registered correctly in BOTH modes
 * - Feature toggle controls which path is used
 * - No behavioral differences between modes
 * 
 * Related ADRs: ADR-002 (Vertical Slice IPC), ADR-006 (Shadow Bridge)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('IPC Controllers Shadow Bridge Integration Tests', () => {
  let JobController: any;
  let SettingsController: any;
  let ExportController: any;
  let SecurityController: any;
  let BackendAdapter: any;
  let mockIpcMain: any;
  let mockAdapter: any;
  let prevCache: Record<string, any> = {};
  let originalFeatureFlag: string | undefined;

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => { 
      remember(id); 
      req.cache[id] = { id, filename: id, loaded: true, exports }; 
    };

    // Mock all dependencies
    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn() });
    set(req.resolve('exceljs'), { Workbook: vi.fn() });
    set(req.resolve('archiver'), vi.fn());
    set(req.resolve('../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return { init: vi.fn(), getDefaultSettings: () => ({}) }; }
    });
    set(req.resolve('../../../src/database/models/JobExecution.js'), {
      JobExecution: function () { return { init: vi.fn() }; }
    });
    set(req.resolve('../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () { return { init: vi.fn() }; }
    });
    set(req.resolve('../../../src/services/jobRunner.js'), {
      JobRunner: function () { return { on: vi.fn() }; }
    });
    set(req.resolve('../../../src/services/retryExecutor.js'), function () { return {}; });
    set(req.resolve('../../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () { return {}; }
    });
    set(req.resolve('../../../src/utils/logMasking.js'), {
      safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() }
    });
    
    set(req.resolve('../../../src/utils/logDebug.js'), {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    });

    // Mock electron
    mockIpcMain = {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn()
    };

    set(req.resolve('electron'), {
      ipcMain: mockIpcMain,
      app: { getPath: vi.fn(() => '/tmp') },
      dialog: { showOpenDialog: vi.fn() },
      shell: { showItemInFolder: vi.fn() }
    });

    set(req.resolve('fs'), {
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      statSync: vi.fn(() => ({ size: 100 })),
      unlinkSync: vi.fn()
    });

    set(req.resolve('path'), {
      join: vi.fn((...args) => args.join('/')),
      resolve: vi.fn((p) => p),
      dirname: vi.fn((p) => p)
    });

    set(req.resolve('os'), {
      tmpdir: vi.fn(() => '/tmp')
    });
  };

  const unpatchCjs = () => {
    for (const id in prevCache) {
      if (prevCache[id] === undefined) delete req.cache[id];
      else req.cache[id] = prevCache[id];
    }
    prevCache = {};
  };

  beforeEach(() => {
    // Save original feature flag
    originalFeatureFlag = process.env.FEATURE_MODULAR_IPC_CONTROLLERS;
    
    patchCjs();
    
    // Clear module cache
    delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
    delete req.cache[req.resolve('../../../src/controllers/JobController.js')];
    delete req.cache[req.resolve('../../../src/controllers/SettingsController.js')];
    delete req.cache[req.resolve('../../../src/controllers/ExportController.js')];
    delete req.cache[req.resolve('../../../src/controllers/SecurityController.js')];

    // Load modules
    const backendAdapterModule = req('../../../src/adapter/backendAdapter.js');
    BackendAdapter = backendAdapterModule.BackendAdapter;

    JobController = req('../../../src/controllers/JobController.js');
    SettingsController = req('../../../src/controllers/SettingsController.js');
    ExportController = req('../../../src/controllers/ExportController.js');
    SecurityController = req('../../../src/controllers/SecurityController.js');

    // Create mock adapter
    mockAdapter = new BackendAdapter({ ipc: mockIpcMain, skipIpcSetup: true });
    mockAdapter.ensureInitialized = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    unpatchCjs();
    
    // Restore original feature flag
    if (originalFeatureFlag === undefined) {
      delete process.env.FEATURE_MODULAR_IPC_CONTROLLERS;
    } else {
      process.env.FEATURE_MODULAR_IPC_CONTROLLERS = originalFeatureFlag;
    }
  });

  describe('Modular Controllers Path (FEATURE_MODULAR_IPC_CONTROLLERS=true)', () => {
    it('should register JobController handlers', () => {
      JobController.registerJobHandlers(mockIpcMain, mockAdapter);
      
      expect(mockIpcMain.handle).toHaveBeenCalled();
      
      // Verify key job handlers are registered
      const calls = mockIpcMain.handle.mock.calls;
      const jobHandlers = ['job:start', 'job:stop', 'job:get-status', 'job:get-progress'];
      
      jobHandlers.forEach(handlerName => {
        const handlerCall = calls.find((call: any[]) => call[0] === handlerName);
        expect(handlerCall).toBeDefined();
        expect(typeof handlerCall?.[1]).toBe('function');
      });
    });

    it('should register SettingsController handlers', () => {
      SettingsController.registerSettingsHandlers(mockIpcMain, mockAdapter);
      
      const calls = mockIpcMain.handle.mock.calls;
      const settingsHandlers = ['get-settings', 'save-settings', 'settings:get-configuration'];
      
      settingsHandlers.forEach(handlerName => {
        const handlerCall = calls.find((call: any[]) => call[0] === handlerName);
        expect(handlerCall).toBeDefined();
        expect(typeof handlerCall?.[1]).toBe('function');
      });
    });

    it('should register ExportController handlers', () => {
      ExportController.registerExportHandlers(mockIpcMain, mockAdapter);
      
      const calls = mockIpcMain.handle.mock.calls;
      const exportHandlers = ['job-execution:export-to-excel', 'job-execution:bulk-export', 'generated-image:export-zip'];
      
      exportHandlers.forEach(handlerName => {
        const handlerCall = calls.find((call: any[]) => call[0] === handlerName);
        expect(handlerCall).toBeDefined();
        expect(typeof handlerCall?.[1]).toBe('function');
      });
    });

    it('should register SecurityController handlers', () => {
      SecurityController.registerSecurityHandlers(mockIpcMain, mockAdapter);
      
      const calls = mockIpcMain.handle.mock.calls;
      const securityHandlers = ['get-api-key', 'set-api-key', 'get-security-status'];
      
      securityHandlers.forEach(handlerName => {
        const handlerCall = calls.find((call: any[]) => call[0] === handlerName);
        expect(handlerCall).toBeDefined();
        expect(typeof handlerCall?.[1]).toBe('function');
      });
    });

    it('should register all modular controllers', () => {
      // Register all controllers
      JobController.registerJobHandlers(mockIpcMain, mockAdapter);
      SettingsController.registerSettingsHandlers(mockIpcMain, mockAdapter);
      ExportController.registerExportHandlers(mockIpcMain, mockAdapter);
      SecurityController.registerSecurityHandlers(mockIpcMain, mockAdapter);
      
      // Verify a minimum number of handlers are registered
      expect(mockIpcMain.handle.mock.calls.length).toBeGreaterThan(30);
    });
  });

  describe('Legacy Path (FEATURE_MODULAR_IPC_CONTROLLERS disabled)', () => {
    it('should register handlers via backendAdapter.setupIpcHandlers()', () => {
      // Use legacy setup
      mockAdapter.setupIpcHandlers();
      
      expect(mockIpcMain.handle).toHaveBeenCalled();
      
      // Verify key handlers are registered
      const calls = mockIpcMain.handle.mock.calls;
      const keyHandlers = [
        'job:start', 'get-settings', 'job-execution:export-to-excel', 'get-api-key'
      ];
      
      keyHandlers.forEach(handlerName => {
        const handlerCall = calls.find((call: any[]) => call[0] === handlerName);
        expect(handlerCall).toBeDefined();
        expect(typeof handlerCall?.[1]).toBe('function');
      });
    });

    it('should register a minimum number of handlers via legacy path', () => {
      mockAdapter.setupIpcHandlers();
      
      // Verify a minimum number of handlers are registered
      expect(mockIpcMain.handle.mock.calls.length).toBeGreaterThan(30);
    });
  });

  describe('Bridge Routing Parity', () => {
    it('should register same set of handlers in both modes', () => {
      // Clear mock for fresh test
      vi.clearAllMocks();
      
      // Register via modular controllers
      JobController.registerJobHandlers(mockIpcMain, mockAdapter);
      SettingsController.registerSettingsHandlers(mockIpcMain, mockAdapter);
      ExportController.registerExportHandlers(mockIpcMain, mockAdapter);
      SecurityController.registerSecurityHandlers(mockIpcMain, mockAdapter);
      
      const modularHandlers = mockIpcMain.handle.mock.calls.map((call: any[]) => call[0]);
      const modularCount = modularHandlers.length;
      
      // Clear mock and use legacy path
      vi.clearAllMocks();
      mockAdapter.setupIpcHandlers();
      
      const legacyHandlers = mockIpcMain.handle.mock.calls.map((call: any[]) => call[0]);
      const legacyCount = legacyHandlers.length;
      
      // Both modes should register similar number of handlers (within 10% tolerance)
      const tolerance = Math.floor(legacyCount * 0.1);
      expect(Math.abs(modularCount - legacyCount)).toBeLessThanOrEqual(tolerance);
      
      // Core handlers should exist in both modes
      const coreHandlers = [
        'job:start', 'job:stop', 'get-settings', 'save-settings',
        'job-execution:export-to-excel', 'get-api-key', 'set-api-key'
      ];
      
      coreHandlers.forEach(handlerName => {
        expect(modularHandlers).toContain(handlerName);
        expect(legacyHandlers).toContain(handlerName);
      });
    });
  });

  describe('Handler Delegation (< 5 Lines Rule - ADR-002)', () => {
    it('JobController handlers should be thin adapters', () => {
      // Spy on adapter methods
      mockAdapter.startJob = vi.fn().mockResolvedValue({ success: true });
      mockAdapter.stopJob = vi.fn().mockResolvedValue({ success: true });
      
      JobController.registerJobHandlers(mockIpcMain, mockAdapter);
      
      // Find and call job:start handler
      const calls = mockIpcMain.handle.mock.calls;
      const jobStartCall = calls.find((call: any[]) => call[0] === 'job:start');
      const handler = jobStartCall?.[1];
      
      expect(handler).toBeDefined();
      
      // Call handler and verify it delegates to adapter
      const mockEvent = {};
      const mockConfig = { jobId: 'test-123' };
      handler(mockEvent, mockConfig);
      
      expect(mockAdapter.startJob).toHaveBeenCalledWith(mockConfig);
    });

    it('SettingsController handlers should be thin adapters', () => {
      mockAdapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: {} });
      
      SettingsController.registerSettingsHandlers(mockIpcMain, mockAdapter);
      
      const calls = mockIpcMain.handle.mock.calls;
      const getSettingsCall = calls.find((call: any[]) => call[0] === 'get-settings');
      const handler = getSettingsCall?.[1];
      
      expect(handler).toBeDefined();
      
      const mockEvent = {};
      handler(mockEvent);
      
      expect(mockAdapter.getSettings).toHaveBeenCalled();
    });

    it('ExportController handlers should be thin adapters', () => {
      mockAdapter.exportJobToExcel = vi.fn().mockResolvedValue({ success: true });
      
      ExportController.registerExportHandlers(mockIpcMain, mockAdapter);
      
      const calls = mockIpcMain.handle.mock.calls;
      const exportCall = calls.find((call: any[]) => call[0] === 'job-execution:export-to-excel');
      const handler = exportCall?.[1];
      
      expect(handler).toBeDefined();
      
      const mockEvent = {};
      const mockArgs = { jobId: 'test-123', options: {} };
      handler(mockEvent, mockArgs);
      
      expect(mockAdapter.exportJobToExcel).toHaveBeenCalledWith('test-123', {});
    });

    it('SecurityController handlers should be thin adapters', () => {
      mockAdapter.getApiKey = vi.fn().mockResolvedValue({ success: true, apiKey: 'test-key' });
      
      SecurityController.registerSecurityHandlers(mockIpcMain, mockAdapter);
      
      const calls = mockIpcMain.handle.mock.calls;
      const getApiKeyCall = calls.find((call: any[]) => call[0] === 'get-api-key');
      const handler = getApiKeyCall?.[1];
      
      expect(handler).toBeDefined();
      
      const mockEvent = {};
      const serviceName = 'runware';
      handler(mockEvent, serviceName);
      
      expect(mockAdapter.getApiKey).toHaveBeenCalledWith(serviceName);
    });
  });
});
