import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('BackendAdapter (unit) file dialogs + path validation', () => {
  let prevElectronCacheEntry: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unmock('keytar');
    vi.unmock('fs');
    vi.unmock('../../../../src/database/models/JobConfiguration');
    vi.unmock('../../../../src/database/models/JobExecution');
    vi.unmock('../../../../src/database/models/GeneratedImage');
    vi.unmock('../../../../src/services/jobRunner');
    vi.unmock('../../../../src/services/retryExecutor');

    // Restore Node require cache for electron (we override it in loadAdapter)
    try {
      const resolved = require.resolve('electron');
      if (prevElectronCacheEntry) {
        require.cache[resolved] = prevElectronCacheEntry;
      } else {
        delete require.cache[resolved];
      }
    } catch {
      // ignore
    } finally {
      prevElectronCacheEntry = undefined;
    }
  });

  async function loadAdapter(overrides: {
    electron?: any;
    fs?: any;
  } = {}) {
    vi.unmock('keytar');
    vi.unmock('fs');

    vi.doMock('keytar', () => ({
      getPassword: vi.fn().mockResolvedValue(null),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true),
    }));

    // BackendAdapter uses Node `require('electron')` inside some methods (selectFile/openExportsFolder).
    // To reliably control this in Vitest, override Node's require cache for the 'electron' module id.
    const baseElectron = {
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') },
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
        showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
      },
      shell: {
        openPath: vi.fn().mockResolvedValue(''),
        showItemInFolder: vi.fn(),
      },
    };
    const e = overrides.electron || {};
    const mergedElectron = {
      ...baseElectron,
      ...e,
      app: { ...baseElectron.app, ...(e.app || {}) },
      dialog: { ...baseElectron.dialog, ...(e.dialog || {}) },
      shell: { ...baseElectron.shell, ...(e.shell || {}) },
    };
    const resolvedElectron = require.resolve('electron');
    prevElectronCacheEntry = require.cache[resolvedElectron];
    require.cache[resolvedElectron] = {
      id: resolvedElectron,
      filename: resolvedElectron,
      loaded: true,
      exports: mergedElectron,
    };

    vi.doMock('fs', () => overrides.fs ?? ({
      promises: { stat: vi.fn() },
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
    }));

    // Avoid sqlite init in unit tests
    vi.doMock('../../../../src/database/models/JobConfiguration', () => ({
      JobConfiguration: vi.fn().mockImplementation(() => ({
        getSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
        saveSettings: vi.fn().mockResolvedValue({ success: true }),
      })),
    }));
    vi.doMock('../../../../src/database/models/JobExecution', () => ({
      JobExecution: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock('../../../../src/database/models/GeneratedImage', () => ({
      GeneratedImage: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock('../../../../src/services/jobRunner', () => ({
      JobRunner: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
    }));
    vi.doMock('../../../../src/services/retryExecutor', () => ({
      default: vi.fn().mockImplementation(() => ({})),
    }));

    const mod = await import('../../../../src/adapter/backendAdapter');
    return new mod.BackendAdapter({ skipIpcSetup: true }) as any;
  }

  it('selectFile(save) returns chosen file path and supports cancel', async () => {
    const dialog = {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn()
        .mockResolvedValueOnce({ canceled: false, filePath: '/tmp/out.zip' })
        .mockResolvedValueOnce({ canceled: true, filePath: undefined }),
    };
    const adapter = await loadAdapter({ electron: { ipcMain: undefined, dialog, shell: {}, app: {} } });

    await expect(adapter.selectFile({ mode: 'save', fileTypes: ['.zip'] }))
      .resolves
      .toEqual({ success: true, filePath: '/tmp/out.zip' });

    await expect(adapter.selectFile({ type: 'save' }))
      .resolves
      .toEqual({ success: false, canceled: true });

    expect(dialog.showSaveDialog).toHaveBeenCalled();
  });

  it('selectFile(open) returns the first selected path and maps extensions', async () => {
    const dialog = {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.txt'] }),
      showSaveDialog: vi.fn(),
    };
    const adapter = await loadAdapter({ electron: { ipcMain: undefined, dialog, shell: {}, app: {} } });

    await expect(adapter.selectFile({ type: 'file', fileTypes: ['.txt', 'csv'] }))
      .resolves
      .toEqual({ success: true, filePath: '/tmp/a.txt' });

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({
      properties: ['openFile'],
      filters: expect.arrayContaining([
        expect.objectContaining({ name: 'Supported Files', extensions: ['txt', 'csv'] }),
      ]),
    }));
  });

  it('validatePath handles required, type mismatch, and file type filtering', async () => {
    const stat = vi.fn()
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false }) // mismatch for file
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true }) // ok for file
      .mockRejectedValueOnce(new Error('no access')); // non-existent

    const adapter = await loadAdapter({
      fs: { promises: { stat }, existsSync: vi.fn(() => true), mkdirSync: vi.fn() },
    });

    await expect(adapter.validatePath('', 'file', ['.txt']))
      .resolves
      .toEqual({ isValid: false, message: 'Path is required' });

    await expect(adapter.validatePath('/tmp', 'file', []))
      .resolves
      .toEqual({ isValid: false, message: 'Path must be a file' });

    await expect(adapter.validatePath('/tmp/a.exe', 'file', ['.txt']))
      .resolves
      .toEqual(expect.objectContaining({ isValid: false }));

    await expect(adapter.validatePath('/missing', 'directory', []))
      .resolves
      .toEqual({ isValid: false, message: 'Path does not exist or is not accessible' });
  });

  it('openExportsFolder creates directory and opens it via shell', async () => {
    const shell = { openPath: vi.fn().mockResolvedValue('') };
    const base = `/tmp/gen-image-factory-test-${Date.now()}`;
    const app = { getPath: vi.fn(() => base) };

    const adapter = await loadAdapter({
      electron: { ipcMain: undefined, app, shell, dialog: {} },
    });

    const res = await adapter.openExportsFolder();
    expect(res).toEqual({ success: true, message: 'Exports folder opened' });
    expect(shell.openPath).toHaveBeenCalledWith(`${base}/exports`);
  });

  it('openExportsFolder returns error when shell.openPath fails', async () => {
    const shell = { openPath: vi.fn().mockRejectedValue(new Error('perm')) };
    const base = `/tmp/gen-image-factory-test-${Date.now()}`;
    const app = { getPath: vi.fn(() => base) };

    const adapter = await loadAdapter({
      electron: { ipcMain: undefined, app, shell, dialog: {} },
    });

    const res = await adapter.openExportsFolder();
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('perm');
  });
});

