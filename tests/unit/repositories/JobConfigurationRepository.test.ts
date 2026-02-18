/**
 * Unit Tests: JobConfigurationRepository
 * 
 * Purpose: Test JobConfigurationRepository in isolation with mocked dependencies
 * Coverage Goal: ≥70% statement and branch coverage
 * 
 * Testing Strategy:
 * - Mock database connection (this.db)
 * - Mock jobConfigurationModel
 * - Test each method's query logic and data transformations
 * - Test edge cases: null values, JSON parsing errors, invalid inputs
 * 
 * Related: Story 3.2 Phase 3 Task 3.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobConfigurationRepository Unit Tests', () => {
  let JobConfigurationRepository: any;
  let repository: any;
  let mockDb: any;
  let mockModel: any;

  beforeEach(() => {
    // Clear module cache
    delete req.cache[req.resolve('../../../src/repositories/JobConfigurationRepository.js')];
    
    // Load JobConfigurationRepository
    const module = req('../../../src/repositories/JobConfigurationRepository.js');
    JobConfigurationRepository = module.JobConfigurationRepository;

    // Create mock database
    mockDb = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn()
    };

    // Create mock model
    mockModel = {
      db: mockDb,
      getDefaultSettings: vi.fn().mockReturnValue({ default: 'settings' })
    };

    // Create repository instance
    repository = new JobConfigurationRepository(mockModel);
  });

  describe('saveSettings()', () => {
    it('should insert new configuration when name does not exist', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // No existing row
      });
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.lastID = 42;
        callback.call(this, null);
      });

      // Act
      const result = await repository.saveSettings({ test: 'data' }, 'test-config');

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM job_configurations'),
        ['test-config'],
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO job_configurations'),
        expect.arrayContaining(['test-config', JSON.stringify({ test: 'data' })]),
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.id).toBe(42);
      expect(result.name).toBe('test-config');
    });

    it('should update existing configuration when name exists', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 10 }); // Existing row
      });
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call(this, null);
      });

      // Act
      const result = await repository.saveSettings({ test: 'updated' }, 'existing-config');

      // Assert
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE job_configurations'),
        expect.arrayContaining([JSON.stringify({ test: 'updated' }), 10]),
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.id).toBe(10);
    });

    it('should reject on database error during check', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'), null);
      });

      // Act & Assert
      await expect(repository.saveSettings({ test: 'data' }, 'test')).rejects.toThrow('DB error');
    });
  });

  describe('getSettings()', () => {
    it('should return settings when configuration exists', async () => {
      // Arrange
      const mockSettings = { apiKey: 'test-key', mode: 'production' };
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { settings: JSON.stringify(mockSettings) });
      });

      // Act
      const result = await repository.getSettings('test-config');

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT settings FROM job_configurations'),
        ['test-config'],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockSettings);
    });

    it('should return default settings when configuration not found', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // No row found
      });

      // Act
      const result = await repository.getSettings('non-existent');

      // Assert
      expect(result.success).toBe(true);
      expect(result.settings).toEqual({ default: 'settings' });
      expect(mockModel.getDefaultSettings).toHaveBeenCalled();
    });

    it('should reject on JSON parse error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { settings: 'invalid-json{' });
      });

      // Act & Assert
      await expect(repository.getSettings('test')).rejects.toThrow();
    });
  });

  describe('getConfigurationById()', () => {
    it('should return full configuration when found', async () => {
      // Arrange
      const mockRow = {
        id: 5,
        name: 'test-config',
        settings: JSON.stringify({ mode: 'test' }),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockRow);
      });

      // Act
      const result = await repository.getConfigurationById(5);

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM job_configurations WHERE id = ?'),
        [5],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.configuration.id).toBe(5);
      expect(result.configuration.name).toBe('test-config');
      expect(result.configuration.settings).toEqual({ mode: 'test' });
    });

    it('should return error when configuration not found', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      // Act
      const result = await repository.getConfigurationById(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Configuration not found');
    });
  });

  describe('updateConfiguration()', () => {
    it('should update configuration settings', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      // Act
      const result = await repository.updateConfiguration(10, { updated: 'settings' });

      // Assert
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE job_configurations SET settings = ?'),
        [JSON.stringify({ updated: 'settings' }), 10],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should handle non-existent configuration (0 changes)', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      // Act
      const result = await repository.updateConfiguration(999, { test: 'data' });

      // Assert
      expect(result.changes).toBe(0);
    });
  });

  describe('updateConfigurationName()', () => {
    it('should update configuration name', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      // Act
      const result = await repository.updateConfigurationName(10, 'new-name');

      // Assert
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE job_configurations SET name = ?'),
        ['new-name', 10],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
  });

  describe('getAllConfigurations()', () => {
    it('should return all configurations with parsed settings', async () => {
      // Arrange
      const mockRows = [
        {
          id: 1,
          name: 'config-1',
          settings: JSON.stringify({ mode: 'test' }),
          created_at: '2024-01-01',
          updated_at: '2024-01-02'
        },
        {
          id: 2,
          name: 'config-2',
          settings: JSON.stringify({ mode: 'prod' }),
          created_at: '2024-01-03',
          updated_at: '2024-01-04'
        }
      ];
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      // Act
      const result = await repository.getAllConfigurations();

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM job_configurations'),
        [],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.configurations).toHaveLength(2);
      expect(result.configurations[0].settings).toEqual({ mode: 'test' });
      expect(result.configurations[1].settings).toEqual({ mode: 'prod' });
    });

    it('should handle empty result set', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.getAllConfigurations();

      // Assert
      expect(result.success).toBe(true);
      expect(result.configurations).toEqual([]);
    });
  });

  describe('deleteConfiguration()', () => {
    it('should delete configuration by name', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      // Act
      const result = await repository.deleteConfiguration('test-config');

      // Assert
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM job_configurations WHERE name = ?'),
        ['test-config'],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should handle non-existent configuration', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      // Act
      const result = await repository.deleteConfiguration('non-existent');

      // Assert
      expect(result.changes).toBe(0);
    });
  });
});
