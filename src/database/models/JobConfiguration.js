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
    // Cross-platform database path resolution that works on all OS
    const possiblePaths = [];
    
    // 1. PRIMARY: Use Electron's built-in cross-platform userData path (most reliable)
    try {
      const { app } = require('electron');
      if (app && app.getPath) {
        const userDataPath = app.getPath('userData');
        possiblePaths.push(path.join(userDataPath, 'gen-image-factory.db'));
        console.log('✅ Using Electron cross-platform userData path');
      }
    } catch (error) {
      // Electron not available or app not ready
      console.log('ℹ️ Electron not available, using fallback paths');
    }
    
    // 2. FALLBACK: Use OS-agnostic home directory approach (works on all platforms)
    try {
      const os = require('os');
      const homeDir = os.homedir();
      
      // Create a hidden folder in user's home directory (works on all OS)
      const appDataDir = path.join(homeDir, '.gen-image-factory');
      possiblePaths.push(path.join(appDataDir, 'gen-image-factory.db'));
      console.log('✅ Using cross-platform home directory fallback');
    } catch (error) {
      console.log('❌ Home directory detection failed:', error.message);
    }
    
    // 3. DEVELOPMENT: Use project-relative paths for development/testing
    try {
      const projectRoot = process.cwd();
      possiblePaths.push(path.join(projectRoot, 'data', 'gen-image-factory.db'));
      console.log('✅ Using development project path');
    } catch (error) {
      console.log('❌ Project path detection failed:', error.message);
    }
    
    // 4. LAST RESORT: Use __dirname-based paths
    try {
      const currentDir = __dirname;
      possiblePaths.push(path.join(currentDir, '..', '..', '..', 'data', 'gen-image-factory.db'));
      console.log('✅ Using __dirname fallback path');
    } catch (error) {
      console.log('❌ __dirname resolution failed:', error.message);
    }
    
    // Find the first accessible path
    for (const dbPath of possiblePaths) {
      try {
        const dbDir = path.dirname(dbPath);
        
        // Ensure directory exists
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        
        // Test write access
        const testFile = path.join(dbDir, '.test-write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        console.log(`✅ Database path resolved: ${dbPath}`);
        return dbPath;
      } catch (error) {
        console.log(`❌ Path not accessible: ${dbPath} - ${error.message}`);
        continue;
      }
    }
    
    // Final fallback: use home directory with hidden folder (works on all OS)
    const finalFallback = path.join(require('os').homedir(), '.gen-image-factory', 'gen-image-factory.db');
    console.warn(`⚠️ Using final cross-platform fallback: ${finalFallback}`);
    return finalFallback;
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