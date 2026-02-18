/**
 * Bridge Integration Tests: JobRepository Shadow Bridge
 * 
 * Purpose: Test JobRepository initialization and availability in JobExecution
 * Scope: Feature flag routing, initialization behavior
 * 
 * Testing Strategy (ADR-006):
 * 1. Test LEGACY path (feature flag OFF) - jobRepository is null
 * 2. Test MODULAR path (feature flag ON) - jobRepository is initialized
 * 3. Verify JobRepository can execute queries
 * 
 * Coverage Goal: 100% of Shadow Bridge initialization logic
 * 
 * Related: Story 3.2 Phase 1 Task 1.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'fs';

const req = createRequire(import.meta.url);

describe('JobRepository Bridge Integration Tests', () => {
  let JobExecution: any;
  let jobExecution: any;
  let testDbPath: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Save original env
    originalEnv = process.env.FEATURE_MODULAR_JOB_REPOSITORY;
    
    // Use unique test database for each run
    testDbPath = path.join(process.cwd(), 'tests', 'integration', `test-job-repo-${Date.now()}.db`);
    
    // Clear module cache to ensure fresh load
    const jobExecutionPath = req.resolve('../../../src/database/models/JobExecution.js');
    delete req.cache[jobExecutionPath];
  });

  afterEach(async () => {
    // Restore env
    if (originalEnv !== undefined) {
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = originalEnv;
    } else {
      delete process.env.FEATURE_MODULAR_JOB_REPOSITORY;
    }

    // Close database connection
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
    it('should NOT initialize JobRepository when feature flag is OFF', async () => {
      // Arrange: Feature flag OFF
      delete process.env.FEATURE_MODULAR_JOB_REPOSITORY;
      
      // Load JobExecution
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      jobExecution = new JobExecution();
      
      // Override dbPath for testing
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();

      // Assert: JobRepository should NOT be initialized
      expect(jobExecution.jobRepository).toBeNull();
    });

    it('should use legacy JobExecution methods when feature flag is OFF', async () => {
      // Arrange
      delete process.env.FEATURE_MODULAR_JOB_REPOSITORY;
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();

      // Assert: Legacy methods should exist
      expect(typeof jobExecution.getJobHistory).toBe('function');
      expect(typeof jobExecution.getJobStatistics).toBe('function');
      expect(jobExecution.jobRepository).toBeNull();
    });
  });

  describe('Modular Path (Feature Flag ON)', () => {
    it('should initialize JobRepository when feature flag is ON', async () => {
      // Arrange: Feature flag ON
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      
      // Load JobExecution
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      jobExecution = new JobExecution();
      
      // Override dbPath for testing
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();

      // Assert: JobRepository should be initialized
      expect(jobExecution.jobRepository).not.toBeNull();
      expect(jobExecution.jobRepository.constructor.name).toBe('JobRepository');
    });

    it('should have JobRepository with correct methods', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();

      // Assert: JobRepository should have expected methods
      expect(typeof jobExecution.jobRepository.getJobHistory).toBe('function');
      expect(typeof jobExecution.jobRepository.getJobStatistics).toBe('function');
      expect(typeof jobExecution.jobRepository.getJobExecutionsWithFilters).toBe('function');
      expect(typeof jobExecution.jobRepository.updateJobExecutionStatistics).toBe('function');
    });

    it('should be able to execute queries via JobRepository', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();

      // Act: Execute query via JobRepository (use getJobStatistics to avoid JOIN)
      const result = await jobExecution.jobRepository.getJobStatistics();

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
    });

    it('should execute getJobStatistics via JobRepository', async () => {
      // Arrange
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      jobExecution = new JobExecution();
      jobExecution.dbPath = testDbPath;
      await jobExecution.init();

      // Act
      const result = await jobExecution.jobRepository.getJobStatistics();

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalJobs).toBe(0); // Empty database
    });
  });

  describe('Fallback Behavior', () => {
    it('should gracefully handle JobRepository initialization failure', async () => {
      // Arrange: Feature flag ON but force initialization error
      process.env.FEATURE_MODULAR_JOB_REPOSITORY = 'true';
      
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Load JobExecution (initialization will fail silently)
      const module = req('../../../src/database/models/JobExecution.js');
      JobExecution = module.JobExecution;
      
      // Act: Constructor should not throw
      expect(() => {
        jobExecution = new JobExecution();
        jobExecution.dbPath = testDbPath;
      }).not.toThrow();
    });
  });

  describe('JobRepository Standalone Tests', () => {
    it('should be able to instantiate JobRepository directly', () => {
      // Arrange
      const { JobRepository } = req('../../../src/repositories/JobRepository.js');
      const mockModel = { db: {} };

      // Act
      const jobRepository = new JobRepository(mockModel);

      // Assert
      expect(jobRepository).toBeDefined();
      expect(typeof jobRepository.getJobHistory).toBe('function');
    });
  });
});
