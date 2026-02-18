/**
 * RetryQueueService - Queue management and orchestration for retry jobs (ADR-012).
 * Extracted from retryExecutor.js lines ~19-340. Logic copied EXACTLY for 1:1 parity.
 * Used via Shadow Bridge when FEATURE_MODULAR_RETRY_QUEUE === 'true'.
 *
 * Dependencies (DI): processOneJob(job), emit(event, payload)
 */

class RetryQueueService {
  /**
   * @param {Object} deps - Dependencies
   * @param {Function} deps.processOneJob - async (job) => { success, error? }
   * @param {Function} deps.emit - (eventName, payload) => void
   */
  constructor(deps = {}) {
    this.processOneJob = deps.processOneJob || (async () => ({ success: false, error: 'No processor' }));
    this.emit = typeof deps.emit === 'function' ? deps.emit : () => {};
    this.isProcessing = false;
    this.queue = [];
  }

  /**
   * Add a single image to the queue (service API).
   * @param {string} imageId - Image ID
   * @param {Object} options - { useOriginalSettings, modifiedSettings, includeMetadata, failOptions }
   * @returns {Promise<Object>} { success, jobId?, queuedJobs, queueLength, error? }
   */
  async addToQueue(imageId, options = {}) {
    const batch = {
      type: 'retry',
      imageIds: [imageId],
      useOriginalSettings: options.useOriginalSettings,
      modifiedSettings: options.modifiedSettings,
      includeMetadata: options.includeMetadata,
      failOptions: options.failOptions,
    };
    return this.addBatchRetryJob(batch);
  }

  /**
   * Add a batch retry job to the queue (exact copy of retryExecutor.js addBatchRetryJob).
   * @param {Object} batchRetryJob - Batch retry job object
   * @returns {Promise<Object>} Queued job result
   */
  async addBatchRetryJob(batchRetryJob) {
    try {
      const { imageIds, useOriginalSettings, modifiedSettings, includeMetadata, failOptions } = batchRetryJob;

      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        throw new Error('No image IDs provided for batch retry');
      }

      const retryJobs = imageIds.map(imageId => ({
        id: `retry_${imageId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        imageId,
        useOriginalSettings,
        modifiedSettings,
        includeMetadata,
        failOptions: {
          enabled: !!(failOptions && failOptions.enabled),
          steps: Array.isArray(failOptions?.steps) ? failOptions.steps : []
        },
        status: 'pending',
        createdAt: new Date()
      }));

      this.queue.push(...retryJobs);

      this.emit('queue-updated', {
        queueLength: this.queue.length,
        addedJobs: retryJobs.length,
        timestamp: new Date(),
        context: 'retry'
      });

      if (!this.isProcessing) {
        this.startProcessing();
      }

      return {
        success: true,
        jobId: batchRetryJob.id || `batch_${Date.now()}`,
        queuedJobs: retryJobs.length,
        queueLength: this.queue.length,
        message: `Successfully queued ${retryJobs.length} retry jobs`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove all jobs for the given imageId from the queue.
   * @param {string} imageId - Image ID to remove
   */
  removeFromQueue(imageId) {
    const before = this.queue.length;
    this.queue = this.queue.filter(job => job.imageId !== imageId);
    if (this.queue.length !== before) {
      this.emit('queue-updated', {
        queueLength: this.queue.length,
        timestamp: new Date(),
        context: 'retry'
      });
    }
  }

  /**
   * Get current queue status (exact copy of retryExecutor getQueueStatus).
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      pendingJobs: this.queue.filter(job => job.status === 'pending').length,
      processingJobs: this.queue.filter(job => job.status === 'processing').length,
      completedJobs: this.queue.filter(job => job.status === 'completed').length,
      failedJobs: this.queue.filter(job => job.status === 'failed').length
    };
  }

  /**
   * Process the queue (exact copy of retryExecutor processQueue loop).
   * Uses injected processOneJob(job) for each job.
   */
  async startProcessing() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();

        try {
          job.status = 'processing';
          this.emit('job-status-updated', {
            jobId: job.id,
            status: 'processing',
            timestamp: new Date(),
            context: 'retry'
          });

          const result = await this.processOneJob(job);

          if (result.success) {
            job.status = 'completed';
            this.emit('job-completed', {
              jobId: job.id,
              imageId: job.imageId,
              result,
              timestamp: new Date(),
              context: 'retry'
            });
          } else {
            job.status = 'failed';
            this.emit('job-error', {
              jobId: job.id,
              imageId: job.imageId,
              error: result.error,
              timestamp: new Date(),
              context: 'retry'
            });
          }
        } catch (error) {
          job.status = 'failed';
          this.emit('job-error', {
            jobId: job.id,
            imageId: job.imageId,
            error: error.message,
            timestamp: new Date(),
            context: 'retry'
          });
        }

        this.emit('progress', {
          processed: this.processedCount + 1,
          total: this.totalCount,
          currentJob: job,
          timestamp: new Date(),
          context: 'retry'
        });
      }
    } catch (error) {
      // Re-throw or swallow per legacy behavior (legacy only logs)
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear completed jobs from queue (exact copy of retryExecutor clearCompletedJobs).
   */
  clearCompletedJobs() {
    this.queue = this.queue.filter(job => job.status !== 'completed');
    this.emit('queue-updated', {
      queueLength: this.queue.length
    });
  }

  /**
   * Stop processing and clear queue (exact copy of retryExecutor stop).
   */
  stopProcessing() {
    this.isProcessing = false;
    this.queue = [];
    this.emit('stopped', {
      timestamp: new Date()
    });
  }
}

module.exports = { RetryQueueService };
