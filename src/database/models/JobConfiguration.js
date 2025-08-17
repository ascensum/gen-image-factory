const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * JobConfiguration Database Model
 * 
 * Security Implementation:
 * - Current: Settings stored in plain text (dev/testing phase)
 * - Future: API keys will be encrypted in Story 1.11
 * - Note: Plain text storage is acceptable for development
 */
class JobConfiguration {
  constructor() {
    this.dbPath = path.join(__dirname, '../../../data/settings.db');
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS job_configurations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          settings TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(createTableSQL, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
        } else {
          console.log('Job configurations table created successfully');
          resolve();
        }
      });
    });
  }

  async saveSettings(settingsObject, configName = 'default') {
    return new Promise((resolve, reject) => {
      const settingsJson = JSON.stringify(settingsObject);
      const sql = `
        INSERT OR REPLACE INTO job_configurations (name, settings, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(sql, [configName, settingsJson], function(err) {
        if (err) {
          console.error('Error saving settings:', err);
          reject(err);
        } else {
          console.log('Settings saved successfully');
          resolve({ success: true, id: this.lastID });
        }
      });
    });
  }

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
          resolve({ success: true, settings: this.getDefaultSettings() });
        }
      });
    });
  }

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
            resolve({ 
              success: true, 
              configuration: {
                id: row.id,
                name: row.name,
                settings: settings,
                createdAt: row.created_at,
                updatedAt: row.updated_at
              }
            });
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

  async updateConfiguration(id, settingsObject) {
    return new Promise((resolve, reject) => {
      const settingsJson = JSON.stringify(settingsObject);
      const sql = `
        UPDATE job_configurations 
        SET settings = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

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

  async getAllConfigurations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT name, created_at, updated_at FROM job_configurations ORDER BY updated_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error getting all configurations:', err);
          reject(err);
        } else {
          resolve({ success: true, configurations: rows });
        }
      });
    });
  }

  async deleteConfiguration(configName) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM job_configurations WHERE name = ?';
      
      this.db.run(sql, [configName], function(err) {
        if (err) {
          console.error('Error deleting configuration:', err);
          reject(err);
        } else {
          resolve({ success: true, deletedRows: this.changes });
        }
      });
    });
  }

  getDefaultSettings() {
    // Get user-accessible paths for Electron app
    let outputDir, tempDir;
    
    try {
      // In Electron context, use app.getPath('userData')
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      outputDir = path.join(userDataPath, 'pictures', 'toupload');
      tempDir = path.join(userDataPath, 'pictures', 'generated');
    } catch (error) {
      // Fallback for non-Electron context (e.g., testing)
      const os = require('os');
      const homeDir = os.homedir();
      outputDir = path.join(homeDir, 'gen-image-factory', 'pictures', 'toupload');
      tempDir = path.join(homeDir, 'gen-image-factory', 'pictures', 'generated');
    }

    return {
      apiKeys: {
        openai: '',
        piapi: '',
        removeBg: ''
      },
      filePaths: {
        outputDirectory: outputDir,
        tempDirectory: tempDir,
        systemPromptFile: '',
        keywordsFile: '',
        qualityCheckPromptFile: '',
        metadataPromptFile: ''
      },
      parameters: {
        processMode: 'relax',
        aspectRatios: ['1:1', '16:9', '9:16'],
        mjVersion: '6.1',
        openaiModel: 'gpt-4o',
        pollingTimeout: 15,
        enablePollingTimeout: true,
        keywordRandom: false,
        count: 1
      },
      processing: {
        removeBg: false,
        imageConvert: false,
        imageEnhancement: false,
        sharpening: 5,
        saturation: 1.4,
        convertToJpg: false,
        trimTransparentBackground: false,
        jpgBackground: 'white',
        jpgQuality: 100,
        pngQuality: 100,
        removeBgSize: 'auto'
      },
      ai: {
        runQualityCheck: true,
        runMetadataGen: true
      },
      advanced: {
        debugMode: false
      }
    };
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = { JobConfiguration }; 