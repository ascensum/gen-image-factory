const path = require('path');
const fs = require('fs');

let sqlite3;

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
    
    // Initialize ImageRepository (Shadow Bridge - ADR-006, ADR-009)
    // Always available but only active if FEATURE_MODULAR_IMAGE_REPOSITORY = 'true'
    this.imageRepository = null;  // Lazy-initialized in init()
    
    // Constructor is used in many contexts that don't await init(); prevent unhandled rejections.
    if (process.env.SMOKE_TEST === 'true') {
      console.log(' [GeneratedImage] Skipping init() during SMOKE_TEST');
      return;
    }
    this.init().catch((err) => {
      console.error('GeneratedImage init failed:', err?.message || err);
    });
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
      // Non-Electron context (tests/dev CLI)
    }

    if (!primaryPath) {
      const projectRoot = process.cwd();
      primaryPath = path.join(projectRoot, 'data', 'gen-image-factory.db');
    }

    // Ensure destination dir exists
    const primaryDir = path.dirname(primaryPath);
    try {
      if (!fs.existsSync(primaryDir)) {
        fs.mkdirSync(primaryDir, { recursive: true });
      }
    } catch (e) {
      console.warn('️ Could not ensure primary DB directory:', e.message);
    }

    // One-time migration from legacy locations if primary file missing
    try {
      if (!fs.existsSync(primaryPath)) {
        const legacyPaths = [];
        try {
          const os = require('os');
          const homeDir = os.homedir();
          legacyPaths.push(path.join(homeDir, '.gen-image-factory', 'gen-image-factory.db'));
        } catch (_) {}
        // __dirname-based legacy
        legacyPaths.push(path.join(__dirname, '..', '..', '..', 'data', 'gen-image-factory.db'));
        // Project ./data if primary is userData
        const projectData = path.join(process.cwd(), 'data', 'gen-image-factory.db');
        if (projectData !== primaryPath) legacyPaths.push(projectData);

        for (const legacy of legacyPaths) {
          try {
            if (legacy && fs.existsSync(legacy)) {
              fs.copyFileSync(legacy, primaryPath);
              console.log(` Migrated database from legacy path to primary: ${legacy} -> ${primaryPath}`);
              break;
            }
          } catch (e) {
            console.warn(`️ Failed migrating DB from ${legacy}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn('️ DB migration check failed:', e.message);
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
            // Move WAL/SHM if present
            ['-wal', '-shm'].forEach((suffix) => {
              const extra = legacy + suffix;
              if (fs.existsSync(extra)) {
                try { fs.renameSync(extra, dest + suffix); } catch {}
              }
            });
            console.log(` Moved legacy DB to backup: ${legacy} -> ${dest}`);
          } catch (e) {
            console.warn(`️ Could not move legacy DB ${legacy}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn('️ Legacy DB cleanup skipped:', e.message);
    }

    console.log(` Database path resolved (pinned${usedElectron ? ' userData' : ' project-data'}): ${primaryPath}`);
    return primaryPath;
  }

  async init() {
    if (!sqlite3) {
      sqlite3 = require('sqlite3').verbose();
    }
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          // Reduce SQLITE_BUSY flakes under parallel usage (tests/Electron multi-model startup)
          // NOTE: use configure() (sync) to avoid async PRAGMA on closing handles.
          try { this.db.configure('busyTimeout', 5000); } catch (_) {}
          this.createTables().then(() => {
            // Initialize ImageRepository (Shadow Bridge - ADR-006, ADR-009)
            if (process.env.FEATURE_MODULAR_IMAGE_REPOSITORY === 'true') {
              try {
                const { ImageRepository } = require('../../repositories/ImageRepository');
                this.imageRepository = new ImageRepository(this);
                console.log(' ImageRepository initialized (modular mode)');
              } catch (err) {
                console.warn('Failed to initialize ImageRepository:', err.message);
              }
            }
            resolve();
          }).catch(reject);
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
            // If the handle was closed during migration, exit gracefully
            if (!this.db || this.db.open === false) {
              resolve();
              return;
            }
            // Create indexes
            createIndexesSQL.forEach((indexSQL, index) => {
              if (!this.db || this.db.open === false) {
                return;
              }
              try {
                this.db.run(indexSQL, (err) => {
                  if (err) {
                    console.error(`Error creating index ${index}:`, err);
                  } else {
                    console.log(`Index ${index} created successfully`);
                  }
                });
              } catch (err) {
                console.warn(`Skipped index ${index} creation; DB closed:`, err?.message || err);
              }
            });

            // Wait for all operations to complete
            if (!this.db || this.db.open === false) {
              resolve();
              return;
            }
            try {
              this.db.wait((err) => {
                if (err && err.code === 'SQLITE_MISUSE') {
                  resolve(); // ignore if handle closed during teardown
                  return;
                }
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            } catch (err) {
              console.warn('Skipped wait; DB likely closed:', err?.message || err);
              resolve();
            }
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
      this.db.get("PRAGMA table_info(generated_images)", (err, _rows) => {
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
          const tempPathColumn = columns.find(col => col.name === 'temp_image_path');
          
          if ((executionIdColumn && executionIdColumn.notnull === 1) || !mappingIdColumn) {
            console.log(' Migrating generated_images table to add image_mapping_id and allow nullable execution_id...');
            this.migrateTable().then(resolve).catch(reject);
          } else if (!tempPathColumn) {
            // Lightweight migration: add missing temp_image_path column if absent
            console.log(' Adding missing column temp_image_path to generated_images...');
            this.db.run("ALTER TABLE generated_images ADD COLUMN temp_image_path VARCHAR(500)", (alterErr) => {
              if (alterErr) {
                console.error(' Failed to add temp_image_path column:', alterErr);
                // Do not reject; continue to avoid breaking app in production
                resolve();
              } else {
                console.log(' temp_image_path column added successfully');
                resolve();
              }
            });
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
      console.log(' Starting generated_images table migration...');
      
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
            console.log(' New generated_images table created');

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
              console.log(' Data copied to new table');

              // Drop old table
              this.db.run('DROP TABLE generated_images', (err) => {
                if (err) {
                  console.error('Error dropping old table:', err);
                  reject(err);
                  return;
                }
                console.log(' Old table dropped');

                // Rename new table
                this.db.run('ALTER TABLE generated_images_new RENAME TO generated_images', (err) => {
                  if (err) {
                    console.error('Error renaming new table:', err);
                    reject(err);
                    return;
                  }
                  console.log(' Table migration completed successfully');
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
        (image_mapping_id, execution_id, generation_prompt, seed, qc_status, qc_reason, final_image_path, temp_image_path, metadata, processing_settings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        image.imageMappingId,
        image.executionId,
        image.generationPrompt,
        image.seed || null,
        image.qcStatus || 'qc_failed',
        image.qcReason || null,
        image.finalImagePath || null,
        image.tempImagePath || null,
        image.metadata != null ? (typeof image.metadata === 'string' ? image.metadata : JSON.stringify(image.metadata)) : null,
        image.processingSettings != null ? (typeof image.processingSettings === 'string' ? image.processingSettings : JSON.stringify(image.processingSettings)) : null
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
            tempImagePath: row.temp_image_path,
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
            imageMappingId: row.image_mapping_id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            tempImagePath: row.temp_image_path,
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
            imageMappingId: row.image_mapping_id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            tempImagePath: row.temp_image_path,
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
        image.metadata != null ? (typeof image.metadata === 'string' ? image.metadata : JSON.stringify(image.metadata)) : null,
        image.processingSettings != null ? (typeof image.processingSettings === 'string' ? image.processingSettings : JSON.stringify(image.processingSettings)) : null,
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

  /**
   * Helper function to delete image file from disk
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<boolean>} - True if file was deleted or didn't exist
   */
  async deleteImageFile(imagePath) {
    if (!imagePath) return true;
    
    try {
      await fs.promises.access(imagePath);
      await fs.promises.unlink(imagePath);
      console.log(`️ Deleted image file: ${imagePath}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, which is fine
        console.log(`️ Image file not found (already deleted): ${imagePath}`);
        return true;
      } else {
        console.warn(`️ Could not delete image file ${imagePath}:`, error.message);
        return false;
      }
    }
  }

  async deleteGeneratedImage(id) {
    return new Promise((resolve, reject) => {
      // First, get the image data to find the file path
      this.getGeneratedImage(id).then(imageResult => {
        if (!imageResult.success || !imageResult.image) {
          reject(new Error(`Image ${id} not found`));
          return;
        }

        const image = imageResult.image;
        const filePath = image.finalImagePath || image.tempImagePath;

        // Delete the database record first
        const sql = 'DELETE FROM generated_images WHERE id = ?';
        
        this.db.run(sql, [id], (err) => {
          if (err) {
            reject(err);
          } else {
            // Delete the file from the filesystem if it exists
            if (filePath) {
              const fsP = require('fs').promises;
              fsP.unlink(filePath).catch(fileErr => {
                console.warn(`️ Failed to delete image file ${filePath}:`, fileErr.message);
              });
            }
            resolve({ success: true, changes: this.changes });
          }
        });
      }).catch(reject);
    });
  }

  async getImagesByQCStatus(qcStatus, options = {}) {
    const limit = options.limit != null ? Math.max(0, parseInt(options.limit, 10)) : null;
    const offset = options.offset != null ? Math.max(0, parseInt(options.offset, 10)) : 0;
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM generated_images WHERE qc_status = ? ORDER BY created_at DESC';
      const params = [qcStatus];
      if (limit != null && limit > 0) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error getting images by QC status:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            imageMappingId: row.image_mapping_id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            tempImagePath: row.temp_image_path,
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
      // First, get the existing image data to merge metadata properly
      const selectSql = 'SELECT metadata FROM generated_images WHERE image_mapping_id = ?';
      
      this.db.get(selectSql, [mappingId], (err, row) => {
        if (err) {
          console.error('Error getting existing image data:', err);
          reject(err);
          return;
        }
        
        if (!row) {
          reject(new Error(`Image with mapping ID ${mappingId} not found`));
          return;
        }
        
        // Parse existing metadata and merge with new metadata
        let existingMetadata = {};
        if (row.metadata) {
          try {
            existingMetadata = JSON.parse(row.metadata);
          } catch (parseError) {
            console.warn(`Failed to parse existing metadata for ${mappingId}:`, parseError);
            existingMetadata = {};
          }
        }
        
        // Merge existing metadata with new metadata
        const mergedMetadata = {
          ...existingMetadata,
          ...image.metadata
        };
        
        console.log(`Merging metadata for ${mappingId}:`, {
          existing: existingMetadata,
          new: image.metadata,
          merged: mergedMetadata
        });
        
        const updateSql = `
          UPDATE generated_images 
          SET metadata = ?
          WHERE image_mapping_id = ?
        `;

        const params = [
          JSON.stringify(mergedMetadata),
          mappingId
        ];

        this.db.run(updateSql, params, function(err) {
          if (err) {
            console.error('Error updating generated image by mapping ID:', err);
            reject(err);
          } else {
            console.log(`Generated image metadata updated successfully for mapping ID: ${mappingId}`);
            resolve({ success: true, changes: this.changes });
          }
        });
      });
    });
  }

  // Shadow Bridge: updateMetadataById (ADR-006, ADR-009)
  async updateMetadataById(id, newMetadata) {
    if (process.env.FEATURE_MODULAR_IMAGE_REPOSITORY === 'true' && this.imageRepository) {
      try {
        return await this.imageRepository.updateMetadataById(id, newMetadata);
      } catch (error) {
        console.warn('ImageRepository.updateMetadataById failed, falling back to legacy:', error);
        return await this._legacyUpdateMetadataById(id, newMetadata);
      }
    }
    return await this._legacyUpdateMetadataById(id, newMetadata);
  }

  // Legacy implementation (ADR-006: Zero-Deletion Policy)
  async _legacyUpdateMetadataById(id, newMetadata) {
    return new Promise((resolve, reject) => {
      const selectSql = 'SELECT metadata FROM generated_images WHERE id = ?';
      this.db.get(selectSql, [id], (err, row) => {
        if (err) {
          console.error('Error getting existing image metadata by id:', err);
          reject(err);
          return;
        }
        let existing = {};
        if (row && row.metadata) {
          try { existing = JSON.parse(row.metadata); } catch (_) { existing = {}; }
        }
        const merged = { ...existing, ...newMetadata };
        const updateSql = 'UPDATE generated_images SET metadata = ? WHERE id = ?';
        this.db.run(updateSql, [JSON.stringify(merged), id], function(err2) {
          if (err2) {
            console.error('Error updating image metadata by id:', err2);
            reject(err2);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        });
      });
    });
  }

  // Shadow Bridge: getImageMetadata (ADR-006, ADR-009)
  async getImageMetadata(executionId) {
    if (process.env.FEATURE_MODULAR_IMAGE_REPOSITORY === 'true' && this.imageRepository) {
      try {
        return await this.imageRepository.getImageMetadata(executionId);
      } catch (error) {
        console.warn('ImageRepository.getImageMetadata failed, falling back to legacy:', error);
        return await this._legacyGetImageMetadata(executionId);
      }
    }
    return await this._legacyGetImageMetadata(executionId);
  }

  // Legacy implementation (ADR-006: Zero-Deletion Policy)
  async _legacyGetImageMetadata(executionId) {
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

  // Shadow Bridge: getImageStatistics (ADR-006, ADR-009)
  async getImageStatistics() {
    if (process.env.FEATURE_MODULAR_IMAGE_REPOSITORY === 'true' && this.imageRepository) {
      try {
        return await this.imageRepository.getImageStatistics();
      } catch (error) {
        console.warn('ImageRepository.getImageStatistics failed, falling back to legacy:', error);
        return await this._legacyGetImageStatistics();
      }
    }
    return await this._legacyGetImageStatistics();
  }

  // Legacy implementation (ADR-006: Zero-Deletion Policy)
  async _legacyGetImageStatistics() {
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

  // Shadow Bridge: bulkDeleteGeneratedImages (ADR-006, ADR-009)
  async bulkDeleteGeneratedImages(imageIds) {
    if (process.env.FEATURE_MODULAR_IMAGE_REPOSITORY === 'true' && this.imageRepository) {
      try {
        return await this.imageRepository.bulkDeleteGeneratedImages(imageIds);
      } catch (error) {
        console.warn('ImageRepository.bulkDeleteGeneratedImages failed, falling back to legacy:', error);
        return await this._legacyBulkDeleteGeneratedImages(imageIds);
      }
    }
    return await this._legacyBulkDeleteGeneratedImages(imageIds);
  }

  // Legacy implementation (ADR-006: Zero-Deletion Policy)
  async _legacyBulkDeleteGeneratedImages(imageIds) {
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return { success: false, error: 'No image IDs provided' };
    }

    return new Promise((resolve, reject) => {
      // First, get all image data to find file paths
      const getPromises = imageIds.map(id => this.getGeneratedImage(id));
      
      Promise.all(getPromises).then(results => {
        const imagesToDelete = results
          .filter(res => res.success && res.image)
          .map(res => res.image);

        // Delete the database records
        const placeholders = imageIds.map(() => '?').join(',');
        const sql = `DELETE FROM generated_images WHERE id IN (${placeholders})`;
        
        this.db.run(sql, imageIds, function(err) {
          if (err) {
            console.error('Error bulk deleting generated images from database:', err);
            reject(err);
          } else {
            const changes = this.changes;
            console.log(`Bulk deleted ${changes} generated images from database`);
            
            // Now delete all the actual files
            const fsP = require('fs').promises;
            let filesDeleted = 0;
            const unlinkPromises = imagesToDelete.map(image => {
              const filePath = image.finalImagePath || image.tempImagePath;
              if (filePath) {
                return fsP.unlink(filePath).then(() => {
                  filesDeleted++;
                }).catch(_e => {
                  console.warn(`️ Failed to delete file ${filePath}:`, _e.message);
                });
              }
              return Promise.resolve();
            });
            
            Promise.all(unlinkPromises).then(() => {
              resolve({
                success: true,
                deletedRows: changes,
                filesDeleted,
                totalImages: imagesToDelete.length
              });
            }).catch(_err => {
              // Even if unlinks fail, we resolve success because DB records are gone
              resolve({
                success: true,
                deletedRows: changes,
                filesDeleted,
                totalImages: imagesToDelete.length,
                warning: 'Some files could not be deleted'
              });
            });
          }
        });
      }).catch(reject);
    });
  }
  async cleanupOldImages(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
      // First, get all old images to find file paths
      const sql = `
        SELECT id, final_image_path, temp_image_path 
        FROM generated_images 
        WHERE created_at < datetime('now', '-${daysToKeep} days')
      `;
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error getting old images for cleanup:', err);
          reject(err);
          return;
        }

        if (rows.length === 0) {
          console.log('No old images to clean up');
          resolve({ success: true, deletedRows: 0, filesDeleted: 0 });
          return;
        }

        // Delete the database records
        const deleteSql = `
          DELETE FROM generated_images 
          WHERE created_at < datetime('now', '-${daysToKeep} days')
        `;
        
        this.db.run(deleteSql, [], (err) => {
          if (err) {
            console.error('Error cleaning up old images from database:', err);
            reject(err);
          } else {
            const changes = this.changes;
            console.log(`Cleaned up ${changes} old generated images from database`);
            
            // Now delete all the actual files
            const fsP = require('fs').promises;
            let filesDeleted = 0;
            const unlinkPromises = [];
            
            for (const row of rows) {
              const filePath = row.final_image_path || row.temp_image_path;
              if (filePath) {
                unlinkPromises.push(
                  fsP.unlink(filePath).then(() => {
                    filesDeleted++;
                  }).catch(_e => {
                    console.warn(`️ Failed to delete file ${filePath}:`, _e.message);
                  })
                );
              }
            }
            
            Promise.all(unlinkPromises).then(() => {
              resolve({ 
                success: true, 
                deletedRows: changes, 
                filesDeleted,
                totalImages: rows.length
              });
            }).catch(_err => {
              resolve({ 
                success: true, 
                deletedRows: changes, 
                filesDeleted,
                totalImages: rows.length,
                warning: 'Some files could not be deleted'
              });
            });
          }
        });
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

  async updateImagePathsByMappingId(mappingId, tempImagePath, finalImagePath) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE generated_images 
        SET temp_image_path = ?, final_image_path = ?
        WHERE image_mapping_id = ?
      `;

      const params = [tempImagePath, finalImagePath, mappingId];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating image paths by mapping ID:', err);
          reject(err);
        } else {
          console.log(`Image paths updated successfully for mapping ID: ${mappingId}`);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async updateImagePathsById(id, tempImagePath, finalImagePath) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE generated_images 
        SET temp_image_path = ?, final_image_path = ?
        WHERE id = ?
      `;

      const params = [tempImagePath, finalImagePath, id];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating image paths by id:', err);
          reject(err);
        } else {
          console.log(`Image paths updated successfully for id: ${id}`);
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }
}

module.exports = { GeneratedImage };
