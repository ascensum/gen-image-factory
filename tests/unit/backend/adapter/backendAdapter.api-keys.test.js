import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter - API key handling', () => {
  let adapter;
  let keytar;
  let prevKeytarCacheEntry;
  let prevCache = {};
  let prevFeatureFlag;

  async function createAdapter() {
    // Ensure mocks apply even if BackendAdapter is imported elsewhere first
    vi.resetModules();

    // BackendAdapter uses CJS `require('keytar')` at module scope; override Node require cache.
    const keytarMock = {
      getPassword: vi.fn().mockResolvedValue(null),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true),
    };
    keytarMock.default = keytarMock;
    const resolvedKeytar = require.resolve('keytar');
    prevKeytarCacheEntry = require.cache[resolvedKeytar];
    require.cache[resolvedKeytar] = {
      id: resolvedKeytar,
      filename: resolvedKeytar,
      loaded: true,
      exports: keytarMock,
    };

    // BackendAdapter is CJS and uses require() at module scope; patch Node require cache
    // so it never instantiates real sqlite-backed models in this suite.
    const resolvedElectron = req.resolve('electron');
    const resolvedJC = req.resolve('../../../../src/database/models/JobConfiguration');
    const resolvedJE = req.resolve('../../../../src/database/models/JobExecution');
    const resolvedGI = req.resolve('../../../../src/database/models/GeneratedImage');

    prevCache = {
      [resolvedElectron]: req.cache[resolvedElectron],
      [resolvedJC]: req.cache[resolvedJC],
      [resolvedJE]: req.cache[resolvedJE],
      [resolvedGI]: req.cache[resolvedGI],
    };

    req.cache[resolvedElectron] = {
      id: resolvedElectron,
      filename: resolvedElectron,
      loaded: true,
      exports: {
        ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
        app: { getPath: vi.fn(() => '/tmp') },
        dialog: {
          showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
          showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
        },
        shell: { openPath: vi.fn().mockResolvedValue(''), showItemInFolder: vi.fn() },
      },
    };

    req.cache[resolvedJC] = {
      id: resolvedJC,
      filename: resolvedJC,
      loaded: true,
      exports: {
        JobConfiguration: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getSettings: vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'db-key' } } }),
          getDefaultSettings: vi.fn().mockReturnValue({ apiKeys: {} }),
          saveSettings: vi.fn().mockResolvedValue({ success: true }),
        })),
      },
    };
    req.cache[resolvedJE] = {
      id: resolvedJE,
      filename: resolvedJE,
      loaded: true,
      exports: {
        JobExecution: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
        })),
      },
    };
    req.cache[resolvedGI] = {
      id: resolvedGI,
      filename: resolvedGI,
      loaded: true,
      exports: {
        GeneratedImage: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
        })),
      },
    };

    const mod = await import('../../../../src/adapter/backendAdapter');
    return new mod.BackendAdapter({ skipIpcSetup: true });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    // Force legacy path regardless of .env FEATURE_MODULAR_SECURITY setting
    prevFeatureFlag = process.env.FEATURE_MODULAR_SECURITY;
    delete process.env.FEATURE_MODULAR_SECURITY;

    adapter = await createAdapter();

    // Re-require keytar after mocks are active
    keytar = require('keytar');
    // Some environments expose keytar as a default export
    if (keytar && keytar.default) keytar = keytar.default;

    // Make adapter init a no-op for this suite
    adapter.ensureInitialized = vi.fn().mockResolvedValue();
    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'db-key' } } });
  });

  afterEach(() => {
    // Restore feature flag
    if (prevFeatureFlag === undefined) {
      delete process.env.FEATURE_MODULAR_SECURITY;
    } else {
      process.env.FEATURE_MODULAR_SECURITY = prevFeatureFlag;
    }
    vi.resetModules();
    // Restore any require cache patches we made for CJS require() dependencies
    try {
      for (const k of Object.keys(prevCache || {})) {
        if (typeof prevCache[k] === 'undefined') delete req.cache[k];
        else req.cache[k] = prevCache[k];
      }
    } catch {} finally {
      prevCache = {};
    }

    // Restore keytar require cache
    try {
      const resolvedKeytar = require.resolve('keytar');
      if (prevKeytarCacheEntry) {
        require.cache[resolvedKeytar] = prevKeytarCacheEntry;
      } else {
        delete require.cache[resolvedKeytar];
      }
    } catch {
      // ignore
    } finally {
      prevKeytarCacheEntry = undefined;
    }
  });

  it('falls back to database when keytar getPassword fails', async () => {
    keytar.getPassword.mockRejectedValue(new Error('keytar missing'));
    adapter.jobConfig.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'db-key' } } });

    const res = await adapter.getApiKey('openai');

    expect(res.success).toBe(true);
    expect(res.apiKey).toBe('db-key');
    expect(res.securityLevel).toMatch(/database/);
  });

  it('marks encrypted-database when fallback DB key decrypts successfully', async () => {
    keytar.getPassword.mockRejectedValue(new Error('keytar missing'));
    adapter.jobConfig.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'aa:bb:cc' } } });
    const decryptSpy = vi.spyOn(adapter, '_decrypt').mockReturnValue('decrypted-key');

    const res = await adapter.getApiKey('openai');

    expect(decryptSpy).toHaveBeenCalledWith('aa:bb:cc');
    expect(res.success).toBe(true);
    expect(res.apiKey).toBe('decrypted-key');
    expect(res.securityLevel).toBe('encrypted-database');
  });

  it('keeps plain-text-database when fallback DB key looks encrypted but cannot be decrypted', async () => {
    keytar.getPassword.mockRejectedValue(new Error('keytar missing'));
    adapter.jobConfig.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'aa:bb:cc' } } });
    // Decrypt returns original => treated as not decrypted
    vi.spyOn(adapter, '_decrypt').mockReturnValue('aa:bb:cc');

    const res = await adapter.getApiKey('openai');

    expect(res.success).toBe(true);
    expect(res.apiKey).toBe('aa:bb:cc');
    expect(res.securityLevel).toBe('plain-text-database');
  });

  it('errors on unknown service name for getApiKey', async () => {
    const res = await adapter.getApiKey('unknown');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unknown service/);
  });

  it('setApiKey writes via keytar', async () => {
    keytar.setPassword.mockResolvedValue(undefined);

    const res = await adapter.setApiKey('openai', 'abc123');

    expect(res.success).toBe(true);
    expect(keytar.setPassword).toHaveBeenCalledWith('GenImageFactory', 'openai-api-key', 'abc123');
  });

  it('setApiKey falls back to encrypted database for unknown service', async () => {
    // Force fallback path by making keytar operations fail
    keytar.setPassword.mockRejectedValue(new Error('keytar missing'));
    if (keytar.default && keytar.default.setPassword) {
      keytar.default.setPassword.mockRejectedValue(new Error('keytar missing'));
    }

    // Ensure DB fallback has everything it needs
    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: {} } });
    adapter.jobConfig.saveSettings = vi.fn().mockResolvedValue({ success: true });

    const res = await adapter.setApiKey('invalid', 'val');
    expect(res.success).toBe(true);
    expect(res.storage).toBe('encrypted-database');
  });

  it('getSecurityStatus reports fallback when keytar throws', async () => {
    keytar.getPassword.mockRejectedValue(new Error('fail'));

    const res = await adapter.getSecurityStatus();

    expect(res.secureStorage).toBe('unavailable');
    expect(res.fallback).toBe('encrypted-database');
  });
});
