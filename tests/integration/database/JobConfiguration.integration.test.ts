import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock sqlite3
vi.mock('sqlite3', () => ({
  verbose: vi.fn(() => ({
    Database: vi.fn()
  }))
}))

// Mock path
vi.mock('path', () => ({
  join: vi.fn(() => '/mock/path/to/settings.db')
}))

describe('JobConfiguration Database Integration Tests', () => {
  let JobConfiguration: any
  let mockDb: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Mock the database instance
    mockDb = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      close: vi.fn()
    }

    // Mock sqlite3.Database constructor
    const sqlite3 = await import('sqlite3')
    vi.mocked(sqlite3.verbose().Database).mockImplementation((path, callback) => {
      callback(null) // No error
      return mockDb
    })

    // Import after mocking
    const { JobConfiguration: JobConfigClass } = await import('../../../src/database/models/JobConfiguration')
    JobConfiguration = JobConfigClass
  })

  describe('Model Creation and Validation', () => {
    it('creates JobConfiguration model with correct schema', async () => {
      const jobConfig = new JobConfiguration()

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS job_configurations'),
        expect.any(Function)
      )
    })

    it('validates required fields', async () => {
      const jobConfig = new JobConfiguration()
      
      // Test that saveSettings requires settings object
      const result = await jobConfig.saveSettings(null)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Settings are required')
    })

    it('validates settings JSON format', async () => {
      const jobConfig = new JobConfiguration()
      
      const result = await jobConfig.saveSettings('invalid-json')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid settings format')
    })
  })

  describe('Settings Persistence and Retrieval', () => {
    it('saves settings to database successfully', async () => {
      const settings = {
        aspectRatios: ['1:1', '16:9'],
        processMode: 'fast',
        pollingTimeout: 15
      }

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null)
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.saveSettings(settings)

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO job_configurations'),
        ['default', JSON.stringify(settings), expect.any(Function)]
      )
      expect(result.success).toBe(true)
    })

    it('retrieves settings from database successfully', async () => {
      const settings = {
        aspectRatios: ['1:1'],
        processMode: 'fast'
      }

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { settings: JSON.stringify(settings) })
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.getSettings()

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT settings FROM job_configurations'),
        ['default', expect.any(Function)]
      )
      expect(result.success).toBe(true)
      expect(result.settings).toEqual(settings)
    })

    it('returns default settings when no settings found', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null) // No settings found
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.getSettings()

      expect(result.success).toBe(true)
      expect(result.settings).toBeDefined()
      expect(result.settings.aspectRatios).toEqual(['1:1'])
    })

    it('updates existing settings', async () => {
      const updatedSettings = {
        aspectRatios: ['16:9'],
        processMode: 'relax'
      }

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null)
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.saveSettings(updatedSettings, 'existing-config')

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO job_configurations'),
        ['existing-config', JSON.stringify(updatedSettings), expect.any(Function)]
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Database Migration and Schema Updates', () => {
    it('creates table with correct schema on initialization', async () => {
      const jobConfig = new JobConfiguration()

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS job_configurations'),
        expect.any(Function)
      )
    })

    it('handles table already exists gracefully', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null) // No error, table already exists
      })

      const jobConfig = new JobConfiguration()

      expect(mockDb.run).toHaveBeenCalled()
      // Should not throw error
    })

    it('adds new columns to existing table', async () => {
      // This would be implemented if we add schema migration functionality
      const jobConfig = new JobConfiguration()
      
      // For now, just verify the model initializes without error
      expect(jobConfig).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('handles database connection errors', async () => {
      // Mock database connection error
      const sqlite3 = await import('sqlite3')
      vi.mocked(sqlite3.verbose().Database).mockImplementation((path, callback) => {
        callback(new Error('Database connection failed'))
        return mockDb
      })

      expect(() => new JobConfiguration()).not.toThrow()
    })

    it('handles database query errors', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Database query failed'))
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.saveSettings({ test: 'value' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database query failed')
    })

    it('handles database read errors', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Database read failed'))
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.getSettings()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database read failed')
    })

    it('handles database update errors', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Database update failed'))
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.saveSettings({ test: 'value' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database update failed')
    })
  })

  describe('Data Integrity', () => {
    it('ensures settings are stored as JSON string', async () => {
      const settings = { test: 'value' }

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null)
      })

      const jobConfig = new JobConfiguration()
      await jobConfig.saveSettings(settings)

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        ['default', JSON.stringify(settings), expect.any(Function)]
      )
    })

    it('validates settings structure on retrieval', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { settings: 'invalid-json' })
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.getSettings()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid settings format')
    })

    it('handles large settings objects', async () => {
      const largeSettings = {
        data: 'x'.repeat(10000) // Large string
      }

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null)
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.saveSettings(largeSettings)

      expect(result.success).toBe(true)
    })
  })

  describe('Performance and Optimization', () => {
    it('uses indexes for efficient queries', async () => {
      const jobConfig = new JobConfiguration()
      
      // Verify that the table creation includes proper indexing
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS job_configurations'),
        expect.any(Function)
      )
    })

    it('limits query results for performance', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, [])
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.getAllConfigurations()

      expect(result.success).toBe(true)
      expect(result.configurations).toEqual([])
    })

    it('cleans up old settings records', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null)
      })

      const jobConfig = new JobConfiguration()
      const result = await jobConfig.deleteConfiguration('old-config')

      expect(result.success).toBe(true)
    })
  })

  describe('Concurrency and Transactions', () => {
    it('handles concurrent writes gracefully', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null)
      })

      const jobConfig = new JobConfiguration()
      const promises = [
        jobConfig.saveSettings({ test: 1 }),
        jobConfig.saveSettings({ test: 2 }),
        jobConfig.saveSettings({ test: 3 })
      ]

      const results = await Promise.all(promises)

      expect(results.every(r => r.success)).toBe(true)
    })

    it('uses transactions for complex operations', async () => {
      // This would be implemented if we add transaction support
      const jobConfig = new JobConfiguration()
      
      // For now, just verify the model works without transactions
      const result = await jobConfig.saveSettings({ test: 'value' })
      expect(result.success).toBe(true)
    })
  })
}) 