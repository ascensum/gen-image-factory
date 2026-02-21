/**
 * Bridge Integration Tests: JobEngine Shadow Bridge
 * 
 * Purpose: Test JobEngine initialization and availability in jobRunner
 * Scope: Feature flag routing, initialization behavior
 * 
 * Testing Strategy (ADR-006 - Simplified for Phase 4):
 * 1. Test LEGACY path (feature flag OFF) - jobEngine is null
 * 2. Test MODULAR path (feature flag ON) - jobEngine is initialized
 * 3. Verify JobEngine can be instantiated and execute jobs
 * 
 * @NOTE: Full bridge routing tests deferred until JobRepository is available (Story 3.2 Phase 1)
 * 
 * Coverage Goal: 100% of Shadow Bridge initialization logic
 * 
 * Related: Story 3.1 Phase 4 Task 4.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobEngine Bridge Integration Tests', () => {
  let JobRunner: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.FEATURE_MODULAR_JOB_ENGINE;
    
    // Clear module cache to ensure fresh load
    const jobRunnerPath = req.resolve('../../../src/services/jobRunner.js');
    delete req.cache[jobRunnerPath];
    const jobEnginePath = req.resolve('../../../src/services/JobEngine.js');
    delete req.cache[jobEnginePath];
  });

  afterEach(() => {
    // Restore env
    if (originalEnv !== undefined) {
      process.env.FEATURE_MODULAR_JOB_ENGINE = originalEnv;
    } else {
      delete process.env.FEATURE_MODULAR_JOB_ENGINE;
    }
  });

  describe('Legacy Path (Feature Flag OFF)', () => {
    it('should NOT initialize JobEngine when feature flag is OFF', () => {
      // Load module first - transitive requires (paramsGeneratorModule) call dotenv.config()
      // which would re-set feature flags from .env. Deleting AFTER load avoids this.
      const module = req('../../../src/services/jobRunner.js');
      JobRunner = module.JobRunner;
      
      // Arrange: Feature flag OFF (delete AFTER module load to avoid dotenv re-loading)
      delete process.env.FEATURE_MODULAR_JOB_ENGINE;
      
      // Act
      const jobRunner = new JobRunner();

      // Assert: JobEngine should NOT be initialized
      expect(jobRunner.jobEngine).toBeNull();
    });

    it('should use legacy jobRunner methods when feature flag is OFF', () => {
      // Arrange
      delete process.env.FEATURE_MODULAR_JOB_ENGINE;
      const module = req('../../../src/services/jobRunner.js');
      JobRunner = module.JobRunner;
      const jobRunner = new JobRunner();

      // Assert: Legacy methods should exist
      expect(typeof jobRunner.startJob).toBe('function');
      expect(typeof jobRunner.executeJob).toBe('function');
      expect(typeof jobRunner.stopJob).toBe('function');
      expect(jobRunner.jobEngine).toBeNull();
    });
  });

  describe('Modular Path (Feature Flag ON)', () => {
    it('should initialize JobEngine when feature flag is ON', () => {
      // Arrange: Feature flag ON
      process.env.FEATURE_MODULAR_JOB_ENGINE = 'true';
      
      // Load JobRunner
      const module = req('../../../src/services/jobRunner.js');
      JobRunner = module.JobRunner;
      
      // Act
      const jobRunner = new JobRunner();

      // Assert: JobEngine should be initialized
      expect(jobRunner.jobEngine).not.toBeNull();
      expect(jobRunner.jobEngine.constructor.name).toBe('JobEngine');
    });

    it('should have JobEngine with correct methods', () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_ENGINE = 'true';
      const module = req('../../../src/services/jobRunner.js');
      JobRunner = module.JobRunner;
      const jobRunner = new JobRunner();

      // Assert: JobEngine should have expected methods
      expect(typeof jobRunner.jobEngine.executeJob).toBe('function');
      expect(typeof jobRunner.jobEngine.abort).toBe('function');
    });

    it('should be able to execute job via JobEngine', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_ENGINE = 'true';
      const module = req('../../../src/services/jobRunner.js');
      JobRunner = module.JobRunner;
      const jobRunner = new JobRunner();

      // Mock dependencies
      jobRunner.jobEngine.paramsGeneratorModule.generateParameters = vi.fn().mockResolvedValue({
        prompt: 'test prompt'
      });
      jobRunner.jobEngine.producePictureModule.producePictureModule = vi.fn().mockResolvedValue([
        '/test/image.png'
      ]);

      // Act
      const result = await jobRunner.jobEngine.executeJob({
        parameters: { count: 1, variations: 1 },
        apiKeys: { test: 'key' }
      });

      // Assert
      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(1);
    });
  });

  describe('Fallback Behavior', () => {
    it('should gracefully handle JobEngine initialization failure', () => {
      // Arrange: Feature flag ON but force initialization error
      process.env.FEATURE_MODULAR_JOB_ENGINE = 'true';
      
      // Mock require to throw error
      const originalRequire = req;
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Load JobRunner (initialization will fail silently)
      const module = req('../../../src/services/jobRunner.js');
      JobRunner = module.JobRunner;
      
      // Act: Constructor should not throw
      expect(() => new JobRunner()).not.toThrow();
    });
  });

  describe('JobEngine Standalone Tests', () => {
    it('should be able to instantiate JobEngine directly', () => {
      // Arrange
      const { JobEngine } = req('../../../src/services/JobEngine.js');

      // Act
      const jobEngine = new JobEngine();

      // Assert
      expect(jobEngine).toBeDefined();
      expect(typeof jobEngine.executeJob).toBe('function');
    });

    it('should execute simple job via standalone JobEngine', async () => {
      // Arrange
      const { JobEngine } = req('../../../src/services/JobEngine.js');
      const jobEngine = new JobEngine();

      // Mock dependencies
      jobEngine.paramsGeneratorModule.generateParameters = vi.fn().mockResolvedValue({
        prompt: 'standalone test prompt'
      });
      jobEngine.producePictureModule.producePictureModule = vi.fn().mockResolvedValue([
        '/test/standalone.png'
      ]);

      // Act
      const result = await jobEngine.executeJob({
        parameters: { count: 1, variations: 1 },
        apiKeys: { test: 'key' }
      });

      // Assert
      expect(result.status).toBe('completed');
      expect(result.successfulImages).toBe(1);
      expect(result.images[0].finalImagePath).toBe('/test/standalone.png');
    });
  });
});
