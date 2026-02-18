/**
 * JobConfigurationRepository - Persistence layer for job configurations
 * 
 * Architectural Pattern: Repository Layer (ADR-009)
 * Extracted from: src/database/models/JobConfiguration.js
 * 
 * Responsibility: Isolate all query logic and business operations for job_configurations table
 * 
 * CRITICAL: This is a SURGICAL EXTRACTION - query logic copied EXACTLY from JobConfiguration.js
 * NO "optimizations", NO query changes, NO business logic changes
 * Goal: Move code, not improve code
 * 
 * Related ADRs:
 * - ADR-001: File Size Guardrail (< 400 lines)
 * - ADR-003: Dependency Injection
 * - ADR-006: Shadow Bridge Pattern
 * - ADR-009: Persistence Repository Layer
 * 
 * Feature Toggle: FEATURE_MODULAR_CONFIG_REPOSITORY
 */

/**
 * JobConfigurationRepository
 * 
 * Handles all database operations for job_configurations table
 * Accepts jobConfigurationModel dependency (DI pattern)
 */
class JobConfigurationRepository {
  /**
   * @param {Object} jobConfigurationModel - JobConfiguration model instance (provides db connection)
   */
  constructor(jobConfigurationModel) {
    this.model = jobConfigurationModel;
    this.db = jobConfigurationModel.db;
  }

  /**
   * Save or update configuration (upsert logic)
   * 
   * Extracted from: JobConfiguration.js lines 180-224
   * Logic: SELECT to check existence, then INSERT or UPDATE
   * 
   * @param {Object} settingsObject - Configuration settings
   * @param {string} configName - Configuration name
   * @returns {Promise<Object>} { success: true, id, name }
   */
  async saveSettings(settingsObject, configName = 'default') {
    return new Promise((resolve, reject) => {
      const settingsJson = JSON.stringify(settingsObject);
      const selectSql = 'SELECT id FROM job_configurations WHERE name = ? LIMIT 1';
      const insertSql = `
        INSERT INTO job_configurations (name, settings, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      const updateSql = `
        UPDATE job_configurations SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `;

      this.db.get(selectSql, [configName], (err, row) => {
        if (err) {
          console.error('Error checking existing configuration:', err);
          reject(err);
          return;
        }

        if (row && row.id) {
          // Update existing config with same name (no REPLACE, preserve id)
          this.db.run(updateSql, [settingsJson, row.id], function(updateErr) {
            if (updateErr) {
              console.error('Error updating configuration:', updateErr);
              reject(updateErr);
            } else {
              console.log('Settings saved successfully (updated existing configuration)');
              resolve({ success: true, id: row.id, name: configName });
            }
          });
        } else {
          // Insert new configuration
          this.db.run(insertSql, [configName, settingsJson], function(insertErr) {
            if (insertErr) {
              console.error('Error inserting new configuration:', insertErr);
              reject(insertErr);
            } else {
              console.log('Settings saved successfully (inserted new configuration)');
              resolve({ success: true, id: this.lastID, name: configName });
            }
          });
        }
      });
    });
  }

  /**
   * Get configuration settings by name
   * 
   * Extracted from: JobConfiguration.js lines 226-248
   * Logic: SELECT by name, parse JSON, return default if not found
   * 
   * @param {string} configName - Configuration name
   * @returns {Promise<Object>} { success: true, settings }
   */
  async getSettings(configName = 'default') {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT settings FROM job_configurations WHERE name = ?';
      
      this.db.get(sql, [configName], (err, row) => {
        if (err) {
          console.error('Error getting settings:', err);
          reject(err);
        } else if (row) {
          try {
            const settings = JSON.parse(row.settings);
            resolve({ success: true, settings });
          } catch (parseError) {
            console.error('Error parsing settings JSON:', parseError);
            reject(parseError);
          }
        } else {
          // Return default settings if no configuration found
          resolve({ success: true, settings: this.model.getDefaultSettings() });
        }
      });
    });
  }

  /**
   * Get configuration by ID
   * 
   * Extracted from: JobConfiguration.js lines 250-280
   * Logic: SELECT by id, parse JSON, return full configuration object
   * 
   * @param {number|string} id - Configuration ID
   * @returns {Promise<Object>} { success: true, configuration: {...} }
   */
  async getConfigurationById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM job_configurations WHERE id = ?';
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          console.error('Error getting configuration by ID:', err);
          reject(err);
        } else if (row) {
          try {
            const settings = JSON.parse(row.settings);
            const result = { 
              success: true, 
              configuration: {
                id: row.id,
                name: row.name,
                settings: settings,
                createdAt: row.created_at,
                updatedAt: row.updated_at
              }
            };
            resolve(result);
          } catch (parseError) {
            console.error('Error parsing settings JSON:', parseError);
            reject(parseError);
          }
        } else {
          resolve({ success: false, error: 'Configuration not found' });
        }
      });
    });
  }

  /**
   * Update configuration by ID
   * 
   * Extracted from: JobConfiguration.js lines 283-303
   * Logic: UPDATE settings JSON by id
   * 
   * @param {number|string} id - Configuration ID
   * @param {Object} settingsObject - New settings
   * @returns {Promise<Object>} { success: true, changes }
   */
  async updateConfiguration(id, settingsObject) {
    return new Promise((resolve, reject) => {
      const settingsJson = JSON.stringify(settingsObject);
      const sql = 'UPDATE job_configurations SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      this.db.run(sql, [settingsJson, id], function(err) {
        if (err) {
          console.error('Error updating configuration:', err);
          reject(err);
        } else {
          console.log('Configuration updated successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  /**
   * Update configuration name by ID
   * 
   * Extracted from: JobConfiguration.js lines 304-323
   * Logic: UPDATE name only by id
   * 
   * @param {number|string} id - Configuration ID
   * @param {string} newName - New configuration name
   * @returns {Promise<Object>} { success: true, changes }
   */
  async updateConfigurationName(id, newName) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE job_configurations SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      this.db.run(sql, [newName, id], function(err) {
        if (err) {
          console.error('Error updating configuration name:', err);
          reject(err);
        } else {
          console.log('Configuration name updated successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get all configurations
   * 
   * Extracted from: JobConfiguration.js lines 324-338
   * Logic: SELECT all, parse JSON for each row
   * 
   * @returns {Promise<Object>} { success: true, configurations: [...] }
   */
  async getAllConfigurations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM job_configurations ORDER BY updated_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error getting all configurations:', err);
          reject(err);
        } else {
          const configurations = rows.map(row => ({
            id: row.id,
            name: row.name,
            settings: JSON.parse(row.settings),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          resolve({ success: true, configurations });
        }
      });
    });
  }

  /**
   * Delete configuration by name
   * 
   * Extracted from: JobConfiguration.js lines 339-358
   * Logic: DELETE by name
   * 
   * @param {string} configName - Configuration name to delete
   * @returns {Promise<Object>} { success: true, changes }
   */
  async deleteConfiguration(configName) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM job_configurations WHERE name = ?';
      
      this.db.run(sql, [configName], function(err) {
        if (err) {
          console.error('Error deleting configuration:', err);
          reject(err);
        } else {
          console.log('Configuration deleted successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }
}

module.exports = { JobConfigurationRepository };
