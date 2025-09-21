const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * JobExecution Database Model
 * 
 * Tracks job execution history and status with foreign key relationship to JobConfiguration
 * Implements job status tracking, statistics, and execution history queries
 */
class JobExecution {
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
        CREATE TABLE IF NOT EXISTS job_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          configuration_id INTEGER,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          status VARCHAR(50) DEFAULT 'running',
          total_images INTEGER DEFAULT 0,
          successful_images INTEGER DEFAULT 0,
          failed_images INTEGER DEFAULT 0,
          error_message TEXT,
          label TEXT,
          FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE
        )
      `;

      const createIndexesSQL = [
        'CREATE INDEX IF NOT EXISTS idx_job_executions_configuration_id ON job_executions(configuration_id)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_started_at ON job_executions(started_at)'
      ];

      // Only add label index if the column exists
      const addLabelIndexSQL = 'CREATE INDEX IF NOT EXISTS idx_job_executions_label ON job_executions(label)';

      this.db.serialize(() => {
        // Create table
        this.db.run(createTableSQL, (err) => {
          if (err) {
            console.error('Error creating job_executions table:', err);
            reject(err);
            return;
          }
          console.log('Job executions table created successfully');
        });

        // Create basic indexes
        createIndexesSQL.forEach((indexSQL, index) => {
          this.db.run(indexSQL, (err) => {
            if (err) {
              console.error(`Error creating index ${index}:`, err);
            } else {
              console.log(`Index ${index} created successfully`);
            }
          });
        });

        // Try to create label index (it might fail if column doesn't exist yet)
        this.db.run(addLabelIndexSQL, (err) => {
          if (err) {
            console.log('Label index creation skipped (column may not exist yet):', err.message);
          } else {
            console.log('Label index created successfully');
          }
        });

        // Migrate existing table to allow nullable configuration_id
        this.migrateTable().then(() => {
          // Wait for all operations to complete
          this.db.wait((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }).catch(reject);
      });
    });
  }

  async migrateTable() {
    return new Promise((resolve, reject) => {
      // Check if we need to migrate the configuration_id column
      this.db.get("PRAGMA table_info(job_executions)", (err, rows) => {
        if (err) {
          console.error('Error checking table schema:', err);
          resolve(); // Continue anyway
          return;
        }

        // Get all column info
        this.db.all("PRAGMA table_info(job_executions)", (err, columns) => {
          if (err) {
            console.error('Error getting table columns:', err);
            resolve(); // Continue anyway
            return;
          }

          // Find configuration_id column
          const configColumn = columns.find(col => col.name === 'configuration_id');
          if (configColumn && configColumn.notnull === 1) {
            console.log('Migrating job_executions table to allow nullable configuration_id...');
            
            // Create new table with nullable configuration_id
            const createNewTableSQL = `
              CREATE TABLE job_executions_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                configuration_id INTEGER,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                status VARCHAR(50) DEFAULT 'running',
                total_images INTEGER DEFAULT 0,
                successful_images INTEGER DEFAULT 0,
                failed_images INTEGER DEFAULT 0,
                error_message TEXT,
                label TEXT,
                FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE
              )
            `;

            this.db.serialize(() => {
              // Create new table
              this.db.run(createNewTableSQL, (err) => {
                if (err) {
                  console.error('Error creating new table:', err);
                  resolve(); // Continue anyway
                  return;
                }

                // Copy data from old table
                this.db.run('INSERT INTO job_executions_new SELECT * FROM job_executions', (err) => {
                  if (err) {
                    console.error('Error copying data:', err);
                    resolve(); // Continue anyway
                    return;
                  }

                  // Drop old table
                  this.db.run('DROP TABLE job_executions', (err) => {
                    if (err) {
                      console.error('Error dropping old table:', err);
                      resolve(); // Continue anyway
                      return;
                    }

                    // Rename new table
                    this.db.run('ALTER TABLE job_executions_new RENAME TO job_executions', (err) => {
                      if (err) {
                        console.error('Error renaming table:', err);
                      } else {
                        console.log('Successfully migrated job_executions table');
                      }
                      resolve();
                    });
                  });
                });
              });
            });
          } else {
            resolve(); // No migration needed
          }
        });
      });
    });
  }

  async saveJobExecution(execution) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO job_executions 
        (configuration_id, started_at, completed_at, status, total_images, successful_images, failed_images, error_message, label)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        execution.configurationId,
        execution.startedAt || new Date().toISOString(),
        execution.completedAt || null,
        execution.status || 'running',
        execution.totalImages || 0,
        execution.successfulImages || 0,
        execution.failedImages || 0,
        execution.errorMessage || null,
        execution.label || null
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error saving job execution:', err);
          reject(err);
        } else {
          console.log('Job execution saved successfully');
          resolve({ success: true, id: this.lastID });
        }
      });
    });
  }

  async getJobExecution(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM job_executions WHERE id = ?';
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          console.error('Error getting job execution:', err);
          reject(err);
        } else if (row) {
          // Convert timestamps to Date objects
          const execution = {
            id: row.id,
            configurationId: row.configuration_id,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label
          };
          resolve({ success: true, execution });
        } else {
          resolve({ success: false, error: 'Job execution not found' });
        }
      });
    });
  }

  async getAllJobExecutions() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM job_executions ORDER BY started_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error getting all job executions:', err);
          reject(err);
        } else {
          // Convert timestamps to Date objects
          const executions = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label
          }));
          resolve({ success: true, executions });
        }
      });
    });
  }

  async updateJobExecution(id, execution) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE job_executions 
        SET configuration_id = ?, started_at = ?, completed_at = ?, status = ?, 
            total_images = ?, successful_images = ?, failed_images = ?, error_message = ?, label = ?
        WHERE id = ?
      `;

      const params = [
        execution.configurationId,
        execution.startedAt ? execution.startedAt.toISOString() : null,
        execution.completedAt ? execution.completedAt.toISOString() : null,
        execution.status,
        execution.totalImages,
        execution.successfulImages,
        execution.failedImages,
        execution.errorMessage,
        execution.label,
        id
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating job execution:', err);
          reject(err);
        } else {
          console.log('Job execution updated successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async updateJobExecutionStatus(id, status, jobId = null, errorMessage = null) {
    return new Promise((resolve, reject) => {
      let sql, params;
      
      if (jobId && errorMessage) {
        sql = 'UPDATE job_executions SET status = ?, job_id = ?, error_message = ? WHERE id = ?';
        params = [status, jobId, errorMessage, id];
      } else if (jobId) {
        sql = 'UPDATE job_executions SET status = ?, job_id = ? WHERE id = ?';
        params = [status, jobId, id];
      } else if (errorMessage) {
        sql = 'UPDATE job_executions SET status = ?, error_message = ? WHERE id = ?';
        params = [status, errorMessage, id];
      } else {
        sql = 'UPDATE job_executions SET status = ? WHERE id = ?';
        params = [status, id];
      }
      
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error updating job execution status:', err);
          reject(err);
        } else {
          console.log('Job execution status updated successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async deleteJobExecution(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM job_executions WHERE id = ?';
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          console.error('Error deleting job execution:', err);
          reject(err);
        } else {
          console.log('Job execution deleted successfully');
          resolve({ success: true, deletedRows: this.changes });
        }
      });
    });
  }

  async getJobHistory(limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT je.*, jc.name as configuration_name 
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        ORDER BY je.started_at DESC
        LIMIT ?
      `;
      
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          console.error('Error getting job history:', err);
          reject(err);
        } else {
          // Convert timestamps to Date objects
          const history = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            configurationName: row.configuration_name,
            displayLabel: row.label || row.configuration_name || null,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label
          }));
          resolve({ success: true, history });
        }
      });
    });
  }

  async getJobStatistics() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as totalJobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedJobs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedJobs,
          SUM(total_images) as totalImages,
          SUM(successful_images) as successfulImages,
          SUM(failed_images) as failedImages,
          AVG(CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 * 60
            ELSE NULL 
          END) as averageJobDuration
        FROM job_executions
      `;
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error getting job statistics:', err);
          reject(err);
        } else {
          const stats = {
            totalJobs: row.totalJobs || 0,
            completedJobs: row.completedJobs || 0,
            failedJobs: row.failedJobs || 0,
            totalImages: row.totalImages || 0,
            successfulImages: row.successfulImages || 0,
            failedImages: row.failedImages || 0,
            averageJobDuration: row.averageJobDuration || 0
          };
          resolve({ success: true, statistics: stats });
        }
      });
    });
  }

  async calculateJobExecutionStatistics(executionId) {
    return new Promise((resolve, reject) => {
      // First get the job execution to see expected total images
      const jobSql = 'SELECT total_images FROM job_executions WHERE id = ?';
      
      this.db.get(jobSql, [executionId], (err, jobRow) => {
        if (err) {
          console.error('Error getting job execution:', err);
          reject(err);
          return;
        }
        
        const expectedTotal = jobRow?.total_images || 0;
        
        // Then count actual images in database and their QC status
        const imagesSql = `
          SELECT 
            COUNT(*) as actualImages,
            SUM(CASE WHEN qc_status = 'approved' THEN 1 ELSE 0 END) as approvedImages,
            SUM(CASE WHEN qc_status = 'qc_failed' THEN 1 ELSE 0 END) as qcFailedImages
          FROM generated_images 
          WHERE execution_id = ?
        `;
        
        this.db.get(imagesSql, [executionId], (err, imageRow) => {
          if (err) {
            console.error('Error calculating job execution statistics:', err);
            reject(err);
            return;
          }
          
          const actualImages = imageRow?.actualImages || 0;
          const approvedImages = imageRow?.approvedImages || 0;
          const qcFailedImages = imageRow?.qcFailedImages || 0;
          const failedImages = expectedTotal - actualImages; // Images that failed generation (not in DB)
          
          const stats = {
            totalImages: expectedTotal,
            successfulImages: actualImages, // All images in DB are successfully generated
            failedImages: Math.max(0, failedImages), // Images that failed generation
            approvedImages: approvedImages,
            qcFailedImages: qcFailedImages
          };
          
          console.log(`Job ${executionId} stats: expected=${expectedTotal}, actual=${actualImages}, approved=${approvedImages}, qcFailed=${qcFailedImages}, failed=${failedImages}`);
          resolve({ success: true, statistics: stats });
        });
      });
    });
  }

  async updateJobExecutionStatistics(executionId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Calculate statistics from actual images
        const statsResult = await this.calculateJobExecutionStatistics(executionId);
        if (!statsResult.success) {
          reject(new Error('Failed to calculate statistics'));
          return;
        }

        const { totalImages, successfulImages, failedImages } = statsResult.statistics;

        // Update the job execution with calculated statistics
        const updateSql = `
          UPDATE job_executions 
          SET total_images = ?, successful_images = ?, failed_images = ?
          WHERE id = ?
        `;

        this.db.run(updateSql, [totalImages, successfulImages, failedImages, executionId], function(err) {
          if (err) {
            console.error('Error updating job execution statistics:', err);
            reject(err);
          } else {
            console.log(`Job execution statistics updated for ID ${executionId}: ${successfulImages} successful, ${failedImages} failed out of ${totalImages} total`);
            resolve({ 
              success: true, 
              changes: this.changes,
              statistics: { totalImages, successfulImages, failedImages }
            });
          }
        });
      } catch (error) {
        console.error('Error in updateJobExecutionStatistics:', error);
        reject(error);
      }
    });
  }

  async getJobExecutionsWithFilters(filters = {}, page = 1, pageSize = 25) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT je.*, jc.name as configuration_name 
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        WHERE 1=1
      `;
      
      const params = [];
      
      // Apply filters
      if (filters.status && filters.status !== 'all') {
        sql += ' AND je.status = ?';
        params.push(filters.status);
      }
      
      if (filters.label && filters.label.trim()) {
        sql += ' AND je.label LIKE ?';
        params.push(`%${filters.label.trim()}%`);
      }
      
      if (filters.dateFrom || filters.dateTo) {
        if (filters.dateFrom) {
          const fromSql = typeof filters.dateFrom === 'string'
            ? `${filters.dateFrom} 00:00:00`
            : `${new Date(filters.dateFrom).getFullYear()}-${String(new Date(filters.dateFrom).getMonth()+1).padStart(2,'0')}-${String(new Date(filters.dateFrom).getDate()).padStart(2,'0')} 00:00:00`;
          sql += ' AND datetime(je.started_at) >= datetime(?)';
          params.push(fromSql);
        }
        if (filters.dateTo) {
          const toSql = typeof filters.dateTo === 'string'
            ? `${filters.dateTo} 23:59:59`
            : `${new Date(filters.dateTo).getFullYear()}-${String(new Date(filters.dateTo).getMonth()+1).padStart(2,'0')}-${String(new Date(filters.dateTo).getDate()).padStart(2,'0')} 23:59:59`;
          sql += ' AND datetime(je.started_at) <= datetime(?)';
          params.push(toSql);
        }
      } else if (filters.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'yesterday':
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        }
        
        sql += ' AND je.started_at >= ?';
        params.push(startDate.toISOString());
      }
      
      if (filters.minImages && filters.minImages > 0) {
        sql += ' AND je.total_images >= ?';
        params.push(filters.minImages);
      }
      
      if (filters.maxImages && filters.maxImages > 0) {
        sql += ' AND je.total_images <= ?';
        params.push(filters.maxImages);
      }
      
      // Add sorting and pagination
      sql += ' ORDER BY datetime(je.started_at) DESC LIMIT ? OFFSET ?';
      params.push(pageSize, (page - 1) * pageSize);
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error getting job executions with filters:', err);
          reject(err);
        } else {
          const executions = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            configurationName: row.configuration_name,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label
          }));
          resolve({ success: true, jobs: executions });
        }
      });
    });
  }

  async getJobExecutionsCount(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT COUNT(*) as count FROM job_executions je WHERE 1=1';
      const params = [];
      
      // Apply same filters as above
      if (filters.status && filters.status !== 'all') {
        sql += ' AND je.status = ?';
        params.push(filters.status);
      }
      
      if (filters.label && filters.label.trim()) {
        sql += ' AND je.label LIKE ?';
        params.push(`%${filters.label.trim()}%`);
      }
      
      if (filters.dateFrom || filters.dateTo) {
        if (filters.dateFrom) {
          const fromSql = typeof filters.dateFrom === 'string'
            ? `${filters.dateFrom} 00:00:00`
            : `${new Date(filters.dateFrom).getFullYear()}-${String(new Date(filters.dateFrom).getMonth()+1).padStart(2,'0')}-${String(new Date(filters.dateFrom).getDate()).padStart(2,'0')} 00:00:00`;
          sql += ' AND datetime(je.started_at) >= datetime(?)';
          params.push(fromSql);
        }
        if (filters.dateTo) {
          const toSql = typeof filters.dateTo === 'string'
            ? `${filters.dateTo} 23:59:59`
            : `${new Date(filters.dateTo).getFullYear()}-${String(new Date(filters.dateTo).getMonth()+1).padStart(2,'0')}-${String(new Date(filters.dateTo).getDate()).padStart(2,'0')} 23:59:59`;
          sql += ' AND datetime(je.started_at) <= datetime(?)';
          params.push(toSql);
        }
      } else if (filters.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'yesterday':
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        }
        
        sql += ' AND je.started_at >= ?';
        params.push(startDate.toISOString());
      }
      
      if (filters.minImages && filters.minImages > 0) {
        sql += ' AND je.total_images >= ?';
        params.push(filters.minImages);
      }
      
      if (filters.maxImages && filters.maxImages > 0) {
        sql += ' AND je.total_images <= ?';
        params.push(filters.maxImages);
      }
      
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Error getting job executions count:', err);
          reject(err);
        } else {
          resolve({ success: true, count: row.count || 0 });
        }
      });
    });
  }

  async renameJobExecution(id, label) {
    return new Promise((resolve, reject) => {
      // Store reference to database to avoid 'this' context issues
      const db = this.db;
      
      const updateJobSql = 'UPDATE job_executions SET label = ? WHERE id = ?';
      db.run(updateJobSql, [label, id], function(err) {
        if (err) {
          console.error('Error updating job execution label:', err);
          reject(err);
        } else {
          console.log('Job execution label renamed successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async rerunJobExecution(id) {
    return new Promise((resolve, reject) => {
      // Get the job execution with its configuration
      const sql = `
        SELECT je.*, jc.settings as configuration_settings 
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        WHERE je.id = ?
      `;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          console.error('Error getting job execution for rerun:', err);
          reject(err);
        } else if (!row) {
          reject(new Error('Job execution not found'));
        } else {
          // Reset the job status for rerun
          const updateSql = `
            UPDATE job_executions 
            SET status = ?, started_at = NULL, completed_at = NULL, 
                total_images = 0, successful_images = 0, failed_images = 0,
                error_message = NULL
            WHERE id = ?
          `;
          
          this.db.run(updateSql, ['pending', id], function(err) {
            if (err) {
              console.error('Error resetting job execution for rerun:', err);
              reject(err);
            } else {
              console.log('Job execution reset for rerun');
              
              // Return the job configuration for actual execution
              const jobConfig = {
                id: row.id,
                label: row.label,
                configurationId: row.configuration_id,
                settings: row.configuration_settings ? JSON.parse(row.configuration_settings) : null
              };
              
              resolve({ 
                success: true, 
                changes: this.changes,
                jobConfig: jobConfig,
                message: 'Job execution reset and ready for rerun'
              });
            }
          });
        }
      });
    });
  }

  async exportJobExecution(id) {
    return new Promise((resolve, reject) => {
      // Get the job execution data for export
      const sql = `
        SELECT je.*, jc.name as configuration_name 
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        WHERE je.id = ?
      `;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          console.error('Error getting job execution for export:', err);
          reject(err);
        } else if (!row) {
          reject(new Error('Job execution not found'));
        } else {
          // In a real implementation, this would create an export file
          const exportData = {
            id: row.id,
            configurationName: row.configuration_name,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label
          };
          
          console.log('Job execution exported successfully');
          resolve({ success: true, data: exportData });
        }
      });
    });
  }

  async cleanupOldExecutions(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM job_executions 
        WHERE started_at < datetime('now', '-${daysToKeep} days')
      `;
      
      this.db.run(sql, [], function(err) {
        if (err) {
          console.error('Error cleaning up old executions:', err);
          reject(err);
        } else {
          console.log(`Cleaned up ${this.changes} old job executions`);
          resolve({ success: true, deletedRows: this.changes });
        }
      });
    });
  }

  async getJobExecutionsByIds(ids) {
    if (!ids || ids.length === 0) {
      return { success: true, executions: [] };
    }
    
    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `
        SELECT je.*, jc.name as configuration_name 
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        WHERE je.id IN (${placeholders})
        ORDER BY je.started_at DESC
      `;
      
      this.db.all(sql, ids, (err, rows) => {
        if (err) {
          console.error('Error getting job executions by IDs:', err);
          reject(err);
        } else {
          // Convert timestamps to Date objects
          const executions = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            configurationName: row.configuration_name,
            startedAt: row.started_at ? new Date(row.started_at) : new Date(),
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label
          }));
          resolve({ success: true, executions });
        }
      });
    });
  }

  async bulkDeleteJobExecutions(ids) {
    if (!ids || ids.length === 0) {
      return { success: true, deletedRows: 0 };
    }
    
    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `DELETE FROM job_executions WHERE id IN (${placeholders})`;
      
      this.db.run(sql, ids, function(err) {
        if (err) {
          console.error('Error bulk deleting job executions:', err);
          reject(err);
        } else {
          console.log(`Bulk deleted ${this.changes} job executions`);
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
          console.log('JobExecution database connection closed');
        }
      });
    }
  }
}

module.exports = { JobExecution };
