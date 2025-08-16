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
      
      if (filters.dateRange && filters.dateRange !== 'all') {
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
      sql += ' ORDER BY je.started_at DESC LIMIT ? OFFSET ?';
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
      
      if (filters.dateRange && filters.dateRange !== 'all') {
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
      const sql = 'UPDATE job_executions SET label = ? WHERE id = ?';
      
      this.db.run(sql, [label, id], function(err) {
        if (err) {
          console.error('Error renaming job execution:', err);
          reject(err);
        } else {
          console.log('Job execution renamed successfully');
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async rerunJobExecution(id) {
    return new Promise((resolve, reject) => {
      // For now, just reset the status to 'pending'
      // In a real implementation, this would trigger the job execution
      const sql = 'UPDATE job_executions SET status = ?, started_at = NULL, completed_at = NULL WHERE id = ?';
      
      this.db.run(sql, ['pending', id], function(err) {
        if (err) {
          console.error('Error rerunning job execution:', err);
          reject(err);
        } else {
          console.log('Job execution reset for rerun');
          resolve({ success: true, changes: this.changes });
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
