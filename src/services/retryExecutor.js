const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { processImage } = require('../producePictureModule');
const aiVision = require('../aiVision');
const { JobConfiguration } = require('../database/models/JobConfiguration');

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
    this.queue = [];
    this.settings = options.settings || {};
    // Use cross-platform path logic (same as JobConfiguration.getDefaultSettings())
    // These are DEFAULT paths - will be overridden by user settings if available
    let tempDir, outputDir;
    try {
      const { app } = require('electron');
      const desktopPath = app.getPath('desktop');
      tempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'generated');
      outputDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
    } catch (error) {
      const os = require('os');
      const homeDir = os.homedir();
      tempDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'generated');
      outputDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'toupload');
    }
    
    this.tempDirectory = options.tempDirectory || tempDir;
    this.outputDirectory = options.outputDirectory || outputDir;
    this.generatedImage = options.generatedImage;
    // Prefer shared JobConfiguration instance from backend adapter to avoid DB init races
    this.jobConfig = options.jobConfig || new JobConfiguration();
    this.currentImageId = null; // Track current image being processed
    
    if (!this.generatedImage) {
      console.warn('🔧 RetryExecutor: No generatedImage model provided, database operations may fail');
    }
  }

  /**
   * Add a batch retry job to the queue
   * @param {Object} batchRetryJob - Batch retry job object
   * @returns {Promise<Object>} Queued job result
   */
  async addBatchRetryJob(batchRetryJob) {
    try {
      console.log(`🔧 RetryExecutor: addBatchRetryJob called with job type: ${batchRetryJob.type}`);
      
      const { imageIds, useOriginalSettings, modifiedSettings, includeMetadata } = batchRetryJob;
      
      console.log(`🔧 RetryExecutor: Processing batch retry job:`);
      console.log(`  - imageIds: ${imageIds}`);
      console.log(`  - useOriginalSettings: ${useOriginalSettings}`);
      console.log(`  - modifiedSettings keys:`, modifiedSettings ? Object.keys(modifiedSettings) : 'null');
      console.log(`  - includeMetadata: ${includeMetadata}`);
      
      // Validate inputs
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
        throw new Error('No image IDs provided for batch retry');
      }

      // Create individual retry jobs for each image
      const retryJobs = imageIds.map(imageId => ({
        id: `retry_${imageId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        imageId,
      useOriginalSettings,
      modifiedSettings,
      includeMetadata,
        status: 'pending',
        createdAt: new Date()
      }));

      console.log(`🔧 RetryExecutor: Created ${retryJobs.length} individual retry jobs`);

      // Add all jobs to the queue
      this.queue.push(...retryJobs);
    
    // Emit queue update event
    this.emit('queue-updated', {
        queueLength: this.queue.length,
        addedJobs: retryJobs.length,
        timestamp: new Date(),
        context: 'retry'
      });

      console.log(`🔧 RetryExecutor: Added ${retryJobs.length} jobs to queue. Queue length: ${this.queue.length}`);

      // Start processing if not already running
    if (!this.isProcessing) {
        console.log(`🔧 RetryExecutor: Starting processing queue`);
      this.processQueue();
    }

      return {
        success: true,
        jobId: batchRetryJob.id || `batch_${Date.now()}`,
        queuedJobs: retryJobs.length,
        queueLength: this.queue.length,
        message: `Successfully queued ${retryJobs.length} retry jobs`
      };

    } catch (error) {
      console.error(`🔧 RetryExecutor: Error adding batch retry job:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process the retry queue
   */
  async processQueue() {
    if (this.isProcessing) {
      console.log(`🔧 RetryExecutor: Already processing, skipping`);
      return;
    }

    this.isProcessing = true;
    console.log(`🔧 RetryExecutor: Starting to process queue. Queue length: ${this.queue.length}`);

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        console.log(`🔧 RetryExecutor: Processing job with keys:`, Object.keys(job));
        
        try {
          // Update job status to processing
          job.status = 'processing';
          this.emit('job-status-updated', {
            jobId: job.id,
            status: 'processing',
            timestamp: new Date(),
            context: 'retry'
          });

          // Process the image
          const result = await this.processSingleImage(job);

          console.log(`🔧 RetryExecutor: Job ${job.id} completed with result keys:`, Object.keys(result));

          // Update job status based on result
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
          console.error(`🔧 RetryExecutor: Error processing job ${job.id}:`, error);
          job.status = 'failed';
          this.emit('job-error', {
            jobId: job.id,
            imageId: job.imageId,
            error: error.message,
            timestamp: new Date(),
            context: 'retry'
          });
        }

        // Emit progress event
        this.emit('progress', {
          processed: this.processedCount + 1,
          total: this.totalCount,
          currentJob: job,
          timestamp: new Date(),
          context: 'retry'
        });
      }

      console.log(`🔧 RetryExecutor: Queue processing completed`);
      
    } catch (error) {
      console.error(`🔧 RetryExecutor: Error during queue processing:`, error);
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
          const result = await this.processSingleImage(job);

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
   * @param {Object} modifiedSettings - Modified processing settings (if not using original)
   * @param {boolean} includeMetadata - Whether to regenerate metadata
   * @returns {Promise<Object>} Processing result
   */
  async processSingleImage(job) {
    try {
      const { imageId, useOriginalSettings, modifiedSettings, includeMetadata } = job;
      this.currentImageId = imageId; // Track current image being processed
      
      console.log(`🔧 RetryExecutor: Starting to process image ${imageId}`);
      console.log(`🔧 RetryExecutor: useOriginalSettings: ${useOriginalSettings}`);
      console.log(`🔧 RetryExecutor: modifiedSettings:`, modifiedSettings ? Object.keys(modifiedSettings) : 'null');
      console.log(`🔧 RetryExecutor: includeMetadata: ${includeMetadata}`);
      
      // Get the image data from database
      const imageData = await this.generatedImage.getGeneratedImage(imageId);
      if (!imageData.success) {
        throw new Error(`Failed to get image data for ID ${imageId}`);
      }
      
      const image = imageData.image;
      
      // CRITICAL FIX: Use tempImagePath for retry operations, not finalImagePath
      // tempImagePath should point to the original unprocessed image in 'generated' folder
      let sourcePath;
      if (image.tempImagePath) {
        sourcePath = image.tempImagePath;
        console.log(`🔧 RetryExecutor: Using tempImagePath for retry: ${sourcePath}`);
      } else if (image.finalImagePath) {
        sourcePath = image.finalImagePath;
        console.log(`🔧 RetryExecutor: No tempImagePath, using finalImagePath: ${sourcePath}`);
      } else {
        throw new Error(`No image path found for image ${imageId}`);
      }
      
      // Resolve the source path
      sourcePath = path.resolve(sourcePath);
      console.log(`🔧 RetryExecutor: Resolved source path: ${sourcePath}`);
      
      // Check if source file exists
      try {
        await fs.access(sourcePath);
        console.log(`🔧 RetryExecutor: Source file found: ${sourcePath}`);
      } catch (error) {
        throw new Error(`Source file not accessible: ${sourcePath}`);
      }

      // Get processing settings and job configuration
      let processingSettings;
      let jobConfiguration = null;
      
      try {
        // ALWAYS get the original job configuration for path resolution
        // Both original and modified settings should use the same file paths
        jobConfiguration = await this.getOriginalJobConfiguration(image);
        console.log(`🔧 RetryExecutor: Retrieved job configuration for image ${imageId}`);
        console.log(`🔧 RetryExecutor: DEBUG - jobConfiguration structure:`, {
          hasSettings: !!jobConfiguration.settings,
          hasFilePaths: !!(jobConfiguration.settings && jobConfiguration.settings.filePaths),
          outputDirectory: jobConfiguration.settings?.filePaths?.outputDirectory || 'not set'
        });
      } catch (error) {
        console.error(`🔧 RetryExecutor: Error getting job configuration for image ${imageId}:`, error);
        // Use fallback configuration
        jobConfiguration = this.getFallbackConfiguration();
      }
      
      if (useOriginalSettings) {
        // Parse original processing settings from database
        processingSettings = await this.getOriginalProcessingSettings(image);
        console.log(`🔧 RetryExecutor: Using original settings keys:`, Object.keys(processingSettings));
      } else {
        // Use modified settings passed from frontend
        processingSettings = modifiedSettings;
        console.log(`🔧 RetryExecutor: Using modified settings keys:`, Object.keys(processingSettings));
      }

      // Update image status to processing
      await this.updateImageStatus(imageId, 'processing');

      // Run post-processing with correct paths
      const processingResult = await this.runPostProcessing(sourcePath, processingSettings, includeMetadata, jobConfiguration);
      
      if (processingResult.success) {
        // Processing successful
        await this.updateImageStatus(imageId, 'approved', 'Retry processing successful');
        console.log(`🔧 RetryExecutor: Image ${imageId} processed successfully:`, processingResult.message);
      } else {
        // Processing failed
        await this.updateImageStatus(imageId, 'failed_retry', processingResult.error);
        console.error(`🔧 RetryExecutor: Image ${imageId} processing failed:`, processingResult.error);
      }
      
      return processingResult;
      
    } catch (error) {
      console.error(`🔧 RetryExecutor: Error processing image ${imageId}:`, error);
      
      // Update image status to failed
      await this.updateImageStatus(imageId, 'failed_retry', error.message);
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.currentImageId = null; // Clear current image tracking
    }
  }

  /**
   * Get original job configuration including file paths
   * @param {Object} image - Image object from database
   * @returns {Promise<Object>} Original job configuration with corrected paths
   */
  async getOriginalJobConfiguration(image) {
    try {
      console.log(`🔧 RetryExecutor: Getting original job configuration for image ${image.id}, executionId: ${image.executionId}`);
      
      // Get the job execution to find the configuration ID
      const JobExecution = require('../database/models/JobExecution');
      const jobExecution = new JobExecution();
      // Ensure DB initialized to avoid races
      try { await jobExecution.init(); } catch (e) { console.warn('RetryExecutor: jobExecution.init failed (continuing):', e?.message || e); }
      try { if (this.jobConfig && this.jobConfig.init) { await this.jobConfig.init(); } } catch (e) { console.warn('RetryExecutor: jobConfig.init failed (continuing):', e?.message || e); }
      
      // First attempt to load execution
      let executionResult = await jobExecution.getJobExecution(image.executionId);
      if (!executionResult.success) {
        console.warn(`🔧 RetryExecutor: First attempt failed to get job execution ${image.executionId} for image ${image.id}. Retrying once...`);
        try { await this.delay(300); } catch {}
        executionResult = await jobExecution.getJobExecution(image.executionId);
      }
      if (!executionResult.success) {
        console.warn(`🔧 RetryExecutor: Failed to get job execution after retry. Falling back. executionId=${image.executionId}`);
        return this.getFallbackConfiguration();
      }
      
      const execution = executionResult.execution;
      if (!execution.configurationId) {
        console.warn(`🔧 RetryExecutor: No configuration ID found for execution ${image.executionId}, using fallback`);
        return this.getFallbackConfiguration();
      }
      
      // Get the original job configuration
      console.log(`🔧 RetryExecutor: Loading job configuration by ID: ${execution.configurationId}`);
      let configResult = await this.jobConfig.getConfigurationById(execution.configurationId);
      if (!configResult.success) {
        console.warn(`🔧 RetryExecutor: First attempt failed to load configuration ${execution.configurationId}. Retrying once...`);
        try { await this.delay(300); } catch {}
        configResult = await this.jobConfig.getConfigurationById(execution.configurationId);
      }
      if (!configResult.success) {
        console.warn(`🔧 RetryExecutor: Failed to load configuration after retry. Falling back. configurationId=${execution.configurationId}`);
        return this.getFallbackConfiguration();
      }
      
      const originalConfig = configResult.configuration;
      console.log(`🔧 RetryExecutor: Retrieved original job configuration for image ${image.id} (configurationId=${execution.configurationId})`);
      
      // Apply cross-platform path logic if original job didn't have custom paths
      const settings = originalConfig.settings || {};
      const filePaths = settings.filePaths || {};
      
      console.log(`🔧 RetryExecutor: DEBUG - Original filePaths:`, JSON.stringify(filePaths, null, 2));
      
      // Check if original job had custom paths set (not empty strings)
      const hasCustomOutputDir = filePaths.outputDirectory && filePaths.outputDirectory.trim() !== '';
      const hasCustomTempDir = filePaths.tempDirectory && filePaths.tempDirectory.trim() !== '';
      
      console.log(`🔧 RetryExecutor: DEBUG - hasCustomOutputDir: ${hasCustomOutputDir}, hasCustomTempDir: ${hasCustomTempDir}`);
      
      // Get current cross-platform defaults
      const defaultSettings = this.jobConfig.getDefaultSettings();
      const defaultFilePaths = defaultSettings.filePaths;
      
      // Use original custom paths if they exist, otherwise use current cross-platform defaults
      const correctedFilePaths = {
        outputDirectory: hasCustomOutputDir ? filePaths.outputDirectory : defaultFilePaths.outputDirectory,
        tempDirectory: hasCustomTempDir ? filePaths.tempDirectory : defaultFilePaths.tempDirectory,
        systemPromptFile: filePaths.systemPromptFile || '',
        keywordsFile: filePaths.keywordsFile || '',
        qualityCheckPromptFile: filePaths.qualityCheckPromptFile || '',
        metadataPromptFile: filePaths.metadataPromptFile || ''
      };
      
      console.log(`🔧 RetryExecutor: Original outputDirectory: ${filePaths.outputDirectory || 'not set'}`);
      console.log(`🔧 RetryExecutor: Original tempDirectory: ${filePaths.tempDirectory || 'not set'}`);
      console.log(`🔧 RetryExecutor: Corrected outputDirectory: ${correctedFilePaths.outputDirectory}`);
      console.log(`🔧 RetryExecutor: Corrected tempDirectory: ${correctedFilePaths.tempDirectory}`);
      
      return {
        ...originalConfig,
        settings: {
          ...settings,
          filePaths: correctedFilePaths
        }
      };
      
    } catch (error) {
      console.error(`🔧 RetryExecutor: Error getting original job configuration for image ${image?.id || 'unknown'}:`, error);
      return this.getFallbackConfiguration();
    }
  }

  getFallbackConfiguration() {
    console.log(`🔧 RetryExecutor: Using fallback configuration with cross-platform paths`);
    const defaultSettings = this.jobConfig.getDefaultSettings();
    return {
      id: 'fallback',
      name: 'Fallback Configuration',
      settings: defaultSettings,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get original processing settings for an image
   * @param {Object} image - Image object from database
   * @returns {Object} Original processing settings
   */
  async getOriginalProcessingSettings(image) {
    try {
      // Get the actual image data from the database
      // const image = await this.generatedImage.getGeneratedImage(imageId); // This line is now redundant
      
      if (!image) {
        throw new Error(`Image data not provided for processing settings`);
      }
      
      // Parse the processing settings from the database
      let originalSettings = {};
      if (image.processingSettings) {
        try {
          originalSettings = JSON.parse(image.processingSettings);
          console.log(`🔧 RetryExecutor: Retrieved original processing settings keys for image:`, Object.keys(originalSettings));
        } catch (parseError) {
          console.warn(`🔧 RetryExecutor: Failed to parse processing settings for image, using defaults:`, parseError);
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
      console.error(`🔧 RetryExecutor: Error getting original processing settings for image:`, error);
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
   * @param {Object} jobConfiguration - Original job configuration (optional)
   * @returns {Promise<Object>} Processing result
   */
  async runPostProcessing(sourcePath, settings, includeMetadata, jobConfiguration = null) {
    try {
      console.log(`🔧 RetryExecutor: Starting real image processing for: ${sourcePath}`);
      console.log(`🔧 RetryExecutor: Processing settings keys:`, Object.keys(settings)); // Sanitized
      console.log(`🔧 RetryExecutor: Include metadata: ${includeMetadata}`);
      
      // Verify source file exists
      try {
        await fs.access(sourcePath);
        console.log(`🔧 RetryExecutor: Source file verified: ${sourcePath}`);
      } catch (error) {
        throw new Error(`Source file not accessible: ${sourcePath}`);
      }
      
      // Get the directory and filename for the source
      const sourceDir = path.dirname(sourcePath);
      const sourceFileName = path.basename(sourcePath, path.extname(sourcePath));
      const sourceExt = path.extname(sourcePath);
      
      console.log(`🔧 RetryExecutor: Source directory: ${sourceDir}`);
      console.log(`🔧 RetryExecutor: Source filename: ${sourceFileName}`);
      console.log(`🔧 RetryExecutor: Source extension: ${sourceExt}`);
      
      // CRITICAL: Keep original in place, process it there
      // The sourcePath should be in the 'generated' folder, we'll process it there
      console.log(`🔧 RetryExecutor: Processing original file in place: ${sourcePath}`);
      
      // Prepare config object for processImage function
      // Use a temporary directory for processing, then move to final destination
      // Use cross-platform temp directory
      let tempProcessingDir;
      try {
        const { app } = require('electron');
        const desktopPath = app.getPath('desktop');
        tempProcessingDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing');
      } catch (error) {
        const os = require('os');
        const homeDir = os.homedir();
        tempProcessingDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'temp_processing');
      }
      
      // Ensure temp directory exists
      try {
        await fs.mkdir(tempProcessingDir, { recursive: true });
      } catch (error) {
        console.warn(`🔧 RetryExecutor: Temp directory creation failed:`, error.message);
      }
      
      // Create sanitized config without API keys
      const { apiKeys, ...sanitizedSettings } = settings;
      
      // IMPORTANT: Always process into a temporary directory first
      // Final move to original job's outputDirectory happens after processing
      const processOutputDir = tempProcessingDir;
      console.log(`🔧 RetryExecutor: Using TEMP directory for processImage: ${processOutputDir}`);
      
      const processingConfig = {
        tempDirectory: tempProcessingDir,
        outputDirectory: processOutputDir,
        ...sanitizedSettings
      };

      // Normalize/clamp processing fields to expected ranges
      try {
        const { normalizeProcessingSettings } = require('../utils/processing');
        const normalized = normalizeProcessingSettings(processingConfig);
        Object.assign(processingConfig, normalized);
      } catch (e) {
        // Non-fatal if normalizer not available
      }
      
      // Process the image using the real processing pipeline
      console.log(`🔧 RetryExecutor: Calling processImage with config keys:`, Object.keys(processingConfig)); // Sanitized
      const processedImagePath = await processImage(sourcePath, sourceFileName, processingConfig);
      console.log(`🔧 RetryExecutor: Image processing completed: ${processedImagePath}`);
      
      // Determine the final destination path (Toupload folder)
      // Use job configuration paths if available, otherwise use constructor defaults
      console.log(`🔧 RetryExecutor: DEBUG - jobConfiguration exists: ${!!jobConfiguration}`);
      console.log(`🔧 RetryExecutor: DEBUG - jobConfiguration.settings exists: ${!!(jobConfiguration && jobConfiguration.settings)}`);
      console.log(`🔧 RetryExecutor: DEBUG - jobConfiguration.settings.filePaths exists: ${!!(jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths)}`);
      
      let outputDirectory;
      if (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths) {
        outputDirectory = jobConfiguration.settings.filePaths.outputDirectory;
        console.log(`🔧 RetryExecutor: Using original job outputDirectory: ${outputDirectory}`);
      } else {
        outputDirectory = this.outputDirectory;
        console.log(`🔧 RetryExecutor: Using default outputDirectory: ${outputDirectory}`);
      }
      
      console.log(`🔧 RetryExecutor: DEBUG - Final outputDirectory for move: ${outputDirectory}`);
      
      let finalOutputPath;
      let finalExtension;
      
      if (settings.convertToJpg && settings.imageConvert) {
        // Converting to JPG
        finalExtension = '.jpg';
        // Final path should be in the configured output directory
        finalOutputPath = path.join(outputDirectory, `${sourceFileName}.jpg`);
        console.log(`🔧 RetryExecutor: Converting to JPG, final path: ${finalOutputPath}`);
      } else {
        // Keeping original format
        finalExtension = path.extname(processedImagePath);
        // Final path should be in the configured output directory
        finalOutputPath = path.join(outputDirectory, `${sourceFileName}${finalExtension}`);
        console.log(`🔧 RetryExecutor: Keeping format, final path: ${finalOutputPath}`);
      }
      
      // Ensure the temporary processing directory exists
      try {
        await fs.mkdir(tempProcessingDir, { recursive: true });
        console.log(`🔧 RetryExecutor: Created temporary processing directory: ${tempProcessingDir}`);
      } catch (error) {
        console.warn(`🔧 RetryExecutor: Temporary processing directory creation failed:`, error.message);
      }
      
      // Ensure the final output directory exists
      try {
        await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
        console.log(`🔧 RetryExecutor: Created final output directory: ${path.dirname(finalOutputPath)}`);
      } catch (error) {
        console.warn(`🔧 RetryExecutor: Final output directory creation failed:`, error.message);
      }
      
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
          
          // Determine metadata prompt: prefer original job config file, else settings.filePaths.metadataPromptFile, else null
          let metadataPrompt = null;
          try {
            // Try to read from jobConfiguration first
            const filePaths = (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths) ? jobConfiguration.settings.filePaths : (settings && settings.filePaths ? settings.filePaths : {});
            if (filePaths && filePaths.metadataPromptFile) {
              try {
                const fsProm = require('fs').promises;
                metadataPrompt = await fsProm.readFile(filePaths.metadataPromptFile, 'utf8');
              } catch (e) {
                console.warn('RetryExecutor: Failed to read metadataPromptFile, using default prompt');
              }
            }
          } catch (e) {
            // ignore
          }

          metadataResult = await aiVision.generateMetadata(
            processedImagePath,
            originalPrompt,
            (metadataPrompt && metadataPrompt.trim() !== '') ? metadataPrompt : null,
            'gpt-4o-mini' // Default model
          );
          console.log(`🔧 RetryExecutor: Metadata generation completed:`, metadataResult);
        } catch (metadataError) {
          console.warn(`🔧 RetryExecutor: Metadata generation failed, continuing without metadata:`, metadataError);
        }
      }
      
      // CRITICAL: Move the processed image to final destination (Toupload folder)
      console.log(`🔧 RetryExecutor: Moving processed image to final destination: ${finalOutputPath}`);
      
      // If final destination already exists, delete it first
      try {
        await fs.access(finalOutputPath);
        console.log(`🔧 RetryExecutor: Final destination exists, deleting old file: ${finalOutputPath}`);
        await fs.unlink(finalOutputPath);
      } catch (error) {
        // File doesn't exist, which is fine
        console.log(`🔧 RetryExecutor: Final destination doesn't exist yet, proceeding with move`);
      }
      
      // Move the processed image to final destination
      await fs.rename(processedImagePath, finalOutputPath);
      console.log(`🔧 RetryExecutor: Successfully moved processed image to: ${finalOutputPath}`);
      
      // CRITICAL: Now delete the original source file from generated folder
      try {
        console.log(`🔧 RetryExecutor: Deleting original source file: ${sourcePath}`);
        await fs.unlink(sourcePath);
        console.log(`🔧 RetryExecutor: Original source file deleted successfully`);
      } catch (cleanupError) {
        console.warn(`🔧 RetryExecutor: Failed to delete original source file:`, cleanupError.message);
        // Don't throw error here, as the main processing was successful
      }
      
      // Update the database with the NEW image path and persist metadata if present
      if (this.currentImageId) {
        try {
          console.log(`🔧 RetryExecutor: Updating database with new image path: ${finalOutputPath}`);
          
          // Get the existing image data to preserve all required fields
          const existingImageData = await this.generatedImage.getGeneratedImage(this.currentImageId);
          if (!existingImageData.success || !existingImageData.image) {
            throw new Error(`Failed to get existing image data for update`);
          }
          
          const existingImage = existingImageData.image;
          
          // Create update object with all required fields preserved
          const updateData = {
            executionId: existingImage.executionId,
            generationPrompt: existingImage.generationPrompt,
            seed: existingImage.seed,
            qcStatus: 'approved', // Update status to approved since processing succeeded
            qcReason: 'Retry processing successful',
            finalImagePath: finalOutputPath, // Update with new path
            metadata: (() => {
              if (!metadataResult) return existingImage.metadata;
              const tags = metadataResult.uploadTags || metadataResult.tags || metadataResult.upload_tags || null;
              const merged = {
                ...(existingImage.metadata || {}),
                title: metadataResult.new_title || (existingImage.metadata ? existingImage.metadata.title : undefined),
                description: metadataResult.new_description || (existingImage.metadata ? existingImage.metadata.description : undefined),
                tags: tags || (existingImage.metadata ? existingImage.metadata.tags : undefined)
              };
              return merged;
            })(),
            processingSettings: existingImage.processingSettings
          };
          
          console.log(`🔧 RetryExecutor: Updating image with all required fields preserved`);
          await this.generatedImage.updateGeneratedImage(this.currentImageId, updateData);
          // Additionally ensure metadata-only update if paths didn’t change (safety)
          if (metadataResult) {
            try {
              const tags = metadataResult.uploadTags || metadataResult.tags || metadataResult.upload_tags || null;
              await this.generatedImage.updateMetadataById(this.currentImageId, {
                title: metadataResult.new_title,
                description: metadataResult.new_description,
                tags
              });
              console.log('🔧 RetryExecutor: Persisted regenerated metadata');
            } catch (e) {
              console.warn('🔧 RetryExecutor: Metadata persistence (byId) failed:', e.message);
            }
          }
          console.log(`🔧 RetryExecutor: Database updated successfully`);
        } catch (dbError) {
          console.error(`🔧 RetryExecutor: Failed to update database with new path:`, dbError);
          throw new Error(`Database update failed: ${dbError.message}`);
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
        metadata: metadataResult,
        originalPath: sourcePath,
        newPath: finalOutputPath
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
      queueLength: this.queue.length,
      pendingJobs: this.queue.filter(job => job.status === 'pending').length,
      processingJobs: this.queue.filter(job => job.status === 'processing').length,
      completedJobs: this.queue.filter(job => job.status === 'completed').length,
      failedJobs: this.queue.filter(job => job.status === 'failed').length
    };
  }

  /**
   * Clear completed jobs from queue
   */
  clearCompletedJobs() {
    this.queue = this.queue.filter(job => job.status !== 'completed');
    
    // Emit queue update event
    this.emit('queue-updated', {
      queueLength: this.queue.length
    });
  }

  /**
   * Stop processing and clear queue
   */
  stop() {
    this.isProcessing = false;
    this.queue = [];
    
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
