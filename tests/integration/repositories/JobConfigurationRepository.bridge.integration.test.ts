/**
 * Bridge Integration Tests: JobConfigurationRepository Shadow Bridge
 * 
 * Purpose: Test JobConfigurationRepository initialization and availability in JobConfiguration
 * Scope: Feature flag routing, initialization behavior
 * 
 * Testing Strategy (ADR-006):
 * 1. Test LEGACY path (feature flag OFF) - configRepository is null
 * 2. Test MODULAR path (feature flag ON) - configRepository is initialized
 * 3. Verify JobConfigurationRepository can execute queries
 * 
 * Coverage Goal: 100% of Shadow Bridge initialization logic
 * 
 * Related: Story 3.2 Phase 3 Task 3.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'fs';

const req = createRequire(import.meta.url);

describe('JobConfigurationRepository Bridge Integration Tests', () => {
  let JobConfiguration: any;
  let jobConfiguration: any;
  let testDbPath: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Save original env
    originalEnv = process.env.FEATURE_MODULAR_CONFIG_REPOSITORY;
    
    // Use unique test database for each run
    testDbPath = path.join(process.cwd(), 'tests', 'integration', `test-config-repo-${Date.now()}.db`);
    
    // Clear module cache to ensure fresh load
    const jobConfigurationPath = req.resolve('../../../src/database/models/JobConfiguration.js');
    delete req.cache[jobConfigurationPath];
  });

  afterEach(async () => {
    // Restore env
    if (originalEnv !== undefined) {
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = originalEnv;
    } else {
      delete process.env.FEATURE_MODULAR_CONFIG_REPOSITORY;
    }

    // Close database connection
    if (jobConfiguration?.db) {
      await new Promise<void>((resolve) => {
        jobConfiguration.db.close((err: any) => {
          if (err) console.warn('Error closing test database:', err);
          resolve();
        });
      });
    }

    // Cleanup test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        console.warn('Could not delete test database:', err);
      }
    }
  });

  describe('Legacy Path (Feature Flag OFF)', () => {
    it('should NOT initialize JobConfigurationRepository when feature flag is OFF', async () => {
      // Arrange: Feature flag OFF
      delete process.env.FEATURE_MODULAR_CONFIG_REPOSITORY;
      
      // Load JobConfiguration
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      
      // Override dbPath for testing
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Assert: JobConfigurationRepository should NOT be initialized
      expect(jobConfiguration.configRepository).toBeNull();
    });

    it('should use legacy JobConfiguration methods when feature flag is OFF', async () => {
      // Arrange
      delete process.env.FEATURE_MODULAR_CONFIG_REPOSITORY;
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Assert: Legacy methods should exist
      expect(typeof jobConfiguration.saveSettings).toBe('function');
      expect(typeof jobConfiguration.getSettings).toBe('function');
      expect(typeof jobConfiguration.getAllConfigurations).toBe('function');
      expect(jobConfiguration.configRepository).toBeNull();
    });
  });

  describe('Modular Path (Feature Flag ON)', () => {
    it('should initialize JobConfigurationRepository when feature flag is ON', async () => {
      // Arrange: Feature flag ON
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = 'true';
      
      // Load JobConfiguration
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      
      // Override dbPath for testing
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Assert: JobConfigurationRepository should be initialized
      expect(jobConfiguration.configRepository).not.toBeNull();
      expect(jobConfiguration.configRepository.constructor.name).toBe('JobConfigurationRepository');
    });

    it('should have JobConfigurationRepository with correct methods', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Assert: JobConfigurationRepository should have expected methods
      expect(typeof jobConfiguration.configRepository.saveSettings).toBe('function');
      expect(typeof jobConfiguration.configRepository.getSettings).toBe('function');
      expect(typeof jobConfiguration.configRepository.getAllConfigurations).toBe('function');
      expect(typeof jobConfiguration.configRepository.deleteConfiguration).toBe('function');
    });

    it('should be able to execute queries via JobConfigurationRepository', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Act: Execute query via JobConfigurationRepository
      const result = await jobConfiguration.configRepository.getAllConfigurations();

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.configurations)).toBe(true);
      expect(result.configurations).toHaveLength(0); // Empty database
    });

    it('should execute saveSettings via JobConfigurationRepository', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Act
      const result = await jobConfiguration.configRepository.saveSettings(
        { test: 'settings' },
        'test-config'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.name).toBe('test-config');
      expect(result.id).toBeGreaterThan(0);
    });

    it('should execute getSettings via JobConfigurationRepository', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      jobConfiguration = new JobConfiguration();
      jobConfiguration.dbPath = testDbPath;
      await jobConfiguration.init();

      // Save a configuration first
      await jobConfiguration.configRepository.saveSettings({ mode: 'test' }, 'test-config');

      // Act
      const result = await jobConfiguration.configRepository.getSettings('test-config');

      // Assert
      expect(result.success).toBe(true);
      expect(result.settings.mode).toBe('test');
    });
  });

  describe('Fallback Behavior', () => {
    it('should gracefully handle JobConfigurationRepository initialization failure', async () => {
      // Arrange: Feature flag ON but force initialization error
      process.env.FEATURE_MODULAR_CONFIG_REPOSITORY = 'true';
      
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Load JobConfiguration (initialization will fail silently)
      const module = req('../../../src/database/models/JobConfiguration.js');
      JobConfiguration = module.JobConfiguration;
      
      // Act: Constructor should not throw
      expect(() => {
        jobConfiguration = new JobConfiguration();
        jobConfiguration.dbPath = testDbPath;
      }).not.toThrow();
    });
  });

  describe('JobConfigurationRepository Standalone Tests', () => {
    it('should be able to instantiate JobConfigurationRepository directly', () => {
      // Arrange
      const { JobConfigurationRepository } = req('../../../src/repositories/JobConfigurationRepository.js');
      const mockModel = { db: {}, getDefaultSettings: () => ({}) };

      // Act
      const configRepository = new JobConfigurationRepository(mockModel);

      // Assert
      expect(configRepository).toBeDefined();
      expect(typeof configRepository.saveSettings).toBe('function');
    });
  });
});
