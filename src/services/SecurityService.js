/**
 * SecurityService - Extracted from BackendAdapter (ADR-001, ADR-003)
 * 
 * Handles API key management, encryption/decryption, and keytar integration.
 * 
 * CRITICAL: This is a 1:1 extraction from backendAdapter.js lines ~27-150 and ~966-1087
 * NO OPTIMIZATIONS - Behavior must remain IDENTICAL to legacy code.
 * 
 * Dependencies: keytar (injected via constructor for DI pattern)
 */

const crypto = require('crypto');
const os = require('os');
const { safeLogger } = require('../utils/logMasking');

// Service names for keytar - COPIED EXACTLY from backendAdapter.js
const SERVICE_NAME = 'GenImageFactory';
const ACCOUNT_NAMES = {
  OPENAI: 'openai-api-key',
  PIAPI: 'piapi-api-key', 
  RUNWARE: 'runware-api-key',
  REMOVE_BG: 'remove-bg-api-key'
};

// Encryption settings for fallback storage - COPIED EXACTLY from backendAdapter.js
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
// In production, this should ideally be derived from a machine-specific secret or similar,
// but for a single-user app where the goal is "not plaintext", a hardcoded obfuscation key
// or machine-id based key is a significant improvement over plaintext.
// We will use a combination of a static secret and machine info if available, or just a static secret.
const FALLBACK_SECRET = 'GenImageFactory-Secure-Fallback-Key-2025';

class SecurityService {
  /**
   * Constructor - Dependency Injection pattern (ADR-003)
   * @param {Object} keytar - keytar module instance (injected)
   * @param {Object} jobConfig - JobConfiguration instance for DB fallback (injected)
   */
  constructor(keytar, jobConfig = null) {
    this.keytar = keytar;
    this.jobConfig = jobConfig;
    
    // Ensure we have a consistent encryption key - COPIED EXACTLY from backendAdapter.js
    this.encryptionKey = this._deriveEncryptionKey();
  }

  /**
   * Derive encryption key - COPIED EXACTLY from backendAdapter.js lines 81-100
   */
  _deriveEncryptionKey() {
    try {
      // Use crypto to create a consistent 32-byte key from our secret mixed with machine info
      // to make it machine-specific, preventing simple copy-paste of the DB to another machine.
      let machineInfo = '';
      try {
        machineInfo = `${os.hostname()}-${os.userInfo().username}`;
      } catch {
        // Fallback if os info unavailable
        machineInfo = 'generic-machine';
      }
      
      const secret = `${FALLBACK_SECRET}-${machineInfo}`;
      return crypto.scryptSync(secret, 'salt', 32);
    } catch (error) {
      safeLogger.error('Failed to derive encryption key:', error);
      // Fallback to a buffer of zeros (should never happen in normal node env)
      return Buffer.alloc(32);
    }
  }

