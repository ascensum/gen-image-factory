const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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
    // Cross-platform database path resolution
    this.dbPath = this.resolveDatabasePath();
    this.init();
  }

  resolveDatabasePath() {
    // Pin primary DB location to Electron userData when available, else project ./data
    let primaryPath = null;
    let usedElectron = false;
    try {
      const { app } = require('electron');
      if (app && app.getPath) {
        const userDataPath = app.getPath('userData');
        primaryPath = path.join(userDataPath, 'gen-image-factory.db');
        usedElectron = true;
      }
    } catch (_) {
      // Non-Electron context
    }

    if (!primaryPath) {
      const projectRoot = process.cwd();
      primaryPath = path.join(projectRoot, 'data', 'gen-image-factory.db');
    }

    const primaryDir = path.dirname(primaryPath);
    try {
      if (!fs.existsSync(primaryDir)) {
        fs.mkdirSync(primaryDir, { recursive: true });
      }
    } catch (e) {
      console.warn('⚠️ Could not ensure primary DB directory:', e.message);
    }

    // One-time migration from legacy locations if needed
    try {
      if (!fs.existsSync(primaryPath)) {
        const legacyPaths = [];
        try {
          const os = require('os');
          const homeDir = os.homedir();
          legacyPaths.push(path.join(homeDir, '.gen-image-factory', 'gen-image-factory.db'));
        } catch (_) {}
        legacyPaths.push(path.join(__dirname, '..', '..', '..', 'data', 'gen-image-factory.db'));
        const projectData = path.join(process.cwd(), 'data', 'gen-image-factory.db');
        if (projectData !== primaryPath) legacyPaths.push(projectData);

        for (const legacy of legacyPaths) {
          try {
            if (legacy && fs.existsSync(legacy)) {
              fs.copyFileSync(legacy, primaryPath);
              console.log(`🔁 Migrated database from legacy path to primary: ${legacy} -> ${primaryPath}`);
              break;
            }
          } catch (e) {
            console.warn(`⚠️ Failed migrating DB from ${legacy}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ DB migration check failed:', e.message);
    }

    // Cleanup legacy DB files by moving them into a backup folder under the primary directory
    try {
      const backupsDir = path.join(primaryDir, 'legacy-db-backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      const candidateLegacy = [];
      try {
        const os = require('os');
        const homeDir = os.homedir();
        candidateLegacy.push(path.join(homeDir, '.gen-image-factory', 'gen-image-factory.db'));
      } catch (_) {}
      candidateLegacy.push(path.join(__dirname, '..', '..', '..', 'data', 'gen-image-factory.db'));
      const projectData = path.join(process.cwd(), 'data', 'gen-image-factory.db');
      if (projectData !== primaryPath) candidateLegacy.push(projectData);

      for (const legacy of candidateLegacy) {
        if (!legacy || legacy === primaryPath) continue;
        if (fs.existsSync(legacy)) {
          const base = path.basename(legacy);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const dest = path.join(backupsDir, `${base}.${timestamp}.bak`);
          try {
            fs.renameSync(legacy, dest);
            ['-wal', '-shm'].forEach((suffix) => {
              const extra = legacy + suffix;
              if (fs.existsSync(extra)) {
                try { fs.renameSync(extra, dest + suffix); } catch {}
              }
            });
            console.log(`🧹 Moved legacy DB to backup: ${legacy} -> ${dest}`);
          } catch (e) {
            console.warn(`⚠️ Could not move legacy DB ${legacy}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Legacy DB cleanup skipped:', e.message);
    }

    console.log(`✅ Database path resolved (pinned${usedElectron ? ' userData' : ' project-data'}): ${primaryPath}`);
    return primaryPath;
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

  async updateConfigurationName(id, newName) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE job_configurations 
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

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
    // Get default paths for when user hasn't set custom paths
    let outputDir, tempDir;
    
    try {
      // In Electron context, use user-accessible directories
      const { app } = require('electron');
      
      // Use Desktop folder for default paths
      const desktopPath = app.getPath('desktop');
      outputDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
      tempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'generated');
      
      console.log(`📁 Using Electron Desktop path: ${desktopPath}`);
    } catch (error) {
      // Fallback for non-Electron context (e.g., testing)
      const os = require('os');
      const homeDir = os.homedir();
      
      // Use Documents folder as fallback
      outputDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'toupload');
      tempDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'generated');
      
      console.log(`📁 Using OS home directory fallback: ${homeDir}`);
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
        pollingInterval: 1,
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