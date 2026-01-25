/**
 * Unit Tests for SecurityService
 * 
 * These tests verify SecurityService in isolation with mocked dependencies.
 * Focus: Isolated behavior, dependency injection, error handling
 * 
 * Note: Characterization tests (SecurityService.baseline.test.ts) verify
 * behavioral parity with legacy code. These unit tests verify the service works correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('SecurityService Unit Tests', () => {
  let SecurityService: any;
  let mockKeytar: any;
  let mockJobConfig: any;
  let service: any;

  beforeEach(() => {
    // Mock keytar
    mockKeytar = {
      getPassword: vi.fn(),
      setPassword: vi.fn(),
      deletePassword: vi.fn()
    };

    // Mock JobConfiguration
    mockJobConfig = {
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
      getDefaultSettings: vi.fn(() => ({
        apiKeys: {},
        parameters: {},
        filePaths: {}
      })),
      ensureInitialized: vi.fn().mockResolvedValue(true)
    };

    // Load SecurityService
    const module = req('../../../src/services/SecurityService.js');
    SecurityService = module.SecurityService;
  });

  describe('Constructor & Dependency Injection (ADR-003)', () => {
    it('should initialize with keytar dependency', () => {
      service = new SecurityService(mockKeytar);
      
      expect(service).toBeDefined();
      expect(service.keytar).toBe(mockKeytar);
    });

    it('should initialize with keytar and jobConfig dependencies', () => {
      service = new SecurityService(mockKeytar, mockJobConfig);
      
      expect(service).toBeDefined();
      expect(service.keytar).toBe(mockKeytar);
      expect(service.jobConfig).toBe(mockJobConfig);
    });

    it('should derive encryption key on initialization', () => {
      service = new SecurityService(mockKeytar);
      
      expect(service.encryptionKey).toBeDefined();
      expect(service.encryptionKey).toBeInstanceOf(Buffer);
      expect(service.encryptionKey.length).toBe(32); // AES-256 requires 32-byte key
    });

    it('should use consistent encryption key across instances', () => {
      const service1 = new SecurityService(mockKeytar);
      const service2 = new SecurityService(mockKeytar);
      
      // Keys should be identical (machine-specific)
      expect(service1.encryptionKey.equals(service2.encryptionKey)).toBe(true);
    });
  });

  describe('getSecret() - Native Keychain Path', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar, mockJobConfig);
    });

    it('should get API key from keytar when available', async () => {
      mockKeytar.getPassword.mockResolvedValue('test-api-key');

      const result = await service.getSecret('openai');

      expect(result).toEqual({
        success: true,
        apiKey: 'test-api-key',
        securityLevel: 'native-keychain'
      });
      expect(mockKeytar.getPassword).toHaveBeenCalledWith('GenImageFactory', 'openai-api-key');
    });

    it('should return error for unknown service', async () => {
      const result = await service.getSecret('invalid-service');

      expect(result).toEqual({
        success: false,
        error: 'Unknown service: invalid-service'
      });
      expect(mockKeytar.getPassword).not.toHaveBeenCalled();
    });

    it('should handle all supported services', async () => {
      const services = ['openai', 'piapi', 'runware', 'remove_bg'];
      
      for (const svc of services) {
        mockKeytar.getPassword.mockResolvedValue(`${svc}-key`);
        const result = await service.getSecret(svc);
        
        expect(result.success).toBe(true);
        expect(result.apiKey).toBe(`${svc}-key`);
        expect(result.securityLevel).toBe('native-keychain');
      }
    });
  });

  describe('getSecret() - Database Fallback Path', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar, mockJobConfig);
    });

    it('should fallback to database when keytar returns null', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {
            openai: 'db-key'
          }
        }
      });

      const result = await service.getSecret('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('db-key');
      expect(result.securityLevel).toBe('plain-text-database');
    });

    it('should decrypt encrypted database keys', async () => {
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar unavailable'));
      
      // Encrypt a test key
      const plainKey = 'secret-test-key';
      const encryptedKey = service._encrypt(plainKey);
      
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {
            runware: encryptedKey
          }
        }
      });

      const result = await service.getSecret('runware');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe(plainKey);
      expect(result.securityLevel).toBe('encrypted-database');
    });

    it('should return empty when no key found anywhere', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: {
          apiKeys: {}
        }
      });

      const result = await service.getSecret('piapi');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('');
      expect(result.securityLevel).toBe('plain-text-database');
    });

    it('should handle database errors gracefully', async () => {
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar error'));
      mockJobConfig.getSettings.mockRejectedValue(new Error('DB error'));

      const result = await service.getSecret('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('');
      expect(result.securityLevel).toBe('none');
      expect(result.error).toContain('Secure storage unavailable');
    });

    it('should handle missing jobConfig gracefully', async () => {
      const serviceWithoutConfig = new SecurityService(mockKeytar, null);
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar error'));

      const result = await serviceWithoutConfig.getSecret('openai');

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe('');
      expect(result.securityLevel).toBe('none');
    });
  });

  describe('setSecret() - Native Keychain Path', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar, mockJobConfig);
    });

    it('should store API key in keytar', async () => {
      mockKeytar.setPassword.mockResolvedValue(undefined);

      const result = await service.setSecret('openai', 'new-key');

      expect(result).toEqual({ success: true });
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'openai-api-key',
        'new-key'
      );
    });

    it('should delete key when empty string provided', async () => {
      mockKeytar.deletePassword.mockResolvedValue(undefined);

      const result = await service.setSecret('runware', '');

      expect(result).toEqual({ success: true });
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(
        'GenImageFactory',
        'runware-api-key'
      );
      expect(mockKeytar.setPassword).not.toHaveBeenCalled();
    });

    it('should delete key when whitespace-only string provided', async () => {
      mockKeytar.deletePassword.mockResolvedValue(undefined);

      const result = await service.setSecret('piapi', '   ');

      expect(result).toEqual({ success: true });
      expect(mockKeytar.deletePassword).toHaveBeenCalled();
    });
  });

  describe('setSecret() - Database Fallback Path', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar, mockJobConfig);
    });

    it('should fallback to encrypted database when keytar fails', async () => {
      mockKeytar.setPassword.mockRejectedValue(new Error('keytar unavailable'));
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: { apiKeys: {} }
      });
      mockJobConfig.saveSettings.mockResolvedValue({ success: true });

      const result = await service.setSecret('openai', 'fallback-key');

      expect(result).toEqual({
        success: true,
        storage: 'encrypted-database'
      });
      expect(mockJobConfig.saveSettings).toHaveBeenCalled();
      
      // Verify key was encrypted before saving
      const savedSettings = mockJobConfig.saveSettings.mock.calls[0][0];
      expect(savedSettings.apiKeys.openai).toBeTruthy();
      expect(savedSettings.apiKeys.openai).toContain(':'); // Encrypted format
      expect(savedSettings.apiKeys.openai).not.toBe('fallback-key');
    });

    it('should handle database save failure gracefully', async () => {
      mockKeytar.setPassword.mockRejectedValue(new Error('keytar error'));
      mockJobConfig.getSettings.mockResolvedValue({
        success: true,
        settings: { apiKeys: {} }
      });
      mockJobConfig.saveSettings.mockRejectedValue(new Error('DB save error'));

      const result = await service.setSecret('runware', 'test-key');

      expect(result).toEqual({
        success: true,
        storage: 'none'
      });
    });
  });

  describe('Encryption/Decryption', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar);
    });

    it('should encrypt text in format IV:AuthTag:Encrypted', () => {
      const plaintext = 'test-secret';
      const encrypted = service._encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':').length).toBe(3);
      expect(encrypted).not.toContain(plaintext);
    });

    it('should decrypt encrypted text correctly', () => {
      const plaintext = 'my-secret-key';
      const encrypted = service._encrypt(plaintext);
      const decrypted = service._decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return original text if not encrypted format', () => {
      const result = service._decrypt('plain-text');
      expect(result).toBe('plain-text');
    });

    it('should handle null/undefined gracefully', () => {
      expect(service._encrypt(null)).toBeNull();
      expect(service._encrypt(undefined)).toBeUndefined();
      expect(service._encrypt('')).toBe('');
      
      expect(service._decrypt(null)).toBeNull();
      expect(service._decrypt(undefined)).toBeUndefined();
      expect(service._decrypt('')).toBe('');
    });

    it('should generate different encrypted values for same input', () => {
      const plaintext = 'test';
      const encrypted1 = service._encrypt(plaintext);
      const encrypted2 = service._encrypt(plaintext);

      // Different IVs = different encrypted values
      expect(encrypted1).not.toBe(encrypted2);
      
      // Both decrypt to same plaintext
      expect(service._decrypt(encrypted1)).toBe(plaintext);
      expect(service._decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('getSecurityStatus()', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar);
    });

    it('should return native-keychain when keytar available', async () => {
      mockKeytar.getPassword.mockResolvedValue(null);

      const result = await service.getSecurityStatus();

      expect(result).toEqual({
        secureStorage: 'available',
        fallback: 'none',
        message: 'Secure storage available (System Keychain)',
        securityLevel: 'native-keychain'
      });
    });

    it('should return encrypted-fallback when keytar unavailable', async () => {
      mockKeytar.getPassword.mockRejectedValue(new Error('keytar unavailable'));

      const result = await service.getSecurityStatus();

      expect(result).toEqual({
        secureStorage: 'unavailable',
        fallback: 'encrypted-database',
        message: 'Using encrypted local database (Secure Fallback)',
        securityLevel: 'encrypted-fallback'
      });
    });
  });

  describe('getPublicSettings()', () => {
    beforeEach(() => {
      service = new SecurityService(mockKeytar);
    });

    it('should expose encryption key and constants', () => {
      const settings = service.getPublicSettings();

      expect(settings).toEqual({
        encryptionKey: service.encryptionKey,
        serviceName: 'GenImageFactory',
        accountNames: {
          OPENAI: 'openai-api-key',
          PIAPI: 'piapi-api-key',
          RUNWARE: 'runware-api-key',
          REMOVE_BG: 'remove-bg-api-key'
        }
      });
    });
  });
});
