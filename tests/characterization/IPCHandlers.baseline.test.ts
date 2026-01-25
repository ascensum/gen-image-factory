/**
 * CHARACTERIZATION TEST: IPC Handlers Baseline
 * 
 * Purpose: Capture CURRENT behavior of BackendAdapter IPC handler registration BEFORE extraction.
 * This is a SIMPLIFIED baseline test focusing on core handler patterns.
 * 
 * CRITICAL: These tests verify that IPC handlers are registered and delegate correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('IPC Handlers Characterization Tests (Baseline)', () => {
  let BackendAdapter: any;
  let adapter: any;
  let mockIpcMain: any;
  let prevCache: Record<string, any> = {};

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
    set(req.resolve('../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return { init: vi.fn(), getDefaultSettings: () => ({}) }; }
    });
    set(req.resolve('../../src/database/models/JobExecution.js'), {
      JobExecution: function () { return { init: vi.fn() }; }
    });
    set(req.resolve('../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () { return { init: vi.fn() }; }
    });
    set(req.resolve('../../src/services/jobRunner.js'), {
      JobRunner: function () { return { on: vi.fn() }; }
    });
    set(req.resolve('../../src/services/retryExecutor.js'), function () { return {}; });
    set(req.resolve('../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () { return {}; }
    });
    set(req.resolve('../../src/utils/logMasking.js'), {
      safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    });

    // Mock ipcMain
    mockIpcMain = {
      handle: vi.fn(),
      on: vi.fn()
    };

    set(req.resolve('electron'), {
      ipcMain: mockIpcMain,
      app: { getPath: vi.fn(() => '/tmp') }
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
    patchCjs();
    delete req.cache[req.resolve('../../src/adapter/backendAdapter.js')];
    const module = req('../../src/adapter/backendAdapter.js');
    BackendAdapter = module.BackendAdapter;
    
    // Create adapter WITH IPC setup (don't skip)
    adapter = new BackendAdapter({ ipc: mockIpcMain });
  });

  afterEach(() => {
    vi.clearAllMocks();
    unpatchCjs();
  });

  it('should register IPC handlers during construction', () => {
    // Assert: IPC handlers are registered
    expect(mockIpcMain.handle).toHaveBeenCalled();
    expect(mockIpcMain.handle.mock.calls.length).toBeGreaterThan(10);
  });

  it('should register get-api-key handler', () => {
    // Assert: Specific handler is registered
    const calls = mockIpcMain.handle.mock.calls;
    const getApiKeyCall = calls.find((call: any[]) => call[0] === 'get-api-key');
    expect(getApiKeyCall).toBeDefined();
    expect(typeof getApiKeyCall[1]).toBe('function');
  });

  it('should register set-api-key handler', () => {
    const calls = mockIpcMain.handle.mock.calls;
    const setApiKeyCall = calls.find((call: any[]) => call[0] === 'set-api-key');
    expect(setApiKeyCall).toBeDefined();
    expect(typeof setApiKeyCall[1]).toBe('function');
  });

  it('should register settings handlers', () => {
    const calls = mockIpcMain.handle.mock.calls;
    const getSettingsCall = calls.find((call: any[]) => call[0] === 'get-settings');
    const saveSettingsCall = calls.find((call: any[]) => call[0] === 'save-settings');
    
    expect(getSettingsCall).toBeDefined();
    expect(saveSettingsCall).toBeDefined();
  });

  it('should register export handlers', () => {
    const calls = mockIpcMain.handle.mock.calls;
    const exportExcelCall = calls.find((call: any[]) => call[0] === 'job-execution:export-to-excel');
    const exportZipCall = calls.find((call: any[]) => call[0] === 'generated-image:export-zip');
    
    expect(exportExcelCall).toBeDefined();
    expect(exportZipCall).toBeDefined();
  });

  it('should register job execution handlers', () => {
    const calls = mockIpcMain.handle.mock.calls;
    const handlers = ['job-execution:get', 'job-execution:delete', 'job-execution:rename'];
    
    handlers.forEach(handlerName => {
      const handlerCall = calls.find((call: any[]) => call[0] === handlerName);
      expect(handlerCall).toBeDefined();
    });
  });
});