  /**
   * Encrypt text - COPIED EXACTLY from backendAdapter.js lines 102-116
   */
  _encrypt(text) {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      // Format: IV:AuthTag:EncryptedContent
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      safeLogger.error('Encryption failed:', error);
      return null; // Fail safe
    }
  }

  /**
   * Decrypt text - COPIED EXACTLY from backendAdapter.js lines 118-140
   */
  _decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) return encryptedText; // Not our format, maybe plaintext?
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      // Specify authTagLength to prevent GCM authentication tag length attacks
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv, {
        authTagLength: AUTH_TAG_LENGTH
      });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      safeLogger.error('Decryption failed (returning original):', error.message);
      return encryptedText; // Return original if decryption fails (might be plaintext)
    }
  }

  /**
   * Get API secret - COPIED EXACTLY from backendAdapter.js getApiKey() lines 966-1026
   * @param {string} serviceName - Service name (openai, piapi, runware, remove_bg)
   * @returns {Promise<{success: boolean, apiKey?: string, securityLevel?: string, error?: string, message?: string}>}
   */
  async getSecret(serviceName) {
    try {
      const accountName = ACCOUNT_NAMES[serviceName.toUpperCase()];
      if (!accountName) {
        return { success: false, error: `Unknown service: ${serviceName}` };
      }

      const apiKey = await this.keytar.getPassword(SERVICE_NAME, accountName);
      if (apiKey) {
        return { success: true, apiKey: apiKey || '', securityLevel: 'native-keychain' };
      } else {
        // If keytar returned null/empty, check DB just in case we are in fallback mode
        // but keytar didn't error, just didn't find it.
        throw new Error('Key not found in keytar, checking fallback');
      }
    } catch (error) {
      // Don't log full error if it's just "Key not found" flow control
      if (error.message !== 'Key not found in keytar, checking fallback') {
        safeLogger.error('Error getting API key (keytar failed/missing):', error.message);
      }
      
      // Fallback: try to load from database settings
      try {
        if (!this.jobConfig) {
          throw new Error('No jobConfig available for database fallback');
        }
        
        if (typeof this.jobConfig.ensureInitialized === 'function') {
          await this.jobConfig.ensureInitialized();
        }
        const res = await this.jobConfig.getSettings();
        let dbKey = (res && res.settings && res.settings.apiKeys)
          ? (res.settings.apiKeys[serviceName.toLowerCase()] || '')
          : '';
        
        let securityLevel = 'plain-text-database';
        
        // Try to decrypt if it looks encrypted
        if (dbKey && dbKey.includes(':')) {
           const decrypted = this._decrypt(dbKey);
           if (decrypted !== dbKey) {
             dbKey = decrypted;
             securityLevel = 'encrypted-database';
           }
        }

        return {
          success: true,
          apiKey: dbKey,
          securityLevel: securityLevel,
          message: dbKey
            ? `Loaded API key from database (${securityLevel}) because secure storage is unavailable`
            : 'No API key found in database; secure storage unavailable'
        };
      } catch (e2) {
        safeLogger.warn('DB fallback for getApiKey failed, returning empty string:', e2.message);
        return {
          success: true,
          apiKey: '',
          securityLevel: 'none',
          error: 'Secure storage unavailable and database fallback failed'
        };
      }
    }
  }

  /**
   * Get security status - COPIED EXACTLY from backendAdapter.js lines 1028-1046
   * @returns {Promise<{secureStorage: string, fallback: string, message: string, securityLevel: string}>}
   */
  async getSecurityStatus() {
    try {
      // Test if keytar is available
      await this.keytar.getPassword(SERVICE_NAME, 'test');
      return { 
        secureStorage: 'available',
        fallback: 'none',
        message: 'Secure storage available (System Keychain)',
        securityLevel: 'native-keychain'
      };
    } catch {
      return {
        secureStorage: 'unavailable', 
        fallback: 'encrypted-database',
        message: 'Using encrypted local database (Secure Fallback)',
        securityLevel: 'encrypted-fallback'
      };
    }
  }

  /**
   * Set API secret - COPIED EXACTLY from backendAdapter.js setApiKey() lines 1048-1087
   * @param {string} serviceName - Service name (openai, piapi, runware, remove_bg)
   * @param {string} apiKey - API key to store
   * @returns {Promise<{success: boolean, storage?: string, error?: string}>}
   */
  async setSecret(serviceName, apiKey) {
    try {
      const accountName = ACCOUNT_NAMES[serviceName.toUpperCase()];
      if (!accountName) {
        throw new Error(`Unknown service: ${serviceName}`);
      }

      if (!apiKey || apiKey.trim() === '') {
        // Remove the key if empty
        await this.keytar.deletePassword(SERVICE_NAME, accountName);
      } else {
        // Store the key
        await this.keytar.setPassword(SERVICE_NAME, accountName, apiKey);
      }

      return { success: true };
    } catch (error) {
      safeLogger.error('Error setting API key (keytar failed):', error.message);
      // Fallback: persist in database settings
      try {
        if (!this.jobConfig) {
          throw new Error('No jobConfig available for database fallback');
        }
        
        if (typeof this.jobConfig.ensureInitialized === 'function') {
          await this.jobConfig.ensureInitialized();
        }
        const res = await this.jobConfig.getSettings();
        const settings = (res && res.settings) ? res.settings : this.jobConfig.getDefaultSettings();
        if (!settings.apiKeys) settings.apiKeys = {};
        
        // ENCRYPT before saving to DB
        const encryptedKey = this._encrypt(apiKey || '');
        settings.apiKeys[serviceName.toLowerCase()] = encryptedKey;
        
        await this.jobConfig.saveSettings(settings);
        safeLogger.warn('Stored API key in database (Encrypted Fallback)');
        return { success: true, storage: 'encrypted-database' };
      } catch (e2) {
        safeLogger.warn('API key DB fallback failed, continuing without persistent storage:', e2.message);
        return { success: true, storage: 'none' };
      }
    }
  }

  /**
   * Get public settings (expose encryption key for testing/backward compat)
   * This allows BackendAdapter to continue using encryption with same key
   * @returns {Object}
   */
  getPublicSettings() {
    return {
      encryptionKey: this.encryptionKey,
      serviceName: SERVICE_NAME,
      accountNames: ACCOUNT_NAMES
    };
  }
}

module.exports = { SecurityService };
