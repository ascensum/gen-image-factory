/**
 * CHARACTERIZATION TEST: SecurityService Baseline
 * 
 * Purpose: Capture CURRENT behavior of BackendAdapter security methods BEFORE extraction.
 * This test documents the EXACT behavior (including quirks) that must be preserved.
 * 
 * CRITICAL: These tests must pass against LEGACY code (backendAdapter.js lines ~50-150)
 * AND against the new SecurityService after extraction (1:1 parity verification).
 * 
 * NO OPTIMIZATIONS - We test what IS, not what SHOULD BE.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('SecurityService Characterization Tests (Baseline)', () => {
  let BackendAdapter: any;
  let adapter: any;
  let mockKeytar: any;
  let mockJobConfig: any;
  let prevCache: Record<string, any> = {};

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

    set(req.resolve('../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () { return mockJobConfig; }
    });

    set(req.resolve('../../src/database/models/JobExecution.js'), {
      JobExecution: function () { 
        return {
          init: vi.fn().mockResolvedValue(true),
          createTables: vi.fn().mockResolvedValue(true)
        }; 
      }
    });

    set(req.resolve('../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () { 
        return {
          init: vi.fn().mockResolvedValue(true),
          createTables: vi.fn().mockResolvedValue(true)
        }; 
      }
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

    set(req.resolve('electron'), {
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') }
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

  describe('getApiKey() - Baseline Behavior', () => {
    it('should return API key from keytar when available', async () => {
      // Arrange: keytar has the key
      mockKeytar.getPassword.mockResolvedValue('test-api-key-123');

      // Act
      const result = await adapter.getApiKey('openai');

      // Assert: Exact response structure from legacy code
      expect(result).toEqual({
        success: true,
        apiKey: 'test-api-key-123',
        securityLevel: 'native-keychain'
      });
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('GenImageFactory', 'openai-api-key');
    });

    it('should return error for unknown service name', async () => {
      // Act
      const result = await adapter.getApiKey('invalid-service');

      // Assert: Legacy behavior returns error object
      expect(result).toEqual({
        success: false,
        error: 'Unknown service: invalid-service'
      });
      expect(mockKeytar.getPassword).not.toHaveBeenCalled();
    });

    it('should fallback to database when keytar returns null', async () => {
      // Arrange: keytar returns null, DB has encrypted key
      mockKeytar.getPassword.mockResolvedValue(null);
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {
            openai: 'db-plain-key'
          }
        }
      });

      // Act
      const result = await adapter.getApiKey('openai');

      // Assert: Fallback to database
      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('db-plain-key');
      expect(result.securityLevel).toBe('plain-text-database');
      expect(result.message).toContain('Loaded API key from database');
    });

    it('should decrypt encrypted database keys (format: IV:AuthTag:Encrypted)', async () => {
      // Arrange: keytar fails, DB has encrypted key
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar unavailable'));
      
      // First encrypt a test key using the adapter's encryption
      const testKey = 'secret-key-to-encrypt';
      const encrypted = adapter._encrypt(testKey);
      
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {
            runware: encrypted
          }
        }
      });

      // Act
      const result = await adapter.getApiKey('runware');

      // Assert: Should decrypt and return original key
      expect(result.success).toBe(true);
      expect(result.apiKey).toBe(testKey);
      expect(result.securityLevel).toBe('encrypted-database');
    });

    it('should return empty string when no key found anywhere', async () => {
      // Arrange: keytar returns null, DB has no keys
      mockKeytar.getPassword.mockResolvedValue(null);
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {}
        }
      });

      // Act
      const result = await adapter.getApiKey('piapi');

      // Assert: Legacy behavior returns empty string with success
      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('');
      expect(result.securityLevel).toBe('plain-text-database');
      expect(result.message).toContain('No API key found in database');
    });

    it('should handle database fallback failure gracefully', async () => {
      // Arrange: keytar fails, DB also fails
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar error'));
      mockJobConfig.getSettings.mockRejectedValue(new Error('DB error'));

      // Act
      const result = await adapter.getApiKey('openai');

      // Assert: Legacy behavior returns empty with error message
      expect(result).toEqual({
        success: true,
        apiKey: '',
        securityLevel: 'none',
        error: 'Secure storage unavailable and database fallback failed'
      });
    });

    it('should handle all service names correctly', async () => {
      // Arrange
      mockKeytar.getPassword.mockResolvedValue('test-key');

      // Act & Assert: Test all valid service names
      const services = ['openai', 'piapi', 'runware', 'remove_bg'];
      const accountNames = ['openai-api-key', 'piapi-api-key', 'runware-api-key', 'remove-bg-api-key'];

      for (let i = 0; i < services.length; i++) {
        mockKeytar.getPassword.mockClear();
        mockKeytar.getPassword.mockResolvedValue(`${services[i]}-key`);
        
        const result = await adapter.getApiKey(services[i]);
        
        expect(result.success).toBe(true);
        expect(result.apiKey).toBe(`${services[i]}-key`);
        expect(mockKeytar.getPassword).toHaveBeenCalledWith('GenImageFactory', accountNames[i]);
      }
    });
  });

  describe('setApiKey() - Baseline Behavior', () => {
    it('should store API key in keytar when available', async () => {
      // Arrange
      mockKeytar.setPassword.mockResolvedValue(undefined);

      // Act
      const result = await adapter.setApiKey('openai', 'new-api-key');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'openai-api-key',
        'new-api-key'
      );
    });

    it('should delete key from keytar when empty string provided', async () => {
      // Arrange
      mockKeytar.deletePassword.mockResolvedValue(undefined);

      // Act
      const result = await adapter.setApiKey('runware', '');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'runware-api-key'
      );
      expect(mockKeytar.setPassword).not.toHaveBeenCalled();
    });

    it('should delete key from keytar when whitespace-only string provided', async () => {
      // Arrange
      mockKeytar.deletePassword.mockResolvedValue(undefined);

      // Act
      const result = await adapter.setApiKey('piapi', '   ');

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'piapi-api-key'
      );
    });

    it('should handle unknown service name gracefully', async () => {
      // Arrange: keytar fails, DB succeeds (fallback works)
      mockKeytar.setPassword.mockRejectedValue(new Error('Unknown service: invalid-service'));
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {}
        }
      });
      mockJobConfig.saveSettings.mockResolvedValue({ success: true });

      // Act
      const result = await adapter.setApiKey('invalid-service', 'key');

      // Assert: Legacy behavior falls back to encrypted database
      expect(result).toEqual({
        success: true,
        storage: 'encrypted-database'
      });
    });

    it('should fallback to encrypted database storage when keytar fails', async () => {
      // Arrange: keytar fails
      mockKeytar.setPassword.mockRejectedValue(new Error('keytar unavailable'));
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {}
        }
      });
      mockJobConfig.saveSettings.mockResolvedValue({ success: true });

      // Act
      const result = await adapter.setApiKey('openai', 'fallback-key');

      // Assert: Should encrypt and save to DB
      expect(result).toEqual({
        success: true,
        storage: 'encrypted-database'
      });
      expect(mockJobConfig.saveSettings).toHaveBeenCalled();
      
      // Verify the key was encrypted before saving
      const savedSettings = mockJobConfig.saveSettings.mock.calls[0][0];
      expect(savedSettings.apiKeys.openai).toBeTruthy();
      expect(savedSettings.apiKeys.openai).toContain(':'); // Encrypted format: IV:AuthTag:Encrypted
      expect(savedSettings.apiKeys.openai).not.toBe('fallback-key'); // Should be encrypted
    });

    it('should handle database fallback failure gracefully', async () => {
      // Arrange: keytar fails, DB getSettings succeeds but saveSettings fails
      mockKeytar.setPassword.mockRejectedValue(new Error('keytar error'));
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: { apiKeys: {} }
      });
      mockJobConfig.saveSettings.mockRejectedValue(new Error('DB save error'));

      // Act
      const result = await adapter.setApiKey('runware', 'test-key');

      // Assert: Legacy behavior returns success even when storage fails
      expect(result).toEqual({
        success: true,
        storage: 'none'
      });
    });
  });

  describe('Encryption/Decryption - Baseline Behavior', () => {
    it('should encrypt text in format IV:AuthTag:Encrypted', () => {
      // Act
      const encrypted = adapter._encrypt('test-plaintext');

      // Assert: Verify format
      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':').length).toBe(3);
      expect(encrypted).not.toContain('test-plaintext');
    });

    it('should decrypt encrypted text correctly', () => {
      // Arrange
      const plaintext = 'my-secret-key';
      const encrypted = adapter._encrypt(plaintext);

      // Act
      const decrypted = adapter._decrypt(encrypted);

      // Assert
      expect(decrypted).toBe(plaintext);
    });

    it('should return original text if decryption fails (not encrypted format)', () => {
      // Act
      const result = adapter._decrypt('plain-text-not-encrypted');

      // Assert: Legacy behavior returns original if not encrypted
      expect(result).toBe('plain-text-not-encrypted');
    });

    it('should return original text if encrypted format is invalid', () => {
      // Act
      const result = adapter._decrypt('invalid:format');

      // Assert
      expect(result).toBe('invalid:format');
    });

    it('should handle null/undefined encryption gracefully', () => {
      // Act & Assert
      expect(adapter._encrypt(null)).toBe(null);
      expect(adapter._encrypt(undefined)).toBe(undefined);
      expect(adapter._encrypt('')).toBe('');
    });

    it('should handle null/undefined decryption gracefully', () => {
      // Act & Assert
      expect(adapter._decrypt(null)).toBe(null);
      expect(adapter._decrypt(undefined)).toBe(undefined);
      expect(adapter._decrypt('')).toBe('');
    });
  });

  describe('getSecurityStatus() - Baseline Behavior', () => {
    it('should return native-keychain status when keytar available', async () => {
      // Arrange
      mockKeytar.getPassword.mockResolvedValue(null); // Test call succeeds

      // Act
      const result = await adapter.getSecurityStatus();

      // Assert
      expect(result).toEqual({
        secureStorage: 'available',
        fallback: 'none',
        message: 'Secure storage available (System Keychain)',
        securityLevel: 'native-keychain'
      });
    });

    it('should return encrypted-fallback status when keytar unavailable', async () => {
      // Arrange
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar unavailable'));

      // Act
      const result = await adapter.getSecurityStatus();

      // Assert
      expect(result).toEqual({
        secureStorage: 'unavailable',
        fallback: 'encrypted-database',
        message: 'Using encrypted local database (Secure Fallback)',
        securityLevel: 'encrypted-fallback'
      });
    });
  });

  describe('Edge Cases - Baseline Behavior', () => {
    it('should handle case-insensitive service names', async () => {
      // Arrange
      mockKeytar.getPassword.mockResolvedValue('test-key');

      // Act
      const result1 = await adapter.getApiKey('OpenAI');
      const result2 = await adapter.getApiKey('OPENAI');
      const result3 = await adapter.getApiKey('openai');

      // Assert: All should work
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });

    it('should preserve encryption key consistency across instances', () => {
      // Arrange: Create two adapter instances
      const adapter1 = new BackendAdapter({ skipIpcSetup: true });
      const adapter2 = new BackendAdapter({ skipIpcSetup: true });

      // Act: Encrypt with first, decrypt with second
      const encrypted = adapter1._encrypt('test-data');
      const decrypted = adapter2._decrypt(encrypted);

      // Assert: Should work because encryption key is machine-specific
      expect(decrypted).toBe('test-data');
    });
  });
});
