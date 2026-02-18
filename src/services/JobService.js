/**
 * JobService - Coordination Layer (Orchestration + Persistence)
 * 
 * Architectural Pattern: Service Layer (ADR-003, ADR-006)
 * Related: Story 3.1 Phase 4, Story 3.2 Phase 1
 * 
 * Responsibility: Coordinate JobEngine (orchestration) + JobRepository (persistence)
 * 
 * Flow:
 * 1. Accept job configuration
 * 2. Delegate orchestration to JobEngine
 * 3. Listen to JobEngine events
 * 4. Persist results via JobRepository
 * 5. Emit consolidated events for upstream consumers
 * 
 * Related ADRs:
 * - ADR-001: File Size Guardrail (< 400 lines)
 * - ADR-003: Dependency Injection
 * - ADR-006: Shadow Bridge Pattern
 * - ADR-009: Persistence Repository Layer
 * 
 * Feature Toggle: FEATURE_MODULAR_JOB_SERVICE
 */

const { EventEmitter } = require('events');

/**
 * JobService
 * 
 * Coordinates job execution lifecycle:
 * - JobEngine handles pure orchestration (no DB)
 * - JobRepository handles persistence (no orchestration)
 * - JobService bridges the two with event-based coordination
 */
class JobService extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {JobEngine} options.jobEngine - Job orchestration engine (DI)
   * @param {JobRepository} options.jobRepository - Job persistence repository (DI)
   */
  constructor(options = {}) {
    super();
    
    if (!options.jobEngine) {
      throw new Error('JobService requires jobEngine dependency');
    }
    if (!options.jobRepository) {
      throw new Error('JobService requires jobRepository dependency');
    }
    
    // Dependency Injection (ADR-003)
    this.jobEngine = options.jobEngine;
    this.jobRepository = options.jobRepository;
    
    // Internal state
    this.currentExecutionId = null;
    this.currentJobId = null;
    this.abortController = null;
    
    // Wire up JobEngine event listeners
    this._setupJobEngineListeners();
  }

  /**
   * Setup event listeners for JobEngine
   * Pattern: JobEngine emits → JobService persists → JobService re-emits
   */
  _setupJobEngineListeners() {
    // Progress events - forward to consumers
    this.jobEngine.on('progress', (data) => {
      this.emit('progress', data);
    });

    // Image generation events - persist + forward
    this.jobEngine.on('image-generated', async (data) => {
      // Forward event to consumers immediately
      this.emit('image-generated', data);
      
      // Persist image result (non-blocking)
      if (this.currentExecutionId && data.image) {
        try {
          // Note: Image persistence is handled by ImageRepository
          // This is a placeholder for future integration
          // await this.imageRepository.saveGeneratedImage(data.image);
        } catch (err) {
          console.warn('JobService: Failed to persist image:', err.message);
        }
      }
    });

    // Error events - persist + forward
    this.jobEngine.on('error', async (error) => {
      this.emit('error', error);
      
      // Update job execution status to failed
      if (this.currentExecutionId) {
        try {
          await this.jobRepository.updateJobExecutionStatus(
            this.currentExecutionId,
            'failed',
            this.currentJobId,
            error.message || 'Unknown error'
          );
        } catch (err) {
          console.error('JobService: Failed to update execution status:', err);
        }
      }
    });

    // Job completion events - persist final results
    this.jobEngine.on('job-complete', async (result) => {
      this.emit('job-complete', result);
      
      // Update job execution with final statistics
      if (this.currentExecutionId) {
        try {
          await this.jobRepository.updateJobExecution(this.currentExecutionId, {
            status: result.status || 'completed',
            endedAt: new Date().toISOString(),
            totalImages: result.totalImages || 0,
            successfulImages: result.successfulImages || 0,
            failedImages: result.failedImages || 0,
            errorMessage: result.error || null
          });
        } catch (err) {
          console.error('JobService: Failed to update final execution:', err);
        }
      }
    });
  }

  /**
   * Start job execution
   * 
   * Flow:
   * 1. Create job execution record (JobRepository)
   * 2. Delegate orchestration to JobEngine
   * 3. Listen to events and persist incrementally
   * 4. Return execution ID for tracking
   * 
   * @param {Object} config - Job configuration
   * @param {Object} options - Execution options
   * @param {string} options.configurationId - Configuration ID for tracking
   * @param {string} options.label - Human-readable job label
   * @returns {Promise<Object>} { success: true, executionId, jobId }
   */
  async startJob(config, options = {}) {
    try {
      // Validate configuration
      if (!config) {
        throw new Error('Job configuration is required');
      }

      // Step 1: Create job execution record
      const execution = {
        configurationId: options.configurationId || null,
        label: options.label || 'Untitled Job',
        status: 'running',
        startedAt: new Date().toISOString(),
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0,
        errorMessage: null
      };

      const saveResult = await this.jobRepository.saveJobExecution(execution);
      if (!saveResult.success) {
        throw new Error('Failed to create job execution record');
      }

      this.currentExecutionId = saveResult.id;
      this.currentJobId = saveResult.jobId || null;

      // Step 2: Create abort controller for cancellation
      this.abortController = new AbortController();

      // Step 3: Execute job via JobEngine
      // JobEngine will emit events that we're listening to
      const result = await this.jobEngine.executeJob(config, this.abortController.signal);

      // Step 4: Return execution tracking info
      return {
        success: true,
        executionId: this.currentExecutionId,
        jobId: this.currentJobId,
        result: result
      };
    } catch (error) {
      console.error('JobService.startJob failed:', error);
      
      // Update execution status to failed
      if (this.currentExecutionId) {
        try {
          await this.jobRepository.updateJobExecutionStatus(
            this.currentExecutionId,
            'failed',
            this.currentJobId,
            error.message
          );
        } catch (updateErr) {
          console.error('Failed to update execution status:', updateErr);
        }
      }
      
      throw error;
    } finally {
      // Cleanup
      this.currentExecutionId = null;
      this.currentJobId = null;
      this.abortController = null;
    }
  }

  /**
   * Stop current job execution
   * Delegates to JobEngine's stop mechanism
   * 
   * @returns {Promise<Object>} { success: true, message }
   */
  async stopJob() {
    try {
      if (!this.abortController) {
        return { success: false, message: 'No active job to stop' };
      }

      // Signal abort to JobEngine
      this.abortController.abort();

      // Update execution status
      if (this.currentExecutionId) {
        await this.jobRepository.updateJobExecutionStatus(
          this.currentExecutionId,
          'stopped',
          this.currentJobId,
          'Job stopped by user'
        );
      }

      return { success: true, message: 'Job stop signal sent' };
    } catch (error) {
      console.error('JobService.stopJob failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get job execution status
   * 
   * @param {string|number} executionId - Execution ID
   * @returns {Promise<Object>} Execution details
   */
  async getJobStatus(executionId) {
    try {
      const result = await this.jobRepository.getJobExecution(executionId);
      return result;
    } catch (error) {
      console.error('JobService.getJobStatus failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get job history
   * 
   * @param {number} limit - Number of records to return
   * @returns {Promise<Object>} { success: true, executions: [...] }
   */
  async getJobHistory(limit = 50) {
    try {
      const result = await this.jobRepository.getJobHistory(limit);
      return result;
    } catch (error) {
      console.error('JobService.getJobHistory failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get job statistics
   * 
   * @returns {Promise<Object>} { totalJobs, completedJobs, failedJobs, averageDuration }
   */
  async getJobStatistics() {
    try {
      const result = await this.jobRepository.getJobStatistics();
      return result;
    } catch (error) {
      console.error('JobService.getJobStatistics failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update job execution statistics (called after images are processed)
   * 
   * @param {string|number} executionId - Execution ID
   * @returns {Promise<Object>} { success: true }
   */
  async updateJobStatistics(executionId) {
    try {
      const result = await this.jobRepository.updateJobExecutionStatistics(executionId);
      return result;
    } catch (error) {
      console.error('JobService.updateJobStatistics failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup() {
    try {
      // Stop any active job
      if (this.abortController) {
        this.abortController.abort();
      }

      // Remove event listeners
      this.jobEngine.removeAllListeners();
      this.removeAllListeners();

      return { success: true };
    } catch (error) {
      console.error('JobService.cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { JobService };
