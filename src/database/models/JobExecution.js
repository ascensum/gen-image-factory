const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * JobExecution Database Model
 * 
 * Tracks job execution history and status with foreign key relationship to JobConfiguration
 * Implements job status tracking, statistics, and execution history queries
 */
class JobExecution {
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
        CREATE TABLE IF NOT EXISTS job_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          configuration_id INTEGER NOT NULL,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          status VARCHAR(50) DEFAULT 'running',
          total_images INTEGER DEFAULT 0,
          successful_images INTEGER DEFAULT 0,
          failed_images INTEGER DEFAULT 0,
          error_message TEXT,
          FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE
        )
      `;

      const createIndexesSQL = [
        'CREATE INDEX IF NOT EXISTS idx_job_executions_configuration_id ON job_executions(configuration_id)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_started_at ON job_executions(started_at)'
      ];

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
      });
    });
  }

  async saveJobExecution(execution) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO job_executions 
        (configuration_id, started_at, completed_at, status, total_images, successful_images, failed_images, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        execution.configurationId,
        execution.startedAt || new Date().toISOString(),
        execution.completedAt || null,
        execution.status || 'running',
        execution.totalImages || 0,
        execution.successfulImages || 0,
        execution.failedImages || 0,
        execution.errorMessage || null
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
            errorMessage: row.error_message
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
            errorMessage: row.error_message
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
            total_images = ?, successful_images = ?, failed_images = ?, error_message = ?
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
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message
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
