const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

/**
 * RetryExecutor - Handles post-processing retry for failed images
 * Only processes existing files, never regenerates images
 */
class RetryExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isProcessing = false;
    this.retryQueue = [];
    this.settings = options.settings || {};
    this.tempDirectory = options.tempDirectory || './picture/generated';
  }

  /**
   * Add a batch retry job to the queue
   * @param {Object} batchJob - Batch retry job configuration
   */
  async addBatchRetryJob(batchJob) {
    const {
      type,
      imageIds,
      useOriginalSettings,
      modifiedSettings,
      includeMetadata = false,
      createdAt,
      status
    } = batchJob;

    // Validate batch job
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      throw new Error('Invalid batch job: no image IDs provided');
    }

    const queuedJob = {
      id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      imageIds,
      useOriginalSettings,
      modifiedSettings,
      includeMetadata,
      createdAt: createdAt || new Date(),
      status: status || 'pending',
      priority: 'normal'
    };

    this.retryQueue.push(queuedJob);
    
    // Emit queue update event
    this.emit('queue-updated', {
      queueLength: this.retryQueue.length,
      jobId: queuedJob.id
    });

    // If not currently processing, start processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    return queuedJob;
  }

  /**
   * Process the retry queue
   */
  async processQueue() {
    if (this.isProcessing || this.retryQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.retryQueue.length > 0) {
        const job = this.retryQueue.shift();
        
        // Emit queue update event
        this.emit('queue-updated', {
          queueLength: this.retryQueue.length,
          jobId: job.id
        });

        // Process the retry job
        await this.processRetryJob(job);
      }
    } catch (error) {
      console.error('Error processing retry queue:', error);
      this.emit('error', {
        error: error.message,
        code: 'RETRY_QUEUE_ERROR',
        timestamp: new Date()
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single retry job
   * @param {Object} job - Retry job to process
   */
  async processRetryJob(job) {
    try {
      // Update job status to processing
      job.status = 'processing';
      this.emit('job-status-updated', {
        jobId: job.id,
        status: 'processing',
        timestamp: new Date()
      });

      // Emit progress event
      this.emit('progress', {
        jobId: job.id,
        step: 'starting',
        progress: 0,
        message: 'Starting retry processing...',
        context: 'retry'
      });

      // Process each image in the batch
      const totalImages = job.imageIds.length;
      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;

      for (const imageId of job.imageIds) {
        try {
          // Emit progress for individual image
          this.emit('progress', {
            jobId: job.id,
            step: 'processing_image',
            progress: Math.round((processedCount / totalImages) * 100),
            message: `Processing image ${processedCount + 1} of ${totalImages}`,
            context: 'retry',
            imageId
          });

          // Process the image
          const result = await this.processSingleImage(
            imageId,
            job.useOriginalSettings,
            job.modifiedSettings,
            job.includeMetadata
          );

          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }

          processedCount++;

          // Emit progress update
          this.emit('progress', {
            jobId: job.id,
            step: 'image_processed',
            progress: Math.round((processedCount / totalImages) * 100),
            message: `Processed ${processedCount} of ${totalImages} images`,
            context: 'retry',
            imageId,
            result
          });

        } catch (error) {
          console.error(`Error processing image ${imageId}:`, error);
          failedCount++;
          processedCount++;

          // Emit error for individual image
          this.emit('image-error', {
            jobId: job.id,
            imageId,
            error: error.message,
            context: 'retry'
          });
        }
      }

      // Update job status to completed
      job.status = 'completed';
      job.completedAt = new Date();
      job.results = {
        totalImages,
        processedCount,
        successCount,
        failedCount
      };

      // Emit completion event
      this.emit('job-completed', {
        jobId: job.id,
        results: job.results,
        timestamp: new Date(),
        context: 'retry'
      });

      // Emit final progress
      this.emit('progress', {
        jobId: job.id,
        step: 'completed',
        progress: 100,
        message: `Retry processing completed. ${successCount} successful, ${failedCount} failed.`,
        context: 'retry'
      });

    } catch (error) {
      console.error(`Error processing retry job ${job.id}:`, error);
      
      // Update job status to failed
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date();

      // Emit error event
      this.emit('job-error', {
        jobId: job.id,
        error: error.message,
        timestamp: new Date(),
        context: 'retry'
      });
    }
  }

  /**
   * Process a single image for retry
   * @param {string} imageId - Image ID to process
   * @param {boolean} useOriginalSettings - Whether to use original settings
   * @param {Object} modifiedSettings - Modified processing settings
   * @param {boolean} includeMetadata - Whether to regenerate metadata
   * @returns {Promise<Object>} Processing result
   */
  async processSingleImage(imageId, useOriginalSettings, modifiedSettings, includeMetadata) {
    try {
      // Get image data from database (this would be injected)
      // For now, we'll simulate the process
      
      // Resolve source file path
      const sourcePath = await this.resolveSourceFilePath(imageId);
      if (!sourcePath) {
        throw new Error(`Could not resolve source file path for image ${imageId}`);
      }

      // Verify source file exists
      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      // Determine processing settings
      let processingSettings;
      if (useOriginalSettings) {
        // Get original settings from the image's execution
        processingSettings = await this.getOriginalProcessingSettings(imageId);
      } else {
        // Use modified settings
        processingSettings = modifiedSettings || {};
      }

      // Update image status to processing
      await this.updateImageStatus(imageId, 'processing');

      // Run post-processing steps
      const processingResult = await this.runPostProcessing(
        sourcePath,
        processingSettings,
        includeMetadata
      );

      // Update image status based on result
      if (processingResult.success) {
        await this.updateImageStatus(imageId, 'approved');
        return {
          success: true,
          message: 'Image processed successfully',
          processingResult
        };
      } else {
        await this.updateImageStatus(imageId, 'failed', processingResult.error);
        return {
          success: false,
          error: processingResult.error,
          processingResult
        };
      }

    } catch (error) {
      // Update image status to failed
      await this.updateImageStatus(imageId, 'failed', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resolve source file path for an image
   * @param {string} imageId - Image ID
   * @returns {Promise<string>} Source file path
   */
  async resolveSourceFilePath(imageId) {
    // This would typically query the database to get the image's finalImagePath
    // For now, we'll construct a path based on the tempDirectory setting
    
    // In a real implementation, you'd get this from the database:
    // const image = await this.generatedImage.getGeneratedImage(imageId);
    // return image.finalImagePath || path.join(this.tempDirectory, `image_${imageId}.png`);
    
    return path.join(this.tempDirectory, `image_${imageId}.png`);
  }

  /**
   * Get original processing settings for an image
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Original processing settings
   */
  async getOriginalProcessingSettings(imageId) {
    // This would query the database to get the original settings
    // For now, return default settings
    return {
      imageEnhancement: false,
      sharpening: 50,
      saturation: 100,
      imageConvert: false,
      convertToJpg: true,
      jpgQuality: 90,
      pngQuality: 9,
      removeBg: false,
      removeBgSize: 'auto',
      trimTransparentBackground: false,
      jpgBackground: '#FFFFFF'
    };
  }

  /**
   * Update image status in database
   * @param {string} imageId - Image ID
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   */
  async updateImageStatus(imageId, status, reason = '') {
    // This would update the database
    // await this.generatedImage.updateQCStatus(imageId, status, reason);
    
    // Emit status update event
    this.emit('image-status-updated', {
      imageId,
      status,
      reason,
      timestamp: new Date(),
      context: 'retry'
    });
  }

  /**
   * Run post-processing on an image
   * @param {string} sourcePath - Source image path
   * @param {Object} settings - Processing settings
   * @param {boolean} includeMetadata - Whether to regenerate metadata
   * @returns {Promise<Object>} Processing result
   */
  async runPostProcessing(sourcePath, settings, includeMetadata) {
    try {
      // This would integrate with the existing image processing pipeline
      // For now, we'll simulate the process
      
      const steps = [];
      
      // Image enhancement
      if (settings.imageEnhancement) {
        steps.push('enhancement');
        // Simulate processing time
        await this.delay(100);
      }
      
      // Sharpening
      if (settings.sharpening > 0) {
        steps.push('sharpening');
        await this.delay(50);
      }
      
      // Saturation adjustment
      if (settings.saturation !== 100) {
        steps.push('saturation');
        await this.delay(50);
      }
      
      // Image conversion
      if (settings.imageConvert) {
        steps.push('conversion');
        await this.delay(200);
      }
      
      // Background removal
      if (settings.removeBg) {
        steps.push('background_removal');
        await this.delay(300);
      }
      
      // Metadata regeneration
      if (includeMetadata) {
        steps.push('metadata_regeneration');
        await this.delay(150);
      }
      
      return {
        success: true,
        steps,
        message: `Post-processing completed: ${steps.join(', ')}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current queue status
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.retryQueue.length,
      pendingJobs: this.retryQueue.filter(job => job.status === 'pending').length,
      processingJobs: this.retryQueue.filter(job => job.status === 'processing').length,
      completedJobs: this.retryQueue.filter(job => job.status === 'completed').length,
      failedJobs: this.retryQueue.filter(job => job.status === 'failed').length
    };
  }

  /**
   * Clear completed jobs from queue
   */
  clearCompletedJobs() {
    this.retryQueue = this.retryQueue.filter(job => job.status !== 'completed');
    
    // Emit queue update event
    this.emit('queue-updated', {
      queueLength: this.retryQueue.length
    });
  }

  /**
   * Stop processing and clear queue
   */
  stop() {
    this.isProcessing = false;
    this.retryQueue = [];
    
    // Emit stop event
    this.emit('stopped', {
      timestamp: new Date()
    });
  }

  /**
   * Utility function to simulate delays
   * @param {number} ms - Milliseconds to delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryExecutor;
