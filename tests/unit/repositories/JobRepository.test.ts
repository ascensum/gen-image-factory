/**
 * Unit Tests: JobRepository
 * 
 * Purpose: Test JobRepository in isolation with mocked dependencies
 * Coverage Goal: ≥70% statement and branch coverage
 * 
 * Testing Strategy:
 * - Mock database connection (this.db)
 * - Mock jobExecutionModel
 * - Test each method's query logic and data transformations
 * - Test edge cases: null values, empty arrays, invalid inputs
 * 
 * Related: Story 3.2 Phase 1 Task 1.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRepository Unit Tests', () => {
  let JobRepository: any;
  let repository: any;
  let mockDb: any;
  let mockModel: any;

  beforeEach(() => {
    // Clear module cache
    delete req.cache[req.resolve('../../../src/repositories/JobRepository.js')];
    
    // Load JobRepository
    const module = req('../../../src/repositories/JobRepository.js');
    JobRepository = module.JobRepository;

    // Create mock database
    mockDb = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn()
    };

    // Create mock model
    mockModel = {
      db: mockDb
    };

    // Create repository instance
    repository = new JobRepository(mockModel);
  });

  describe('getJobHistory()', () => {
    it('should execute LEFT JOIN query and return executions', async () => {
      // Arrange
      const mockRows = [
        {
          id: 1,
          configuration_id: 10,
          configuration_label: 'Test Config',
          configuration_name: 'test-config',
          started_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T01:00:00Z',
          status: 'completed',
          total_images: 10,
          successful_images: 8,
          failed_images: 2,
          error_message: null,
          label: 'Test Job',
          configuration_snapshot: JSON.stringify({ test: 'data' })
        }
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      // Act
      const result = await repository.getJobHistory(50);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN job_configurations'),
        [50],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].id).toBe(1);
      expect(result.executions[0].configurationLabel).toBe('Test Config');
      expect(result.executions[0].configurationSnapshot).toEqual({ test: 'data' });
    });

    it('should handle empty results', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.getJobHistory(50);

      // Assert
      expect(result.success).toBe(true);
      expect(result.executions).toEqual([]);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Database error'), null);
      });

      // Act & Assert
      await expect(repository.getJobHistory(50)).rejects.toThrow('Database error');
    });
  });

  describe('getJobStatistics()', () => {
    it('should execute aggregation query and return statistics', async () => {
      // Arrange
      const mockStats = {
        totalJobs: 100,
        completedJobs: 80,
        failedJobs: 15,
        runningJobs: 5,
        totalImages: 1000,
        successfulImages: 900,
        failedImages: 100,
        avgDurationSeconds: 3600
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockStats);
      });

      // Act
      const result = await repository.getJobStatistics();

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.statistics).toEqual(mockStats);
    });

    it('should handle zero statistics with defaults', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          runningJobs: 0,
          totalImages: 0,
          successfulImages: 0,
          failedImages: 0,
          avgDurationSeconds: 0
        });
      });

      // Act
      const result = await repository.getJobStatistics();

      // Assert
      expect(result.statistics.totalJobs).toBe(0);
      expect(result.statistics.avgDurationSeconds).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Stats error'), null);
      });

      // Act & Assert
      await expect(repository.getJobStatistics()).rejects.toThrow('Stats error');
    });
  });

  describe('getJobExecutionsWithFilters()', () => {
    it('should apply status filter', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      await repository.getJobExecutionsWithFilters({ status: 'completed' }, 1, 25);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE je.status = ?'),
        expect.arrayContaining(['completed', 25, 0]),
        expect.any(Function)
      );
    });

    it('should apply multiple filters', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const filters = {
        status: 'completed',
        configurationId: 10,
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      // Act
      await repository.getJobExecutionsWithFilters(filters, 1, 25);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['completed', 10, '2024-01-01', '2024-01-31', 25, 0]),
        expect.any(Function)
      );
    });

    it('should handle pagination', async () => {
      // Arrange
      const mockRows = Array(25).fill(null).map((_, i) => ({
        id: i + 1,
        configuration_id: 1,
        started_at: '2024-01-01T00:00:00Z',
        status: 'completed',
        total_images: 10,
        successful_images: 10,
        failed_images: 0
      }));

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      // Act
      const result = await repository.getJobExecutionsWithFilters({}, 2, 25);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([25, 25]), // pageSize, offset
        expect.any(Function)
      );
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(25);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle no filters (empty WHERE clause)', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      await repository.getJobExecutionsWithFilters({}, 1, 25);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        [25, 0],
        expect.any(Function)
      );
    });
  });

  describe('getJobExecutionsCount()', () => {
    it('should count with filters', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 42 });
      });

      // Act
      const result = await repository.getJobExecutionsCount({ status: 'completed' });

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['completed'],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.count).toBe(42);
    });

    it('should handle zero count', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 0 });
      });

      // Act
      const result = await repository.getJobExecutionsCount({});

      // Assert
      expect(result.count).toBe(0);
    });
  });

  describe('updateJobExecutionStatistics()', () => {
    it('should call calculateJobExecutionStatistics then UPDATE with total/successful/failed (generation failed)', async () => {
      // updateJobExecutionStatistics calls calculateJobExecutionStatistics first
      mockDb.get
        .mockImplementationOnce((sql, params, callback) => {
          expect(sql).toContain('total_images');
          callback(null, { total_images: 10 });
        })
        .mockImplementationOnce((sql, params, callback) => {
          expect(sql).toContain('generated_images');
          callback(null, { actualImages: 8, approvedImages: 5, qcFailedImages: 3 });
        });
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      const result = await repository.updateJobExecutionStatistics(1);

      expect(mockDb.get).toHaveBeenCalledTimes(2);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE job_executions'),
        [10, 8, 2, 1],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should handle non-existent execution (0 changes)', async () => {
      mockDb.get
        .mockImplementationOnce((_s, _p, cb) => cb(null, null))
        .mockImplementationOnce((_s, _p, cb) => cb(null, { actualImages: 0, approvedImages: 0, qcFailedImages: 0 }));
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      const result = await repository.updateJobExecutionStatistics(999);

      expect(result.changes).toBe(0);
    });
  });

  describe('getJobExecutionsByIds()', () => {
    it('should get multiple executions by IDs', async () => {
      // Arrange
      const ids = [1, 2, 3];
      const mockRows = ids.map(id => ({
        id,
        configuration_id: 10,
        started_at: '2024-01-01T00:00:00Z',
        status: 'completed',
        total_images: 10,
        successful_images: 10,
        failed_images: 0
      }));

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      // Act
      const result = await repository.getJobExecutionsByIds(ids);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE je.id IN'),
        ids,
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.executions).toHaveLength(3);
    });

    it('should handle empty array input', async () => {
      // Act
      const result = await repository.getJobExecutionsByIds([]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No IDs provided');
    });

    it('should handle non-array input', async () => {
      // Act
      const result = await repository.getJobExecutionsByIds(null as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No IDs provided');
    });
  });

  // ===== NEW CRUD METHODS (Story 3.2 - Latest Changes) =====

  describe('saveJobExecution()', () => {
    it('should insert new job execution with all fields', async () => {
      // Arrange
      const execution = {
        configurationId: 'job-456',
        status: 'running',
        totalImages: 100,
        successfulImages: 0,
        failedImages: 0,
        errorMessage: null
      };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      // Act
      const result = await repository.saveJobExecution(execution);

      // Assert
      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO job_executions'),
        expect.arrayContaining(['job-456', 'running']),
        expect.any(Function)
      );
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Insert failed'));
      });

      // Act & Assert
      await expect(repository.saveJobExecution({ configurationId: 'job-1' })).rejects.toThrow('Insert failed');
    });
  });

  describe('getJobExecution()', () => {
    it('should retrieve job execution by ID', async () => {
      // Arrange
      const mockExecution = {
        id: 'exec-123',
        job_config_id: 'job-456',
        status: 'completed',
        timestamp: 1706543210000
      };
      
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockExecution);
      });

      // Act
      const result = await repository.getJobExecution('exec-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.execution.id).toBe('exec-123');
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM job_executions WHERE id = ?'),
        ['exec-123'],
        expect.any(Function)
      );
    });

    it('should return false for non-existent execution', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, undefined);
      });

      // Act
      const result = await repository.getJobExecution('non-existent');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Job execution not found');
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Query failed'), null);
      });

      // Act & Assert
      await expect(repository.getJobExecution('exec-1')).rejects.toThrow('Query failed');
    });
  });

  describe('getAllJobExecutions()', () => {
    it('should retrieve all job executions', async () => {
      // Arrange
      const mockExecutions = [
        { id: 'exec-1', status: 'completed', configuration_id: 'job-1' },
        { id: 'exec-2', status: 'running', configuration_id: 'job-2' }
      ];
      
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockExecutions);
      });

      // Act
      const result = await repository.getAllJobExecutions();

      // Assert
      expect(result.success).toBe(true);
      expect(result.executions).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM job_executions'),
        [],
        expect.any(Function)
      );
    });

    it('should return empty array when no executions exist', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.getAllJobExecutions();

      // Assert
      expect(result.success).toBe(true);
      expect(result.executions).toEqual([]);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Query failed'), null);
      });

      // Act & Assert
      await expect(repository.getAllJobExecutions()).rejects.toThrow('Query failed');
    });
  });

  describe('updateJobExecution()', () => {
    it('should update job execution fields', async () => {
      // Arrange
      const updates = {
        status: 'completed',
        successfulImages: 100,
        failedImages: 5,
        errorMessage: null
      };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateJobExecution('exec-123', updates);

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE job_executions SET'),
        expect.arrayContaining(['completed', 100, 5]),
        expect.any(Function)
      );
    });

    it('should handle partial updates', async () => {
      // Arrange
      const updates = { status: 'failed' };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateJobExecution('exec-123', updates);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should return 0 changes for non-existent execution', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      // Act
      const result = await repository.updateJobExecution('non-existent', { status: 'completed' });

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Update failed'));
      });

      // Act & Assert
      await expect(repository.updateJobExecution('exec-1', { status: 'failed' })).rejects.toThrow('Update failed');
    });
  });

  describe('deleteJobExecution()', () => {
    it('should delete job execution by ID', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.deleteJobExecution('exec-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM job_executions WHERE id = ?'),
        ['exec-123'],
        expect.any(Function)
      );
    });

    it('should return 0 deletedRows for non-existent execution', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      // Act
      const result = await repository.deleteJobExecution('non-existent');

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Delete failed'));
      });

      // Act & Assert
      await expect(repository.deleteJobExecution('exec-1')).rejects.toThrow('Delete failed');
    });
  });

  describe('calculateJobExecutionStatistics() - CRITICAL (18 fallbacks)', () => {
    it('should calculate statistics from generated_images table', async () => {
      // Arrange
      let callCount = 0;
      mockDb.get.mockImplementation((sql, params, callback) => {
        callCount++;
        if (callCount === 1) {
          // First call: get total_images from job_executions
          callback(null, { total_images: 100 });
        } else {
          // Second call: get image statistics
          callback(null, {
            actualImages: 95,
            approvedImages: 85,
            qcFailedImages: 10
          });
        }
      });

      // Act
      const result = await repository.calculateJobExecutionStatistics('exec-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(100);
      expect(result.statistics.successfulImages).toBe(95);
      expect(result.statistics.approvedImages).toBe(85);
      expect(result.statistics.qcFailedImages).toBe(10);
      expect(result.statistics.failedImages).toBe(5); // 100 - 95 = 5
    });

    it('should handle NULL statistics with defaults', async () => {
      // Arrange
      let callCount = 0;
      mockDb.get.mockImplementation((sql, params, callback) => {
        callCount++;
        if (callCount === 1) {
          callback(null, { total_images: null });
        } else {
          callback(null, {
            actualImages: null,
            approvedImages: null,
            qcFailedImages: null
          });
        }
      });

      // Act
      const result = await repository.calculateJobExecutionStatistics('exec-new');

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(0);
      expect(result.statistics.successfulImages).toBe(0);
      expect(result.statistics.failedImages).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Stats query failed'), null);
      });

      // Act & Assert
      await expect(repository.calculateJobExecutionStatistics('exec-1')).rejects.toThrow('Stats query failed');
    });
  });

  describe('updateJobExecutionStatus()', () => {
    it('should run UPDATE with status only when no jobId or errorMessage', async () => {
      mockDb.run.mockImplementation(function(sql, params, cb) { cb.call({ changes: 1 }, null); });
      const result = await repository.updateJobExecutionStatus(1, 'failed');
      expect(mockDb.run).toHaveBeenCalledWith('UPDATE job_executions SET status = ? WHERE id = ?', ['failed', 1], expect.any(Function));
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
    it('should run UPDATE with status and error_message when errorMessage provided', async () => {
      mockDb.run.mockImplementation(function(sql, params, cb) { cb.call({ changes: 1 }, null); });
      await repository.updateJobExecutionStatus(2, 'failed', null, 'Network error');
      expect(mockDb.run).toHaveBeenCalledWith('UPDATE job_executions SET status = ?, error_message = ? WHERE id = ?', ['failed', 'Network error', 2], expect.any(Function));
    });
    it('should run UPDATE with status, job_id, error_message when both provided', async () => {
      mockDb.run.mockImplementation(function(sql, params, cb) { cb.call({ changes: 1 }, null); });
      await repository.updateJobExecutionStatus(3, 'stopped', 'job-123', 'Stopped by user');
      expect(mockDb.run).toHaveBeenCalledWith('UPDATE job_executions SET status = ?, job_id = ?, error_message = ? WHERE id = ?', ['stopped', 'job-123', 'Stopped by user', 3], expect.any(Function));
    });
  });

  describe('renameJobExecution()', () => {
    it('should run UPDATE label and return changes', async () => {
      mockDb.run.mockImplementation(function(sql, params, cb) { cb.call({ changes: 1 }, null); });
      const result = await repository.renameJobExecution(1, 'New Label');
      expect(mockDb.run).toHaveBeenCalledWith('UPDATE job_executions SET label = ? WHERE id = ?', ['New Label', 1], expect.any(Function));
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
  });

  describe('exportJobExecution()', () => {
    it('should return export data from JOIN query', async () => {
      const row = { id: 1, configuration_name: 'cfg1', started_at: '2024-01-01', completed_at: '2024-01-02', status: 'completed', total_images: 5, successful_images: 5, failed_images: 0, error_message: null, label: 'Job 1' };
      mockDb.get.mockImplementation((sql, params, cb) => cb(null, row));
      const result = await repository.exportJobExecution(1);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.data.configurationName).toBe('cfg1');
      expect(result.data.label).toBe('Job 1');
    });
    it('should reject when job not found', async () => {
      mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));
      await expect(repository.exportJobExecution(999)).rejects.toThrow('Job execution not found');
    });
  });

  describe('bulkDeleteJobExecutions()', () => {
    it('should return deletedRows 0 when ids empty', async () => {
      const result = await repository.bulkDeleteJobExecutions([]);
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(0);
      expect(mockDb.run).not.toHaveBeenCalled();
    });
    it('should run DELETE WHERE id IN and return deletedRows', async () => {
      mockDb.run.mockImplementation(function(sql, params, cb) { cb.call({ changes: 3 }, null); });
      const result = await repository.bulkDeleteJobExecutions([1, 2, 3]);
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM job_executions WHERE id IN (?,?,?)', [1, 2, 3], expect.any(Function));
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(3);
    });
  });
});
