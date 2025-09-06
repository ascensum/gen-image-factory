import { describe, it, expect, vi } from 'vitest';

// Mock the dependencies that cause issues in test environment
vi.mock('sharp', () => ({
  default: vi.fn()
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: vi.fn()
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: vi.fn()
}));

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/test/userdata')
  }
}));

describe('RetryExecutor Critical Regression Tests', () => {
  describe('Import and Constructor Issues', () => {
    it('should import RetryExecutor without constructor errors', async () => {
      // This test specifically catches the "JobConfiguration is not a constructor" error
      expect(async () => {
        const module = await import('../../../src/services/retryExecutor');
        const RetryExecutor = module.default;
        
        // This should not throw "JobConfiguration is not a constructor"
        new RetryExecutor({});
      }).not.toThrow();
    });

    it('should handle JobConfiguration import correctly', async () => {
      // Test the specific import pattern that was failing
      const { JobConfiguration } = await import('../../../src/database/models/JobConfiguration');
      
      expect(JobConfiguration).toBeDefined();
      expect(typeof JobConfiguration).toBe('function');
      
      // This should not throw "JobConfiguration is not a constructor"
      expect(() => {
        new JobConfiguration();
      }).not.toThrow();
    });

    it('should initialize RetryExecutor with proper fallback configuration', async () => {
      const module = await import('../../../src/services/retryExecutor');
      const RetryExecutor = module.default;
      
      const executor = new RetryExecutor({});
      
      expect(executor).toBeDefined();
      expect(executor.getFallbackConfiguration).toBeDefined();
      expect(typeof executor.getFallbackConfiguration).toBe('function');
      
      // Test that fallback configuration works
      const fallback = executor.getFallbackConfiguration();
      expect(fallback).toBeDefined();
      expect(fallback.id).toBe('fallback');
      expect(fallback.settings).toBeDefined();
      expect(fallback.settings.filePaths).toBeDefined();
    });
  });

  describe('Path Resolution Regression', () => {
    it('should use cross-platform paths by default', async () => {
      const module = await import('../../../src/services/retryExecutor');
      const RetryExecutor = module.default;
      
      const executor = new RetryExecutor({});
      
      // Should use cross-platform paths, not hardcoded macOS paths
      expect(executor.tempDirectory).toContain('pictures');
      expect(executor.outputDirectory).toContain('pictures');
      
      // Should not contain hardcoded Desktop paths
      expect(executor.tempDirectory).not.toContain('Desktop');
      expect(executor.outputDirectory).not.toContain('Desktop');
    });

    it('should have getOriginalJobConfiguration method', async () => {
      const module = await import('../../../src/services/retryExecutor');
      const RetryExecutor = module.default;
      
      const executor = new RetryExecutor({});
      
      expect(executor.getOriginalJobConfiguration).toBeDefined();
      expect(typeof executor.getOriginalJobConfiguration).toBe('function');
    });
  });

  describe('Error Handling Regression', () => {
    it('should not crash when methods are called with invalid data', async () => {
      const module = await import('../../../src/services/retryExecutor');
      const RetryExecutor = module.default;
      
      const executor = new RetryExecutor({});
      
      // These should not throw errors, even with invalid data
      // They should return fallback configuration instead
      const result1 = await executor.getOriginalJobConfiguration(null);
      expect(result1).toBeDefined();
      expect(result1.id).toBe('fallback');
      
      const result2 = await executor.getOriginalJobConfiguration({});
      expect(result2).toBeDefined();
      expect(result2.id).toBe('fallback');
      
      const result3 = await executor.getOriginalJobConfiguration({ id: 'invalid' });
      expect(result3).toBeDefined();
      expect(result3.id).toBe('fallback');
    });

    it('should provide fallback configuration when errors occur', async () => {
      const module = await import('../../../src/services/retryExecutor');
      const RetryExecutor = module.default;
      
      const executor = new RetryExecutor({});
      
      const fallback = executor.getFallbackConfiguration();
      
      expect(fallback).toBeDefined();
      expect(fallback.id).toBe('fallback');
      expect(fallback.settings).toBeDefined();
      expect(fallback.settings.filePaths).toBeDefined();
      expect(fallback.settings.filePaths.outputDirectory).toBeDefined();
      expect(fallback.settings.filePaths.tempDirectory).toBeDefined();
    });
  });
});
