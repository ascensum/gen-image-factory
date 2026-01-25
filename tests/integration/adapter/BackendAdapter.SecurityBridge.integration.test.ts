/**
 * Bridge Integration Tests: SecurityService Shadow Bridge
 * 
 * Purpose: Verify the Shadow Bridge routing logic works correctly
 * - Test with FEATURE_MODULAR_SECURITY = 'true' (new SecurityService path)
 * - Test with FEATURE_MODULAR_SECURITY = 'false' (legacy path)
 * - Test fallback behavior when SecurityService fails
 * 
 * Coverage Target: 100% of bridge routing logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter SecurityService Bridge Integration Tests', () => {
  let BackendAdapter: any;
  let adapter: any;
  let mockKeytar: any;
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
    mockKeytar = {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn()
    };
    set(req.resolve('keytar'), mockKeytar);

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
      createTables: vi.fn().mockResolvedValue(true)
    };

    set(req.resolve('../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return mockJobConfig; }
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
      safeLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
      }
    });

    set(req.resolve('electron'), {
      ipcMain: undefined,
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
    originalEnv = process.env.FEATURE_MODULAR_SECURITY;
    patchCjs();
    delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
    delete req.cache[req.resolve('../../../src/services/SecurityService.js')];
  });

  afterEach(() => {
    process.env.FEATURE_MODULAR_SECURITY = originalEnv;
    vi.clearAllMocks();
    unpatchCjs();
  });

  describe('Feature Flag Disabled (Legacy Path)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_SECURITY = 'false';
      const module = req('../../../src/adapter/backendAdapter.js');
      BackendAdapter = module.BackendAdapter;
      adapter = new BackendAdapter({ skipIpcSetup: true });
      adapter.ensureInitialized = vi.fn().mockResolvedValue(true);
    });

    it('should use legacy getApiKey when flag is false', async () => {
      mockKeytar.getPassword.mockResolvedValue('legacy-key');

      const result = await adapter.getApiKey('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('legacy-key');
      expect(result.securityLevel).toBe('native-keychain');
      expect(mockKeytar.getPassword).toHaveBeenCalled();
    });

    it('should use legacy setApiKey when flag is false', async () => {
      mockKeytar.setPassword.mockResolvedValue(undefined);

      const result = await adapter.setApiKey('openai', 'new-key');

      expect(result.success).toBe(true);
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'openai-api-key',
        'new-key'
      );
    });
  });

  describe('Feature Flag Enabled (SecurityService Path)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_SECURITY = 'true';
      const module = req('../../../src/adapter/backendAdapter.js');
      BackendAdapter = module.BackendAdapter;
      adapter = new BackendAdapter({ skipIpcSetup: true });
      adapter.ensureInitialized = vi.fn().mockResolvedValue(true);
    });

    it('should route getApiKey to SecurityService when flag is true', async () => {
      mockKeytar.getPassword.mockResolvedValue('service-key');

      const result = await adapter.getApiKey('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('service-key');
      expect(result.securityLevel).toBe('native-keychain');
      expect(mockKeytar.getPassword).toHaveBeenCalled();
    });

    it('should route setApiKey to SecurityService when flag is true', async () => {
      mockKeytar.setPassword.mockResolvedValue(undefined);

      const result = await adapter.setApiKey('runware', 'service-key');

      expect(result.success).toBe(true);
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'runware-api-key',
        'service-key'
      );
    });

    it('should handle SecurityService database fallback', async () => {
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar unavailable'));
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {
            piapi: 'db-fallback-key'
          }
        }
      });

      const result = await adapter.getApiKey('piapi');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('db-fallback-key');
      expect(result.securityLevel).toBe('plain-text-database');
    });
  });

  describe('Feature Flag Undefined (Default to Legacy)', () => {
    beforeEach(() => {
      delete process.env.FEATURE_MODULAR_SECURITY;
      const module = req('../../../src/adapter/backendAdapter.js');
      BackendAdapter = module.BackendAdapter;
      adapter = new BackendAdapter({ skipIpcSetup: true });
      adapter.ensureInitialized = vi.fn().mockResolvedValue(true);
    });

    it('should default to legacy path when flag is undefined', async () => {
      mockKeytar.getPassword.mockResolvedValue('default-legacy-key');

      const result = await adapter.getApiKey('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('default-legacy-key');
      expect(result.securityLevel).toBe('native-keychain');
    });
  });

  describe('Fallback Behavior (SecurityService Fails)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_SECURITY = 'true';
      const module = req('../../../src/adapter/backendAdapter.js');
      BackendAdapter = module.BackendAdapter;
      adapter = new BackendAdapter({ skipIpcSetup: true });
      adapter.ensureInitialized = vi.fn().mockResolvedValue(true);
    });

    it('should fallback to legacy when SecurityService throws unexpected error', async () => {
      // Simulate SecurityService failure by making it throw
      const originalGetSecret = adapter.securityService.getSecret;
      adapter.securityService.getSecret = vi.fn().mockRejectedValue(new Error('Service crashed'));
      
      // Legacy should still work
      mockKeytar.getPassword.mockResolvedValue('fallback-legacy-key');

      const result = await adapter.getApiKey('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('fallback-legacy-key');
      
      // Restore
      adapter.securityService.getSecret = originalGetSecret;
    });
  });

  describe('Behavioral Parity Verification', () => {
    it('should produce identical results in both modes for successful get', async () => {
      mockKeytar.getPassword.mockResolvedValue('test-key');

      // Test legacy mode
      process.env.FEATURE_MODULAR_SECURITY = 'false';
      delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
      const LegacyAdapter = req('../../../src/adapter/backendAdapter.js').BackendAdapter;
      const legacyAdapter = new LegacyAdapter({ skipIpcSetup: true });
      legacyAdapter.ensureInitialized = vi.fn().mockResolvedValue(true);
      const legacyResult = await legacyAdapter.getApiKey('openai');

      // Test new mode
      mockKeytar.getPassword.mockClear();
      mockKeytar.getPassword.mockResolvedValue('test-key');
      process.env.FEATURE_MODULAR_SECURITY = 'true';
      delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
      delete req.cache[req.resolve('../../../src/services/SecurityService.js')];
      const NewAdapter = req('../../../src/adapter/backendAdapter.js').BackendAdapter;
      const newAdapter = new NewAdapter({ skipIpcSetup: true });
      newAdapter.ensureInitialized = vi.fn().mockResolvedValue(true);
      const newResult = await newAdapter.getApiKey('openai');

      // Results should be identical
      expect(newResult).toEqual(legacyResult);
    });

    it('should produce identical results in both modes for successful set', async () => {
      mockKeytar.setPassword.mockResolvedValue(undefined);

      // Test legacy mode
      process.env.FEATURE_MODULAR_SECURITY = 'false';
      delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
      const LegacyAdapter = req('../../../src/adapter/backendAdapter.js').BackendAdapter;
      const legacyAdapter = new LegacyAdapter({ skipIpcSetup: true });
      const legacyResult = await legacyAdapter.setApiKey('openai', 'test-key');

      // Test new mode
      mockKeytar.setPassword.mockClear();
      mockKeytar.setPassword.mockResolvedValue(undefined);
      process.env.FEATURE_MODULAR_SECURITY = 'true';
      delete req.cache[req.resolve('../../../src/adapter/backendAdapter.js')];
      delete req.cache[req.resolve('../../../src/services/SecurityService.js')];
      const NewAdapter = req('../../../src/adapter/backendAdapter.js').BackendAdapter;
      const newAdapter = new NewAdapter({ skipIpcSetup: true });
      const newResult = await newAdapter.setApiKey('openai', 'test-key');

      // Results should be identical
      expect(newResult).toEqual(legacyResult);
    });
  });
});
