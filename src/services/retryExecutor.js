const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const { processImage } = require('../producePictureModule');
const aiVision = require('../aiVision');

/**
 * RetryExecutor - Handles post-processing retry for failed images
 * 
 * IMPORTANT: QC failed images stay in tempDirectory until successfully processed
 * - tempDirectory: Contains unprocessed images that failed QC (e.g., /Desktop/Gen_Image_Factory_Generated/)
 * - finalImagePath: Contains successfully processed images (e.g., /Desktop/Gen_Image_Factory_ToUpload/)
 * 
 * Retry mechanism works with UNPROCESSED images from tempDirectory
 * Only processes existing files, never regenerates images
 */
class RetryExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isProcessing = false;
    this.retryQueue = [];
    this.settings = options.settings || {};
    this.tempDirectory = options.tempDirectory || './picture/generated';
    this.generatedImage = options.generatedImage;
    this.currentImageId = null; // Track current image being processed
    
    if (!this.generatedImage) {
      console.warn('🔧 RetryExecutor: No generatedImage model provided, database operations may fail');
    }
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
    
    console.log(`🔧 RetryExecutor: Added job ${queuedJob.id} to queue. Queue length: ${this.retryQueue.length}`);
    
    // Emit queue update event
    this.emit('queue-updated', {
      queueLength: this.retryQueue.length,
      jobId: queuedJob.id
    });

    // If not currently processing, start processing asynchronously
    if (!this.isProcessing) {
      console.log(`🔧 RetryExecutor: Starting processing in 1 second...`);
      // Add a delay before starting to process to make queuing visible
      setTimeout(() => {
        console.log(`🔧 RetryExecutor: Starting to process queue...`);
        this.processQueue();
      }, 1000); // 1 second delay to show queuing
    } else {
      console.log(`🔧 RetryExecutor: Already processing, job ${queuedJob.id} added to queue`);
    }

    return queuedJob;
  }

  /**
   * Process the retry queue
   */
  async processQueue() {
    console.log(`🔧 RetryExecutor: processQueue called. isProcessing: ${this.isProcessing}, queueLength: ${this.retryQueue.length}`);
    
    if (this.isProcessing || this.retryQueue.length === 0) {
      console.log(`🔧 RetryExecutor: Skipping processQueue. isProcessing: ${this.isProcessing}, queueLength: ${this.retryQueue.length}`);
      return;
    }

    this.isProcessing = true;
    console.log(`🔧 RetryExecutor: Set isProcessing to true`);

    try {
      // Process one job at a time to maintain proper queue status
      const job = this.retryQueue.shift();
      
      // Emit queue update event
      this.emit('queue-updated', {
        queueLength: this.retryQueue.length,
        jobId: job.id
      });

      // Process the retry job
      await this.processRetryJob(job);
      
      // After processing, check if there are more jobs and continue
      if (this.retryQueue.length > 0) {
        // Add a small delay to make progress visible and prevent overwhelming the system
        await this.delay(100);
        // Use setImmediate to avoid blocking and allow other operations
        setImmediate(() => {
          this.processQueue();
        });
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

      // Add delay at start to make queuing visible
      await this.delay(1000); // 1 second delay to show queuing

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

          // Add delay between processing images to make progress visible
          if (processedCount < totalImages) {
            await this.delay(500); // 500ms delay between images
          }

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
      // Set current image ID for tracking
      this.currentImageId = imageId;
      console.log(`🔧 RetryExecutor: Processing image ${imageId} with settings:`, { useOriginalSettings, includeMetadata });
      
      // Get image data from database (this would be injected)
      // For now, we'll simulate the process
      
      // Resolve source file path (should be in tempDirectory for QC failed images)
      const sourcePath = await this.resolveSourceFilePath(imageId);
      if (!sourcePath) {
        throw new Error(`Could not resolve source file path for image ${imageId}`);
      }

      console.log(`🔧 RetryExecutor: Checking if source file exists: ${sourcePath}`);

      // Verify source file exists
      try {
        await fs.access(sourcePath);
        console.log(`🔧 RetryExecutor: Source file found: ${sourcePath}`);
      } catch (error) {
        console.error(`🔧 RetryExecutor: Source file not found: ${sourcePath}`);
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
        await this.updateImageStatus(imageId, 'approved', 'Retry processing successful');
        this.currentImageId = null; // Clear current image ID
        return {
          success: true,
          message: 'Image processed successfully',
          processingResult
        };
      } else {
        await this.updateImageStatus(imageId, 'failed_retry', processingResult.error);
        this.currentImageId = null; // Clear current image ID
        return {
          success: false,
          error: processingResult.error,
          processingResult
        };
      }

    } catch (error) {
      // Update image status to failed_retry
      await this.updateImageStatus(imageId, 'failed_retry', error.message);
      this.currentImageId = null; // Clear current image ID
      
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
    try {
      // Get the actual image data from the database
      const image = await this.generatedImage.getGeneratedImage(imageId);
      
      if (!image.success || !image.image) {
        throw new Error(`Image ${imageId} not found in database`);
      }
      
      // Priority 1: Use finalImagePath from database (where processed images actually exist)
      if (image.image.finalImagePath) {
        console.log(`🔧 RetryExecutor: Using database finalImagePath for image ${imageId}: ${image.image.finalImagePath}`);
        return image.image.finalImagePath;
      }
      
      // Priority 2: Fallback to tempImagePath if available (for edge cases)
      if (image.image.tempImagePath) {
        console.log(`🔧 RetryExecutor: Using database tempImagePath for image ${imageId}: ${image.image.tempImagePath}`);
        return image.image.tempImagePath;
      }
      
      // Priority 3: Last resort - construct path in temp directory
      const fallbackTempPath = path.join(this.tempDirectory, `image_${imageId}.png`);
      console.log(`🔧 RetryExecutor: Using fallback temp directory path for image ${imageId}: ${fallbackTempPath}`);
      console.log(`🔧 RetryExecutor: tempDirectory: ${this.tempDirectory}`);
      
      return fallbackTempPath;
      
    } catch (error) {
      console.error(`🔧 RetryExecutor: Error resolving source path for image ${imageId}:`, error);
      throw error;
    }
  }

  /**
   * Get original processing settings for an image
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Original processing settings
   */
  async getOriginalProcessingSettings(imageId) {
    try {
      // Get the actual image data from the database
      const image = await this.generatedImage.getGeneratedImage(imageId);
      
      if (!image.success || !image.image) {
        throw new Error(`Image ${imageId} not found in database`);
      }
      
      // Parse the processing settings from the database
      let originalSettings = {};
      if (image.image.processingSettings) {
        try {
          originalSettings = JSON.parse(image.image.processingSettings);
          console.log(`🔧 RetryExecutor: Retrieved original processing settings for image ${imageId}:`, originalSettings);
        } catch (parseError) {
          console.warn(`🔧 RetryExecutor: Failed to parse processing settings for image ${imageId}, using defaults:`, parseError);
        }
      }
      
      // Return original settings with defaults as fallback
      return {
        imageEnhancement: originalSettings.imageEnhancement || false,
        sharpening: originalSettings.sharpening || 0,
        saturation: originalSettings.saturation || 1.0,
        imageConvert: originalSettings.imageConvert || false,
        convertToJpg: originalSettings.convertToJpg || false,
        jpgQuality: originalSettings.jpgQuality || 100,
        pngQuality: originalSettings.pngQuality || 100,
        removeBg: originalSettings.removeBg || false,
        removeBgSize: originalSettings.removeBgSize || 'auto',
        trimTransparentBackground: originalSettings.trimTransparentBackground || false,
        jpgBackground: originalSettings.jpgBackground || 'white'
      };
    } catch (error) {
      console.error(`🔧 RetryExecutor: Error getting original processing settings for image ${imageId}:`, error);
      // Return safe defaults if we can't get original settings
      return {
        imageEnhancement: false,
        sharpening: 0,
        saturation: 1.0,
        imageConvert: false,
        convertToJpg: false,
        jpgQuality: 100,
        pngQuality: 100,
        removeBg: false,
        removeBgSize: 'auto',
        trimTransparentBackground: false,
        jpgBackground: 'white'
      };
    }
  }

  /**
   * Update image status in database
   * @param {string} imageId - Image ID
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   */
  async updateImageStatus(imageId, status, reason = '') {
    try {
      // Update the database with new status
      if (this.generatedImage && typeof this.generatedImage.updateQCStatus === 'function') {
        await this.generatedImage.updateQCStatus(imageId, status, reason);
        console.log(`🔧 RetryExecutor: Updated image ${imageId} status to ${status} in database`);
      } else {
        console.warn(`🔧 RetryExecutor: Cannot update database - generatedImage model not available`);
      }
    } catch (error) {
      console.error(`🔧 RetryExecutor: Failed to update database status for image ${imageId}:`, error);
    }
    
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
   * Run post-processing on an image using the real processing pipeline
   * @param {string} sourcePath - Source image path
   * @param {Object} settings - Processing settings
   * @param {boolean} includeMetadata - Whether to regenerate metadata
   * @returns {Promise<Object>} Processing result
   */
  async runPostProcessing(sourcePath, settings, includeMetadata) {
    try {
      console.log(`🔧 RetryExecutor: Starting real image processing for: ${sourcePath}`);
      console.log(`🔧 RetryExecutor: Processing settings:`, JSON.stringify(settings, null, 2));
      console.log(`🔧 RetryExecutor: Include metadata: ${includeMetadata}`);
      
      // Verify source file exists
      try {
        await fs.access(sourcePath);
        console.log(`🔧 RetryExecutor: Source file verified: ${sourcePath}`);
      } catch (error) {
        throw new Error(`Source file not accessible: ${sourcePath}`);
      }
      
      // Create a temporary working directory for processing
      const tempDir = path.dirname(sourcePath);
      const fileName = path.basename(sourcePath, path.extname(sourcePath));
      const workingPath = path.join(tempDir, `${fileName}_retry_work.png`);
      
      // Copy source file to working path to avoid modifying original
      await fs.copyFile(sourcePath, workingPath);
      console.log(`🔧 RetryExecutor: Created working copy: ${workingPath}`);
      
      // Prepare config object for processImage function
      const processingConfig = {
        tempDirectory: tempDir,
        outputDirectory: tempDir, // Output to same directory for now
        ...settings
      };
      
      // Process the image using the real processing pipeline
      console.log(`🔧 RetryExecutor: Calling processImage with config:`, JSON.stringify(processingConfig, null, 2));
      const processedImagePath = await processImage(workingPath, fileName, processingConfig);
      console.log(`🔧 RetryExecutor: Image processing completed: ${processedImagePath}`);
      
      // Generate new metadata if requested
      let metadataResult = null;
      if (includeMetadata) {
        try {
          console.log(`🔧 RetryExecutor: Generating new metadata for processed image`);
          // Get the original prompt from the database if available
          const imageData = await this.generatedImage.getGeneratedImage(this.currentImageId);
          let originalPrompt = 'Generated image';
          if (imageData.success && imageData.image.generationPrompt) {
            originalPrompt = imageData.image.generationPrompt;
          }
          
          metadataResult = await aiVision.generateMetadata(
            processedImagePath,
            originalPrompt,
            null, // Use default metadata prompt
            'gpt-4o-mini' // Default model
          );
          console.log(`🔧 RetryExecutor: Metadata generation completed:`, metadataResult);
        } catch (metadataError) {
          console.warn(`🔧 RetryExecutor: Metadata generation failed, continuing without metadata:`, metadataError);
        }
      }
      
      // Move processed image to replace the original source
      const finalOutputPath = sourcePath.replace(path.extname(sourcePath), path.extname(processedImagePath));
      await fs.rename(processedImagePath, finalOutputPath);
      console.log(`🔧 RetryExecutor: Moved processed image to final location: ${finalOutputPath}`);
      
      // Clean up working copy
      try {
        await fs.unlink(workingPath);
        console.log(`🔧 RetryExecutor: Cleaned up working copy`);
      } catch (cleanupError) {
        console.warn(`🔧 RetryExecutor: Failed to clean up working copy:`, cleanupError);
      }
      
      // Update the database with new image path if it changed
      if (finalOutputPath !== sourcePath && this.currentImageId) {
        try {
          await this.generatedImage.updateGeneratedImage(this.currentImageId, {
            finalImagePath: finalOutputPath
          });
          console.log(`🔧 RetryExecutor: Updated database with new image path: ${finalOutputPath}`);
        } catch (dbError) {
          console.warn(`🔧 RetryExecutor: Failed to update database with new path:`, dbError);
        }
      }
      
      // Return success with processing details
      const steps = [];
      if (settings.imageEnhancement) steps.push('enhancement');
      if (settings.sharpening > 0) steps.push('sharpening');
      if (settings.saturation !== 1.0) steps.push('saturation');
      if (settings.imageConvert) steps.push('conversion');
      if (settings.removeBg) steps.push('background_removal');
      if (includeMetadata) steps.push('metadata_regeneration');
      
      return {
        success: true,
        steps,
        message: `Real image processing completed: ${steps.join(', ')}`,
        processedImagePath: finalOutputPath,
        metadata: metadataResult
      };
      
    } catch (error) {
      console.error(`🔧 RetryExecutor: Image processing failed:`, error);
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
