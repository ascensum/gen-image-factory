/**
 * Unit Tests for Shadow Bridge Logger
 * 
 * SECURITY TESTS: Verify that logger does NOT leak sensitive data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ShadowBridgeLogger - Security', () => {
  let logger;
  let originalEnv;

  beforeEach(async () => {
    // Save original env
    originalEnv = { ...process.env };
    
    // Enable logging for tests
    process.env.SHADOW_BRIDGE_LOGGING = 'true';
    process.env.SHADOW_BRIDGE_LOG_FILE = 'true';
    
    // Reset module cache to get fresh instance
    vi.resetModules();
    // shadowBridgeLogger.js uses CommonJS exports, need to handle dynamic import
    const module = await import('../../../src/utils/shadowBridgeLogger.js?t=' + Date.now());
    logger = module.default;
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
    
    // Clean up log files
    try {
      if (logger.logFilePath && fs.existsSync(logger.logFilePath)) {
        fs.unlinkSync(logger.logFilePath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Sensitive Data Sanitization', () => {
    it('should sanitize API keys in error messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('Invalid API key: sk-1234567890abcdef');
      logger.logLegacyFallback('SecurityService', 'getApiKey', error);
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('sk-1234567890abcdef');
      expect(loggedMessage).toContain('[REDACTED]');
      
      consoleSpy.mockRestore();
    });

    it('should sanitize Bearer tokens in error messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('Authentication failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      logger.logLegacyFallback('SecurityService', 'authenticate', error);
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(loggedMessage).toContain('[REDACTED]');
      
      consoleSpy.mockRestore();
    });

    it('should sanitize passwords in error messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('Database connection failed: password=mysecretpassword123');
      logger.logLegacyFallback('DatabaseService', 'connect', error);
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('mysecretpassword123');
      expect(loggedMessage).toContain('[REDACTED]');
      
      consoleSpy.mockRestore();
    });

    it('should sanitize email addresses in error messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('User not found: user@example.com');
      logger.logLegacyFallback('UserService', 'findUser', error);
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('user@example.com');
      expect(loggedMessage).toContain('[EMAIL_REDACTED]');
      
      consoleSpy.mockRestore();
    });

    it('should sanitize file paths containing usernames', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('File not found: /Users/johndoe/secret.txt');
      logger.logLegacyFallback('FileService', 'readFile', error);
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('johndoe');
      expect(loggedMessage).toContain('[PATH_REDACTED]');
      
      consoleSpy.mockRestore();
    });

    it('should sanitize Windows file paths containing usernames', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('File not found: C:\\Users\\johndoe\\secret.txt');
      logger.logLegacyFallback('FileService', 'readFile', error);
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('johndoe');
      expect(loggedMessage).toContain('[PATH_REDACTED]');
      
      consoleSpy.mockRestore();
    });
  });

  describe('File Security', () => {
    it('should store log files in OS temp directory (not workspace)', () => {
      expect(logger.logFilePath).toContain(os.tmpdir());
      expect(logger.logFilePath).not.toContain(process.cwd());
    });

    it('should use .log extension (covered by .gitignore)', () => {
      expect(logger.logFilePath).toMatch(/shadow-bridge-\d+\.log$/);
    });

    it('should not log method parameters', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Logger should NOT accept or log parameters
      logger.logModularPath('JobRepository', 'saveJobExecution');
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      // Should only contain service and method name
      expect(loggedMessage).toContain('JobRepository');
      expect(loggedMessage).toContain('saveJobExecution');
      // Should NOT contain any parameter data
      expect(loggedMessage).not.toMatch(/execution.*=/);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Logging Behavior', () => {
    it('should log modular path without sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.logModularPath('JobRepository', 'getJobHistory');
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[MODULAR]');
      expect(loggedMessage).toContain('JobRepository.getJobHistory()');
      expect(loggedMessage).toContain('Using NEW refactored code');
      
      consoleSpy.mockRestore();
    });

    it('should log legacy path without sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.logLegacyPath('JobRepository', 'getJobHistory', 'flag disabled');
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('[LEGACY]');
      expect(loggedMessage).toContain('JobRepository.getJobHistory()');
      expect(loggedMessage).toContain('flag disabled');
      
      consoleSpy.mockRestore();
    });

    it('should not log when disabled', async () => {
      process.env.SHADOW_BRIDGE_LOGGING = 'false';
      vi.resetModules();
      const module = await import('../../../src/utils/shadowBridgeLogger.js?t=' + Date.now());
      const disabledLogger = module.default;
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      disabledLogger.logModularPath('JobRepository', 'test');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Summary Report', () => {
    it('should generate summary without leaking log content', () => {
      logger.logModularPath('JobRepository', 'getJobHistory');
      logger.logLegacyPath('ImageRepository', 'saveImage', 'flag disabled');
      
      const summary = logger.getSummary();
      
      expect(summary).toHaveProperty('logFile');
      expect(summary).toHaveProperty('totalCalls');
      expect(summary).toHaveProperty('modularCalls');
      expect(summary).toHaveProperty('legacyCalls');
      expect(summary).toHaveProperty('modularPercentage');
      
      // Summary should only contain counts, not actual log content
      expect(typeof summary.modularCalls).toBe('number');
      expect(typeof summary.legacyCalls).toBe('number');
    });
  });
});
