/**
 * JobExecution + JobRepository Integration Tests
 * Story 5.2: Updated to use JobRepository instead of deprecated model query methods.
 * JobExecution model is now schema-only; all queries routed through JobRepository (ADR-009).
 */
const { JobExecution } = require('../../../src/database/models/JobExecution');
const { JobRepository } = require('../../../src/repositories/JobRepository');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('JobExecution Model', () => {
  let jobExecution;
  let jobRepository;
  let testDbPath;

  beforeAll(async () => {
    testDbPath = path.join(os.tmpdir(), `test-job-executions-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });

    jobExecution = new JobExecution();
    jobExecution.dbPath = testDbPath;

    if (jobExecution.db) {
      await new Promise((resolve) => { jobExecution.db.close(() => resolve()); });
    }

    await jobExecution.init();
    jobRepository = new JobRepository(jobExecution);

    const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
      jobExecution.db.run(sql, params, (err) => { if (err) reject(err); else resolve(); });
    });

    await dbRun(`CREATE TABLE IF NOT EXISTS job_configurations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, settings TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await dbRun(`INSERT OR REPLACE INTO job_configurations (id, name, settings) VALUES (1, 'test-config', '{"test": "settings"}')`);
    await dbRun(`INSERT OR REPLACE INTO job_configurations (id, name, settings) VALUES (2, 'test-config-2', '{"test": "settings2"}')`);
    await dbRun(`CREATE TABLE IF NOT EXISTS generated_images (id INTEGER PRIMARY KEY AUTOINCREMENT, image_mapping_id TEXT NOT NULL, execution_id INTEGER, generation_prompt TEXT, seed INTEGER, qc_status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (execution_id) REFERENCES job_executions(id))`);
  });

  afterAll(async () => {
    if (jobExecution && jobExecution.db) {
      jobExecution.close();
    }
    try {
      if (testDbPath && await fs.access(testDbPath).then(() => true).catch(() => false)) {
        await fs.unlink(testDbPath);
      }
    } catch {}
  });

  beforeEach(async () => {
    await new Promise((resolve, reject) => {
      jobExecution.db.run('DELETE FROM job_executions', (err) => { if (err) reject(err); else resolve(); });
    });
  });

  describe('CRUD Operations', () => {
    test('should create a job execution', async () => {
      const execution = { configurationId: 1, status: 'running', totalImages: 5, successfulImages: 3, failedImages: 2 };
      const result = await jobRepository.saveJobExecution(execution);
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should retrieve a job execution by id', async () => {
      const execution = { configurationId: 1, status: 'completed', totalImages: 10, successfulImages: 8, failedImages: 2 };
      const saveResult = await jobRepository.saveJobExecution(execution);
      const getResult = await jobRepository.getJobExecution(saveResult.id);
      expect(getResult.success).toBe(true);
      expect(getResult.execution).toBeDefined();
      expect(getResult.execution.configurationId).toBe(1);
      expect(getResult.execution.status).toBe('completed');
      expect(getResult.execution.totalImages).toBe(10);
    });

    test('should update a job execution', async () => {
      const execution = { configurationId: 1, status: 'running', totalImages: 5 };
      const saveResult = await jobRepository.saveJobExecution(execution);
      const updatedExecution = { ...execution, status: 'completed', completedAt: new Date(), successfulImages: 4, failedImages: 1 };
      const updateResult = await jobRepository.updateJobExecution(saveResult.id, updatedExecution);
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toBe(1);
      const getResult = await jobRepository.getJobExecution(saveResult.id);
      expect(getResult.execution.status).toBe('completed');
      expect(getResult.execution.successfulImages).toBe(4);
    });

    test('should delete a job execution', async () => {
      const execution = { configurationId: 1, status: 'running', totalImages: 5 };
      const saveResult = await jobRepository.saveJobExecution(execution);
      const deleteResult = await jobRepository.deleteJobExecution(saveResult.id);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedRows).toBe(1);
      const getResult = await jobRepository.getJobExecution(saveResult.id);
      expect(getResult.success).toBe(false);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const executions = [
        { configurationId: 1, status: 'completed', totalImages: 5, successfulImages: 4, failedImages: 1 },
        { configurationId: 1, status: 'failed', totalImages: 3, successfulImages: 0, failedImages: 3 },
        { configurationId: 2, status: 'running', totalImages: 10, successfulImages: 7, failedImages: 3 },
        { configurationId: 2, status: 'completed', totalImages: 8, successfulImages: 8, failedImages: 0 }
      ];
      for (const execution of executions) {
        await jobRepository.saveJobExecution(execution);
      }
    });

    test('should get all job executions', async () => {
      const result = await jobRepository.getAllJobExecutions();
      expect(result.success).toBe(true);
      expect(result.executions).toBeDefined();
      expect(result.executions.length).toBe(4);
      expect(result.executions[0].startedAt).toBeInstanceOf(Date);
    });

    test('should get job history with limit', async () => {
      const result = await jobRepository.getJobHistory(2);
      expect(result.success).toBe(true);
      expect(result.executions).toBeDefined();
      expect(result.executions.length).toBe(2);
      expect(result.executions[0].startedAt).toBeInstanceOf(Date);
    });

    test('should get job statistics', async () => {
      const result = await jobRepository.getJobStatistics();
      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalJobs).toBe(4);
      expect(result.statistics.completedJobs).toBe(2);
      expect(result.statistics.failedJobs).toBe(1);
      expect(result.statistics.totalImages).toBe(26);
      expect(result.statistics.successfulImages).toBe(19);
      expect(result.statistics.failedImages).toBe(7);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle non-existent job execution', async () => {
      const result = await jobRepository.getJobExecution(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Job execution not found');
    });

    test('should handle invalid job execution data', async () => {
      const invalidExecution = { status: 'running' };
      try {
        await jobRepository.saveJobExecution(invalidExecution);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle cleanup of old executions via direct DB', async () => {
      await new Promise((resolve, reject) => {
        jobExecution.db.run(`INSERT INTO job_executions (configuration_id, started_at) VALUES (1, datetime('now', '-31 days'))`, (err) => (err ? reject(err) : resolve()));
      });
      // Cleanup via direct SQL (model no longer has cleanupOldExecutions)
      const result = await new Promise((resolve, reject) => {
        jobExecution.db.run(`DELETE FROM job_executions WHERE started_at < datetime('now', '-30 days')`, function(err) {
          if (err) reject(err);
          else resolve({ success: true, deletedRows: this.changes });
        });
      });
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(1);
    });

    test('should handle database connection errors', async () => {
      const invalidJobExecution = new JobExecution();
      invalidJobExecution.dbPath = '/invalid/path/test.db';
      try {
        await invalidJobExecution.init();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Data Validation', () => {
    test('should validate job status values', async () => {
      const validStatuses = ['running', 'completed', 'failed', 'cancelled'];
      for (const status of validStatuses) {
        const result = await jobRepository.saveJobExecution({ configurationId: 1, status });
        expect(result.success).toBe(true);
      }
    });

    test('should handle date conversions correctly', async () => {
      const execution = {
        configurationId: 1,
        startedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T11:00:00Z'),
        status: 'completed'
      };
      const saveResult = await jobRepository.saveJobExecution(execution);
      const getResult = await jobRepository.getJobExecution(saveResult.id);
      expect(getResult.execution.startedAt).toBeInstanceOf(Date);
      expect(getResult.execution.completedAt).toBeInstanceOf(Date);
      expect(getResult.execution.startedAt.getTime()).toBe(execution.startedAt.getTime());
      expect(getResult.execution.completedAt.getTime()).toBe(execution.completedAt.getTime());
    });
  });
});
