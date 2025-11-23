import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackendAdapter } from '../../../../src/adapter/backendAdapter';

// NOTE: We cannot easily mock 'keytar' native module for the integration/fallback tests
// in this environment as it seems to leak the real implementation.
// We mock it here just to satisfy the require, but we won't assert on its behavior for fallback.
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(),
    setPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  }
}));

vi.mock('../../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: class {
    getDefaultSettings() { return { apiKeys: {} }; }
    getSettings() { return Promise.resolve({ settings: { apiKeys: {} } }); }
    saveSettings() { return Promise.resolve(true); }
  }
}));

describe('BackendAdapter Security Features', () => {
  let adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new BackendAdapter({ skipIpcSetup: true });
    
    // Mock internal methods
    adapter.ensureInitialized = vi.fn().mockResolvedValue();
  });

  describe('Encryption Utilities (Unit Tests)', () => {
    it('should encrypt and decrypt text correctly', () => {
      const original = 'test-api-key-12345';
      const encrypted = adapter._encrypt(original);
      
      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':'); 
      expect(encrypted.split(':')).toHaveLength(3); // IV:Tag:Content
      
      const decrypted = adapter._decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle empty strings', () => {
      expect(adapter._encrypt('')).toBe('');
      expect(adapter._decrypt('')).toBe('');
    });

    it('should return original text if decryption fails (backward compatibility)', () => {
      // Logic relies on checking if text contains ':', if not it returns original
      const plaintext = 'not-encrypted';
      expect(adapter._decrypt(plaintext)).toBe(plaintext);
    });

    it('should return original text if format looks like encrypted but fails auth tag', () => {
      // Simulate tampered data
      const fakeEncrypted = '0000:1111:2222'; // Bad hex but format correctish
      // This might throw in crypto or just fail. 
      // The code catches error and returns original.
      expect(adapter._decrypt(fakeEncrypted)).toBe(fakeEncrypted);
    });
  });
});
