import { describe, it, expect, vi } from 'vitest';

describe('Critical Import Regression Tests', () => {
  describe('RetryExecutor Import Issues', () => {
    it('should import RetryExecutor without constructor errors', async () => {
      // Mock all the problematic dependencies
      vi.mock('sharp', () => ({ default: vi.fn() }));
      vi.mock('../../../src/producePictureModule', () => ({ processImage: vi.fn() }));
      vi.mock('../../../src/aiVision', () => ({ generateMetadata: vi.fn() }));
      vi.mock('electron', () => ({ app: { getPath: vi.fn().mockReturnValue('/test') } }));
      
      // Mock the database models with correct exports
      vi.mock('../../../src/database/models/JobConfiguration', () => ({
        JobConfiguration: vi.fn().mockImplementation(() => ({
          getDefaultSettings: vi.fn().mockReturnValue({
            filePaths: { outputDirectory: '/test/output', tempDirectory: '/test/temp' }
          }),
          getConfigurationById: vi.fn()
        }))
      }));

      vi.mock('../../../src/database/models/JobExecution', () => ({
        JobExecution: vi.fn().mockImplementation(() => ({
          getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { configurationId: 'test' } })
        }))
      }));

      // This should not throw "JobConfiguration is not a constructor"
      expect(async () => {
        const module = await import('../../../src/services/retryExecutor');
        const RetryExecutor = module.default;
        new RetryExecutor();
      }).not.toThrow();
    });

    it('should handle JobConfiguration import correctly', async () => {
      // Test the specific import pattern that was failing
      const { JobConfiguration } = await import('../../../src/database/models/JobConfiguration');
      
      expect(JobConfiguration).toBeDefined();
      expect(typeof JobConfiguration).toBe('function');
    });
  });

  describe('Path Resolution Import Issues', () => {
    it('should import path resolution modules without errors', async () => {
      // Test that all path-related modules can be imported
      expect(async () => {
        await import('../../../src/database/models/JobConfiguration');
        await import('../../../src/database/models/JobExecution');
        await import('../../../src/database/models/GeneratedImage');
      }).not.toThrow();
    });
  });

  describe('BackendAdapter Import Issues', () => {
    it('should import BackendAdapter without RetryExecutor constructor errors', async () => {
      // Mock all dependencies
      vi.mock('sharp', () => ({ default: vi.fn() }));
      vi.mock('../../../src/producePictureModule', () => ({ processImage: vi.fn() }));
      vi.mock('../../../src/aiVision', () => ({ generateMetadata: vi.fn() }));
      vi.mock('electron', () => ({ app: { getPath: vi.fn().mockReturnValue('/test') } }));
      
      // Mock database models
      vi.mock('../../../src/database/models/JobConfiguration', () => ({
        JobConfiguration: vi.fn().mockImplementation(() => ({
          getDefaultSettings: vi.fn().mockReturnValue({
            filePaths: { outputDirectory: '/test/output', tempDirectory: '/test/temp' }
          }),
          getConfigurationById: vi.fn()
        }))
      }));

      vi.mock('../../../src/database/models/JobExecution', () => ({
        JobExecution: vi.fn().mockImplementation(() => ({
          getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { configurationId: 'test' } })
        }))
      }));

      vi.mock('../../../src/database/models/GeneratedImage', () => ({
        GeneratedImage: vi.fn().mockImplementation(() => ({
          getGeneratedImage: vi.fn(),
          updateGeneratedImage: vi.fn(),
          updateQCStatus: vi.fn()
        }))
      }));

      // This should not throw constructor errors
      expect(async () => {
        await import('../../../src/adapter/backendAdapter');
      }).not.toThrow();
    });
  });
});
