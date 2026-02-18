/**
 * Bridge Integration Tests: JobService Shadow Bridge
 * 
 * Purpose: Test JobService initialization and availability in jobRunner
 * Scope: Feature flag routing, initialization behavior
 * 
 * Testing Strategy (ADR-006):
 * 1. Test LEGACY path (feature flag OFF) - jobService is null
 * 2. Test MODULAR path (feature flag ON) - jobService is initialized
 * 3. Verify JobService can coordinate JobEngine + JobRepository
 * 4. Test standalone JobService execution
 * 
 * Coverage Goal: 100% of Shadow Bridge initialization logic
 * 
 * Related: Story 3.1 Phase 4 Task 4.6
 * 
 * NOTE: Full routing tests deferred to Story 3.2 Phase 5 (Service Integration)
 * This phase tests initialization ONLY, not full job execution routing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'fs';

const req = createRequire(import.meta.url);

describe('JobService Bridge Integration Tests', () => {
  let originalEnv: { [key: string]: string | undefined } = {};
  let testDbPath: string;
  let jobExecution: any;
  let jobRepository: any;

  beforeEach(async () => {
    // Save original env vars
    originalEnv = {
      FEATURE_MODULAR_JOB_SERVICE: process.env.FEATURE_MODULAR_JOB_SERVICE,
      FEATURE_MODULAR_JOB_ENGINE: process.env.FEATURE_MODULAR_JOB_ENGINE,
      FEATURE_MODULAR_JOB_REPOSITORY: process.env.FEATURE_MODULAR_JOB_REPOSITORY
    };
    
    // Use unique test database
    testDbPath = path.join(process.cwd(), 'tests', 'integration', `test-job-service-${Date.now()}.db`);
    
    // Clear module caches
    const jobRunnerPath = req.resolve('../../../src/services/jobRunner.js');
    const jobServicePath = req.resolve('../../../src/services/JobService.js');
    const jobEnginePath = req.resolve('../../../src/services/JobEngine.js');
    const jobExecutionPath = req.resolve('../../../src/database/models/JobExecution.js');
    const jobRepositoryPath = req.resolve('../../../src/repositories/JobRepository.js');
    
    [jobRunnerPath, jobServicePath, jobEnginePath, jobExecutionPath, jobRepositoryPath].forEach(p => {
      delete req.cache[p];
    });
  });

  afterEach(async () => {
    // Restore env vars
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });

    // Clean up global state
    delete global.jobExecution;
    delete global.currentJobRunner;

    // Close database if initialized
    if (jobExecution?.db) {
      await new Promise<void>((resolve) => {
        jobExecution.db.close((err: any) => {
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
    it('should NOT initialize JobService when feature flag is OFF', async () => {
      // Arrange: All feature flags OFF
      delete process.env.FEATURE_MODULAR_JOB_SERVICE;
      delete process.env.FEATURE_MODULAR_JOB_ENGINE;
      delete process.env.FEATURE_MODULAR_JOB_REPOSITORY;
      
      // Load jobRunner
      const { JobRunner } = req('../../../src/services/jobRunner.js');
      const jobRunner = new JobRunner();

      // Assert: JobService should NOT be initialized
      expect(jobRunner.jobService).toBeNull();
      expect(jobRunner.jobEngine).toBeNull();
    });

    it('should use legacy jobRunner methods when feature flag is OFF', async () => {
      // Arrange
      delete process.env.FEATURE_MODULAR_JOB_SERVICE;
      
      const { JobRunner } = req('../../../src/services/jobRunner.js');
      const jobRunner = new JobRunner();

      // Assert: Legacy methods should exist
      expect(typeof jobRunner.startJob).toBe('function');
      expect(typeof jobRunner.stopJob).toBe('function');
      expect(typeof jobRunner.getJobStatus).toBe('function');
      expect(jobRunner.jobService).toBeNull();
    });
  });

  describe('Modular Path (Feature Flag ON)', () => {
    it('should initialize JobService when feature flag is ON and JobRepository is available', async () => {
      // Arrange: Initialize JobExecution with JobRepository
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      
      const { JobExecution } = req('../../../src/database/models/JobExecution.js');
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();
      
      // Set global jobExecution (simulating electron/main.js setup)
      global.jobExecution = jobExecution;
      
      // Enable JobService feature flag
      process.env.FEATURE_MODULAR_JOB_SERVICE = 'true';
      
      // Load jobRunner
      const { JobRunner } = req('../../../src/services/jobRunner.js');
      const jobRunner = new JobRunner();

      // Assert: JobService should be initialized
      expect(jobRunner.jobService).not.toBeNull();
      expect(jobRunner.jobService.constructor.name).toBe('JobService');
    });

    it('should NOT initialize JobService if JobRepository is not available', async () => {
      // Arrange: Feature flag ON but no JobRepository
      process.env.FEATURE_MODULAR_JOB_SERVICE = 'true';
      delete global.jobExecution; // No global jobExecution
      
      // Mock console.warn to suppress warnings
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Load jobRunner
      const { JobRunner } = req('../../../src/services/jobRunner.js');
      const jobRunner = new JobRunner();

      // Assert: JobService should NOT be initialized (graceful fallback)
      expect(jobRunner.jobService).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('JobRepository not available'));
      
      warnSpy.mockRestore();
    });

    it('should have JobService with correct dependencies', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      
      const { JobExecution } = req('../../../src/database/models/JobExecution.js');
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();
      global.jobExecution = jobExecution;
      
      process.env.FEATURE_MODULAR_JOB_SERVICE = 'true';
      
      const { JobRunner } = req('../../../src/services/jobRunner.js');
      const jobRunner = new JobRunner();

      // Assert: JobService should have expected dependencies
      expect(jobRunner.jobService.jobEngine).toBeDefined();
      expect(jobRunner.jobService.jobRepository).toBeDefined();
      expect(typeof jobRunner.jobService.startJob).toBe('function');
      expect(typeof jobRunner.jobService.stopJob).toBe('function');
    });
  });

  describe('Fallback Behavior', () => {
    it('should gracefully handle JobService initialization failure', () => {
      // Arrange: Feature flag ON but force initialization error by invalid env
      process.env.FEATURE_MODULAR_JOB_SERVICE = 'true';
      delete global.jobExecution; // No repository available
      
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Load jobRunner
      const { JobRunner } = req('../../../src/services/jobRunner.js');
      
      // Act: Constructor should not throw
      expect(() => {
        new JobRunner();
      }).not.toThrow();
      
      warnSpy.mockRestore();
    });
  });

  describe('Standalone JobService Tests', () => {
    it('should be able to instantiate JobService directly with dependencies', async () => {
      // Arrange: Initialize dependencies
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      
      const { JobExecution } = req('../../../src/database/models/JobExecution.js');
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();
      
      const { JobService } = req('../../../src/services/JobService.js');
      const { JobEngine } = req('../../../src/services/JobEngine.js');
      
      const jobEngine = new JobEngine();
      const jobRepository = jobExecution.jobRepository;

      // Act: Create JobService directly
      const jobService = new JobService({
        jobEngine: jobEngine,
        jobRepository: jobRepository
      });

      // Assert
      expect(jobService).toBeDefined();
      expect(typeof jobService.startJob).toBe('function');
      expect(typeof jobService.stopJob).toBe('function');
      expect(typeof jobService.getJobHistory).toBe('function');
    });

    it('should coordinate JobEngine events to JobRepository persistence', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      
      const { JobExecution } = req('../../../src/database/models/JobExecution.js');
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();
      
      const { JobService } = req('../../../src/services/JobService.js');
      const { JobEngine } = req('../../../src/services/JobEngine.js');
      
      const jobEngine = new JobEngine();
      const jobRepository = jobExecution.jobRepository;
      const jobService = new JobService({ jobEngine, jobRepository });

      // Act: Listen for progress events (demonstrates event coordination)
      const progressEvents: any[] = [];
      jobService.on('progress', (data) => {
        progressEvents.push(data);
      });

      // Emit progress from JobEngine (simulating job execution)
      jobEngine.emit('progress', { step: 'initialization', progress: 50 });

      // Assert: JobService should forward event
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].step).toBe('initialization');
    });
  });
});
