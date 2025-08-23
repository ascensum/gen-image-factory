const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * GeneratedImage Database Model
 * 
 * Stores metadata and file paths for generated images with foreign key relationship to JobExecution
 * Implements image metadata storage, retrieval, and cleanup operations
 */
class GeneratedImage {
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
        CREATE TABLE IF NOT EXISTS generated_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_mapping_id VARCHAR(50) UNIQUE NOT NULL,
          execution_id INTEGER,
          generation_prompt TEXT NOT NULL,
          seed INTEGER,
          qc_status VARCHAR(20) DEFAULT 'failed',
          qc_reason TEXT,
          final_image_path VARCHAR(500),
          metadata TEXT,
          processing_settings TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
        )
      `;

      const createIndexesSQL = [
        'CREATE INDEX IF NOT EXISTS idx_generated_images_execution_id ON generated_images(execution_id)',
        'CREATE INDEX IF NOT EXISTS idx_generated_images_image_mapping_id ON generated_images(image_mapping_id)',
        'CREATE INDEX IF NOT EXISTS idx_generated_images_qc_status ON generated_images(qc_status)',
        'CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at)'
      ];

      this.db.serialize(() => {
        // First, ensure the table exists to avoid PRAGMA/migration against a missing table
        this.db.run(createTableSQL, (err) => {
          if (err) {
            console.error('Error creating generated_images table:', err);
            reject(err);
            return;
          }
          console.log('Generated images table ensured (created if missing)');

          // Now check if we need to migrate an older schema
          this.checkAndMigrateTable().then(() => {
            // Create indexes
            createIndexesSQL.forEach((indexSQL, index) => {
              this.db.run(indexSQL, (err) => {
                if (err) {
                  console.error(`Error creating index ${index}:`, err);
                } else {
                  console.log(`Index ${index} created successfully`);
                }
              });
            });

            // Wait for all operations to complete
            this.db.wait((err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          }).catch((error) => {
            console.error('Migration failed:', error);
            reject(error);
          });
        });
      });
    });
  }

  /**
   * Check if table needs migration and migrate if necessary
   * This handles the case where execution_id was NOT NULL but needs to be nullable
   */
  async checkAndMigrateTable() {
    return new Promise((resolve, reject) => {
      // Check if the current table has the NOT NULL constraint
      this.db.get("PRAGMA table_info(generated_images)", (err, rows) => {
        if (err) {
          console.warn('Could not check table schema, skipping migration:', err);
          resolve();
          return;
        }

        // Check if execution_id column exists and has NOT NULL constraint, or if image_mapping_id is missing
        this.db.all("PRAGMA table_info(generated_images)", (err, columns) => {
          if (err) {
            console.warn('Could not check table columns, skipping migration:', err);
            resolve();
            return;
          }

          const executionIdColumn = columns.find(col => col.name === 'execution_id');
          const mappingIdColumn = columns.find(col => col.name === 'image_mapping_id');
          
          if ((executionIdColumn && executionIdColumn.notnull === 1) || !mappingIdColumn) {
            console.log('🔄 Migrating generated_images table to add image_mapping_id and allow nullable execution_id...');
            this.migrateTable().then(resolve).catch(reject);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Migrate the table to allow nullable execution_id
   */
  async migrateTable() {
    return new Promise((resolve, reject) => {
      console.log('🔄 Starting generated_images table migration...');
      
      // Create new table with nullable execution_id and image_mapping_id
      const createNewTableSQL = `
        CREATE TABLE generated_images_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_mapping_id VARCHAR(50) UNIQUE NOT NULL,
          execution_id INTEGER,
          generation_prompt TEXT NOT NULL,
          seed INTEGER,
          qc_status VARCHAR(20) DEFAULT 'failed',
          qc_reason TEXT,
          final_image_path VARCHAR(500),
          metadata TEXT,
          processing_settings TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
        )
      `;

      this.db.serialize(() => {
        // Clean up any partial migration remnants first
        this.db.run('DROP TABLE IF EXISTS generated_images_new', (err) => {
          if (err) {
            console.error('Error dropping leftover generated_images_new table:', err);
          }

          // Create new table
          this.db.run(createNewTableSQL, (err) => {
            if (err) {
              console.error('Error creating new generated_images table:', err);
              reject(err);
              return;
            }
            console.log('✅ New generated_images table created');

            // Copy data from old table to new table
            this.db.run(`
              INSERT INTO generated_images_new 
              SELECT id, 'legacy_' || id as image_mapping_id, execution_id, generation_prompt, seed, qc_status, qc_reason, 
                     final_image_path, metadata, processing_settings, created_at
              FROM generated_images
            `, (err) => {
              if (err) {
                console.error('Error copying data to new table:', err);
                reject(err);
                return;
              }
              console.log('✅ Data copied to new table');

              // Drop old table
              this.db.run('DROP TABLE generated_images', (err) => {
                if (err) {
                  console.error('Error dropping old table:', err);
                  reject(err);
                  return;
                }
                console.log('✅ Old table dropped');

                // Rename new table
                this.db.run('ALTER TABLE generated_images_new RENAME TO generated_images', (err) => {
                  if (err) {
                    console.error('Error renaming new table:', err);
                    reject(err);
                    return;
                  }
                  console.log('✅ Table migration completed successfully');
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  }

  async saveGeneratedImage(image) {
    // Ensure tables exist before insert (handles first-run race conditions)
    await this.createTables().catch(() => {});
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO generated_images 
        (image_mapping_id, execution_id, generation_prompt, seed, qc_status, qc_reason, final_image_path, metadata, processing_settings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        image.imageMappingId,
        image.executionId,
        image.generationPrompt,
        image.seed || null,
        image.qcStatus || 'qc_failed',
        image.qcReason || null,
        image.finalImagePath || null,
        image.metadata ? JSON.stringify(image.metadata) : null,
        image.processingSettings ? JSON.stringify(image.processingSettings) : null
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error saving generated image:', err);
          reject(err);
        } else {
          console.log('Generated image saved successfully');
          resolve({ success: true, id: this.lastID });
        }
      });
    });
  }

  async getGeneratedImage(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM generated_images WHERE id = ?';
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          console.error('Error getting generated image:', err);
          reject(err);
        } else if (row) {
          // Parse JSON fields and convert timestamps
          const image = {
            id: row.id,
            imageMappingId: row.image_mapping_id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          };
          resolve({ success: true, image });
        } else {
          resolve({ success: false, error: 'Generated image not found' });
        }
      });
    });
  }

  async getGeneratedImagesByExecution(executionId) {
    // Ensure tables exist before query (handles first-run race conditions)
    await this.createTables().catch(() => {});
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM generated_images WHERE execution_id = ? ORDER BY created_at DESC';
      
      this.db.all(sql, [executionId], (err, rows) => {
        if (err) {
          console.error('Error getting generated images by execution:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          }));
          resolve({ success: true, images });
        }
      });
    });
  }

  async getAllGeneratedImages(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM generated_images ORDER BY created_at DESC LIMIT ?';
      
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          console.error('Error getting all generated images:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          }));
          resolve({ success: true, images });
        }
      });
    });
  }

  async updateGeneratedImage(id, image) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE generated_images 
        SET execution_id = ?, generation_prompt = ?, seed = ?, qc_status = ?, 
            qc_reason = ?, final_image_path = ?, metadata = ?, processing_settings = ?
        WHERE id = ?
      `;

      const params = [
        image.executionId,
        image.generationPrompt,
        image.seed || null,
        image.qcStatus,
        image.qcReason || null,
        image.finalImagePath || null,
        image.metadata ? JSON.stringify(image.metadata) : null,
        image.processingSettings ? JSON.stringify(image.processingSettings) : null,
        id
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating generated image:', err);
          reject(err);
        } else {
          console.log('Generated image updated successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async deleteGeneratedImage(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM generated_images WHERE id = ?';
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          console.error('Error deleting generated image:', err);
          reject(err);
        } else {
          console.log('Generated image deleted successfully');
          resolve({ success: true, deletedRows: this.changes });
        }
      });
    });
  }

  async getImagesByQCStatus(qcStatus) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM generated_images WHERE qc_status = ? ORDER BY created_at DESC';
      
      this.db.all(sql, [qcStatus], (err, rows) => {
        if (err) {
          console.error('Error getting images by QC status:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          }));
          resolve({ success: true, images });
        }
      });
    });
  }

  async updateQCStatus(id, qcStatus, qcReason = null) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE generated_images SET qc_status = ?, qc_reason = ? WHERE id = ?';
      
      this.db.run(sql, [qcStatus, qcReason, id], function(err) {
        if (err) {
          console.error('Error updating QC status:', err);
          reject(err);
        } else {
          console.log('QC status updated successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async updateQCStatusByMappingId(mappingId, qcStatus, qcReason = null) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE generated_images SET qc_status = ?, qc_reason = ? WHERE image_mapping_id = ?';
      
      this.db.run(sql, [qcStatus, qcReason, mappingId], function(err) {
        if (err) {
          console.error('Error updating QC status by mapping ID:', err);
          reject(err);
        } else {
          console.log(`QC status updated successfully for mapping ID: ${mappingId}`);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async updateGeneratedImageByMappingId(mappingId, image) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE generated_images 
        SET execution_id = ?, generation_prompt = ?, seed = ?, qc_status = ?, 
            qc_reason = ?, final_image_path = ?, metadata = ?, processing_settings = ?
        WHERE image_mapping_id = ?
      `;

      const params = [
        image.executionId,
        image.generationPrompt,
        image.seed || null,
        image.qcStatus,
        image.qcReason || null,
        image.finalImagePath || null,
        image.metadata ? JSON.stringify(image.metadata) : null,
        image.processingSettings ? JSON.stringify(image.processingSettings) : null,
        mappingId
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating generated image by mapping ID:', err);
          reject(err);
        } else {
          console.log(`Generated image updated successfully for mapping ID: ${mappingId}`);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async getImageMetadata(executionId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT gi.*, je.configuration_id, je.status as job_status
        FROM generated_images gi
        LEFT JOIN job_executions je ON gi.execution_id = je.id
        WHERE gi.execution_id = ?
        ORDER BY gi.created_at DESC
      `;
      
      this.db.all(sql, [executionId], (err, rows) => {
        if (err) {
          console.error('Error getting image metadata:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          }));
          resolve({ success: true, images });
        }
      });
    });
  }

  async getImageStatistics() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as totalImages,
          SUM(CASE WHEN qc_status = 'approved' THEN 1 ELSE 0 END) as approvedImages,
          SUM(CASE WHEN qc_status = 'failed' THEN 1 ELSE 0 END) as failedImages
        FROM generated_images
      `;
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error getting image statistics:', err);
          reject(err);
        } else {
          const stats = {
            totalImages: row.totalImages || 0,
            approvedImages: row.approvedImages || 0,
            failedImages: row.failedImages || 0
          };
          resolve({ success: true, statistics: stats });
        }
      });
    });
  }

  async bulkDeleteGeneratedImages(imageIds) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        resolve({ success: false, error: 'No image IDs provided' });
        return;
      }

      const placeholders = imageIds.map(() => '?').join(',');
      const sql = `DELETE FROM generated_images WHERE id IN (${placeholders})`;
      
      this.db.run(sql, imageIds, function(err) {
        if (err) {
          console.error('Error bulk deleting generated images:', err);
          reject(err);
        } else {
          console.log(`Bulk deleted ${this.changes} generated images`);
          resolve({ success: true, deletedRows: this.changes });
        }
      });
    });
  }

  async cleanupOldImages(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM generated_images 
        WHERE created_at < datetime('now', '-${daysToKeep} days')
      `;
      
      this.db.run(sql, [], function(err) {
        if (err) {
          console.error('Error cleaning up old images:', err);
          reject(err);
        } else {
          console.log(`Cleaned up ${this.changes} old generated images`);
          resolve({ success: true, deletedRows: this.changes });
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('GeneratedImage database connection closed');
        }
      });
    }
  }
}

module.exports = { GeneratedImage };
