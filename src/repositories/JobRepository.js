/**
 * JobRepository - Persistence layer for job executions (ADR-009)
 * Extracted from: JobExecution.js | Feature: FEATURE_MODULAR_JOB_REPOSITORY
 * Related ADRs: 001 (< 400 lines), 003 (DI), 006 (Shadow Bridge), 009 (Repository)
 * Handles all DB operations for job_executions table
 */
class JobRepository {
  /**
   * @param {Object} jobExecutionModel - JobExecution model instance (provides db connection)
   */
  constructor(jobExecutionModel) {
    this.model = jobExecutionModel;
    this.db = jobExecutionModel.db;
  }

  /** Get job history with JOIN - Extracted from: JobExecution.js lines 529-577 */
  async getJobHistory(limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          je.*,
          jc.label as configuration_label,
          jc.name as configuration_name
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
          const executions = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            configurationLabel: row.configuration_label,
            configurationName: row.configuration_name,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label,
            configurationSnapshot: row.configuration_snapshot ? JSON.parse(row.configuration_snapshot) : null
          }));
          resolve({ success: true, executions });
        }
      });
    });
  }

  /** Get job statistics - Extracted from: JobExecution.js lines 579-666 */
  async getJobStatistics() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as totalJobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedJobs,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedJobs,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as runningJobs,
          SUM(total_images) as totalImages,
          SUM(successful_images) as successfulImages,
          SUM(failed_images) as failedImages,
          AVG(CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(started_at)) * 86400 
            ELSE NULL 
          END) as avgDurationSeconds
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
            runningJobs: row.runningJobs || 0,
            totalImages: row.totalImages || 0,
            successfulImages: row.successfulImages || 0,
            failedImages: row.failedImages || 0,
            avgDurationSeconds: row.avgDurationSeconds || 0
          };
          resolve({ success: true, statistics: stats });
        }
      });
    });
  }

  /**
   * Get job executions with filters and pagination
   * 
   * Extracted from: JobExecution.js lines 705-812
   * Query: Complex WHERE clause with multiple filters + pagination
   * 
   * @param {Object} filters - Filter criteria
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Number of records per page
   * @returns {Promise<Object>} { success: true, executions: [...], pagination: {...} }
   */
  async getJobExecutionsWithFilters(filters = {}, page = 1, pageSize = 25) {
    return new Promise((resolve, reject) => {
      const conditions = [];
      const params = [];

      if (filters.status) {
        conditions.push('je.status = ?');
        params.push(filters.status);
      }

      if (filters.configurationId) {
        conditions.push('je.configuration_id = ?');
        params.push(filters.configurationId);
      }

      if (filters.startDate) {
        conditions.push('je.started_at >= ?');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push('je.started_at <= ?');
        params.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * pageSize;

      const sql = `
        SELECT 
          je.*,
          jc.label as configuration_label,
          jc.name as configuration_name
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        ${whereClause}
        ORDER BY je.started_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(pageSize, offset);

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error getting filtered job executions:', err);
          reject(err);
        } else {
          const executions = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            configurationLabel: row.configuration_label,
            configurationName: row.configuration_name,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label,
            configurationSnapshot: row.configuration_snapshot ? JSON.parse(row.configuration_snapshot) : null
          }));

          resolve({
            success: true,
            executions,
            pagination: {
              page,
              pageSize,
              hasMore: rows.length === pageSize
            }
          });
        }
      });
    });
  }

  /**
   * Get count of job executions matching filters
   * 
   * Extracted from: JobExecution.js lines 814-870
   * Query: COUNT with WHERE clause
   * 
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} { success: true, count: number }
   */
  async getJobExecutionsCount(filters = {}) {
    return new Promise((resolve, reject) => {
      const conditions = [];
      const params = [];

      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }

      if (filters.configurationId) {
        conditions.push('configuration_id = ?');
        params.push(filters.configurationId);
      }

      if (filters.startDate) {
        conditions.push('started_at >= ?');
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push('started_at <= ?');
        params.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT COUNT(*) as count FROM job_executions ${whereClause}`;

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

  /**
   * Update job execution statistics (matches legacy JobExecution semantics).
   * Uses calculateJobExecutionStatistics so total_images = expected (from row), successful_images = actual
   * count in generated_images, failed_images = generation failed (expected - actual). Single Job View
   * "Generation failed" uses this failed_images count.
   *
   * @param {number|string} executionId - Execution ID
   * @returns {Promise<Object>} { success: true, changes: number }
   */
  async updateJobExecutionStatistics(executionId) {
    const statsResult = await this.calculateJobExecutionStatistics(executionId);
    if (!statsResult.success) {
      return Promise.reject(new Error('Failed to calculate statistics'));
    }
    const { totalImages, successfulImages, failedImages } = statsResult.statistics;
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE job_executions
        SET total_images = ?, successful_images = ?, failed_images = ?
        WHERE id = ?
      `;
      this.db.run(sql, [totalImages, successfulImages, failedImages, executionId], function(err) {
        if (err) {
          console.error('Error updating job execution statistics:', err);
          reject(err);
        } else {
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get job executions by multiple IDs
   * Extracted from: JobExecution.js lines 1028-1100
   */
  async getJobExecutionsByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: 'No IDs provided' };
    }

    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `
        SELECT 
          je.*,
          jc.label as configuration_label,
          jc.name as configuration_name
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
          const executions = rows.map(row => ({
            id: row.id,
            configurationId: row.configuration_id,
            configurationLabel: row.configuration_label,
            configurationName: row.configuration_name,
            startedAt: row.started_at ? new Date(row.started_at) : null,
            completedAt: row.completed_at ? new Date(row.completed_at) : null,
            status: row.status,
            totalImages: row.total_images,
            successfulImages: row.successful_images,
            failedImages: row.failed_images,
            errorMessage: row.error_message,
            label: row.label,
            configurationSnapshot: row.configuration_snapshot ? JSON.parse(row.configuration_snapshot) : null
          }));
          resolve({ success: true, executions });
        }
      });
    });
  }

  /** Save job execution - Extracted from: JobExecution.js lines 337-368 */
  async saveJobExecution(execution) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO job_executions (configuration_id, started_at, completed_at, status, total_images, successful_images, failed_images, error_message, label, configuration_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [execution.configurationId, execution.startedAt || new Date().toISOString(), execution.completedAt || null, execution.status || 'running', execution.totalImages || 0, execution.successfulImages || 0, execution.failedImages || 0, execution.errorMessage || null, execution.label || null, execution.configurationSnapshot ? JSON.stringify(execution.configurationSnapshot) : null];
      this.db.run(sql, params, function(err) {
        if (err) { console.error('Error saving job execution:', err); reject(err); }
        else { console.log('Job execution saved successfully'); resolve({ success: true, id: this.lastID }); }
      });
    });
  }

  /** Get single job execution by ID - Extracted from: JobExecution.js lines 370-399 */
  async getJobExecution(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM job_executions WHERE id = ?', [id], (err, row) => {
        if (err) { console.error('Error getting job execution:', err); reject(err); }
        else if (row) {
          const execution = { id: row.id, configurationId: row.configuration_id, startedAt: row.started_at ? new Date(row.started_at) : null, completedAt: row.completed_at ? new Date(row.completed_at) : null, status: row.status, totalImages: row.total_images, successfulImages: row.successful_images, failedImages: row.failed_images, errorMessage: row.error_message, label: row.label, configurationSnapshot: row.configuration_snapshot ? JSON.parse(row.configuration_snapshot) : null };
          resolve({ success: true, execution });
        } else { resolve({ success: false, error: 'Job execution not found' }); }
      });
    });
  }

  /** Get all job executions - Extracted from: JobExecution.js lines 401-427 */
  async getAllJobExecutions() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM job_executions ORDER BY started_at DESC', [], (err, rows) => {
        if (err) { console.error('Error getting all job executions:', err); reject(err); }
        else {
          const executions = rows.map(row => ({ id: row.id, configurationId: row.configuration_id, startedAt: row.started_at ? new Date(row.started_at) : null, completedAt: row.completed_at ? new Date(row.completed_at) : null, status: row.status, totalImages: row.total_images, successfulImages: row.successful_images, failedImages: row.failed_images, errorMessage: row.error_message, label: row.label }));
          resolve({ success: true, executions });
        }
      });
    });
  }

  /** Update job execution - Extracted from: JobExecution.js lines 429-463 */
  async updateJobExecution(id, execution) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE job_executions SET configuration_id = ?, started_at = ?, completed_at = ?, status = ?, total_images = ?, successful_images = ?, failed_images = ?, error_message = ?, label = ?, configuration_snapshot = COALESCE(?, configuration_snapshot) WHERE id = ?`;
      const params = [execution.configurationId, execution.startedAt ? execution.startedAt.toISOString() : null, execution.completedAt ? execution.completedAt.toISOString() : null, execution.status, execution.totalImages, execution.successfulImages, execution.failedImages, execution.errorMessage, execution.label, execution.configurationSnapshot ? JSON.stringify(execution.configurationSnapshot) : null, id];
      this.db.run(sql, params, function(err) {
        if (err) { console.error('Error updating job execution:', err); reject(err); }
        else { console.log('Job execution updated successfully'); resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Delete job execution by ID - Extracted from: JobExecution.js lines 530-544 */
  async deleteJobExecution(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM job_executions WHERE id = ?', [id], function(err) {
        if (err) { console.error('Error deleting job execution:', err); reject(err); }
        else { console.log('Job execution deleted successfully'); resolve({ success: true, deletedRows: this.changes }); }
      });
    });
  }

  /** Calculate job statistics - Extracted from: JobExecution.js lines 634-683 */
  async calculateJobExecutionStatistics(executionId) {
    return new Promise((resolve, reject) => {
      const jobSql = 'SELECT total_images FROM job_executions WHERE id = ?';
      this.db.get(jobSql, [executionId], (err, jobRow) => {
        if (err) { console.error('Error getting job execution:', err); reject(err); return; }
        const expectedTotal = jobRow?.total_images || 0;
        const imagesSql = `SELECT COUNT(*) as actualImages, SUM(CASE WHEN qc_status = 'approved' THEN 1 ELSE 0 END) as approvedImages, SUM(CASE WHEN qc_status = 'qc_failed' THEN 1 ELSE 0 END) as qcFailedImages FROM generated_images WHERE execution_id = ?`;
        this.db.get(imagesSql, [executionId], (err, imageRow) => {
          if (err) { console.error('Error calculating job execution statistics:', err); reject(err); return; }
          const actualImages = imageRow?.actualImages || 0;
          const approvedImages = imageRow?.approvedImages || 0;
          const qcFailedImages = imageRow?.qcFailedImages || 0;
          const failedImages = expectedTotal - actualImages;
          const stats = { totalImages: expectedTotal, successfulImages: actualImages, failedImages: Math.max(0, failedImages), approvedImages, qcFailedImages };
          console.log(`Job ${executionId} stats: expected=${expectedTotal}, actual=${actualImages}, approved=${approvedImages}, qcFailed=${qcFailedImages}, failed=${failedImages}`);
          resolve({ success: true, statistics: stats });
        });
      });
    });
  }

  /** Update job execution status - Extracted from: JobExecution.js lines 465-493 */
  async updateJobExecutionStatus(id, status, jobId = null, errorMessage = null) {
    return new Promise((resolve, reject) => {
      let sql; let params;
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
        if (err) { console.error('Error updating job execution status:', err); reject(err); }
        else { resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Rename job execution label - Extracted from: JobExecution.js lines 916-931 */
  async renameJobExecution(id, label) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE job_executions SET label = ? WHERE id = ?', [label, id], function(err) {
        if (err) { console.error('Error updating job execution label:', err); reject(err); }
        else { resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Export job execution data (single-row for export UI) - Extracted from: JobExecution.js lines 988-1024 */
  async exportJobExecution(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT je.*, jc.name as configuration_name
        FROM job_executions je
        LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
        WHERE je.id = ?
      `;
      this.db.get(sql, [id], (err, row) => {
        if (err) { reject(err); return; }
        if (!row) { reject(new Error('Job execution not found')); return; }
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
        resolve({ success: true, data: exportData });
      });
    });
  }

  /** Bulk delete job executions - Extracted from: JobExecution.js lines 1085-1103 */
  async bulkDeleteJobExecutions(ids) {
    if (!ids || ids.length === 0) { return Promise.resolve({ success: true, deletedRows: 0 }); }
    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `DELETE FROM job_executions WHERE id IN (${placeholders})`;
      this.db.run(sql, ids, function(err) {
        if (err) { console.error('Error bulk deleting job executions:', err); reject(err); }
        else { resolve({ success: true, deletedRows: this.changes }); }
      });
    });
  }
}

module.exports = { JobRepository };
