const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { processImage } = require(path.join(__dirname, '../producePictureModule'));
const aiVision = require(path.join(__dirname, '../aiVision'));
const { JobConfiguration } = require(path.join(__dirname, '../database/models/JobConfiguration'));
const { RetryQueueService } = require(path.join(__dirname, 'RetryQueueService'));
const { RetryProcessorService } = require(path.join(__dirname, 'RetryProcessorService'));
const RetryConfigService = require(path.join(__dirname, 'RetryConfigService'));
const { run: runPostProcessingService } = require(path.join(__dirname, 'RetryPostProcessingService'));

/**
 * RetryExecutor - Handles post-processing retry for failed images
 *
 * Phase 3 (ADR-012): Thin orchestrator. Excluding legacy method bodies, the orchestrator is
 * constructor (lines 22-68), _useModular* (71-76), bridge methods: addBatchRetryJob (84-93),
 * processQueue (174-184), processSingleImage (406-415), getQueueStatus (1188-1196),
 * clearCompletedJobs (1218-1226), stop (1243-1252). Total < 200 lines. All queue logic
 * routes to RetryQueueService when FEATURE_MODULAR_RETRY_QUEUE; all single-image processing
 * routes to RetryProcessorService when FEATURE_MODULAR_RETRY_PROCESSOR.
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
      console.warn(' RetryExecutor: No generatedImage model provided, database operations may fail');
    }

    this.retryQueueService = new RetryQueueService({
      processOneJob: (job) => this.processSingleImage(job),
      emit: (ev, payload) => this.emit(ev, payload)
    });

    this.retryProcessorService = new RetryProcessorService({
      getImage: (imageId) => this.generatedImage.getGeneratedImage(imageId),
      updateImageStatus: (imageId, status, reason) => this.updateImageStatus(imageId, status, reason),
      getOriginalJobConfiguration: (image) => this.getOriginalJobConfiguration(image),
      getFallbackConfiguration: () => this.getFallbackConfiguration(),
      getOriginalProcessingSettings: (image) => this.getOriginalProcessingSettings(image),
      runPostProcessing: (sourcePath, settings, includeMetadata, jobConfig, useOriginalSettings, failOptions) =>
        this.runPostProcessing(sourcePath, settings, includeMetadata, jobConfig, useOriginalSettings, failOptions),
      emit: (ev, payload) => this.emit(ev, payload),
      setCurrentImageId: (id) => { this.currentImageId = id; }
    });
  }

  _useModularRetryQueue() {
    return process.env.FEATURE_MODULAR_RETRY_QUEUE === 'true';
  }

  _useModularRetryProcessor() {
    return process.env.FEATURE_MODULAR_RETRY_PROCESSOR === 'true';
  }

  _useModularRetryConfig() {
    return process.env.FEATURE_MODULAR_RETRY_CONFIG === 'true';
  }

  _useModularRetryPostProcessing() {
    return process.env.FEATURE_MODULAR_RETRY_POST_PROCESSING === 'true';
  }

  /**
   * Add a batch retry job to the queue (bridge: routes to RetryQueueService when FEATURE_MODULAR_RETRY_QUEUE)
   * @param {Object} batchRetryJob - Batch retry job object
   * @returns {Promise<Object>} Queued job result
   */
  async addBatchRetryJob(batchRetryJob) {
    if (this._useModularRetryQueue()) {
      try {
        return await this.retryQueueService.addBatchRetryJob(batchRetryJob);
      } catch (error) {
        console.warn(' RetryExecutor: RetryQueueService failed, falling back to legacy:', error?.message || error);
        return this._legacyAddBatchRetryJob(batchRetryJob);
      }
    }
    return this._legacyAddBatchRetryJob(batchRetryJob);
  }

  /**
   * Legacy: Add a batch retry job to the queue
   * @param {Object} batchRetryJob - Batch retry job object
   * @returns {Promise<Object>} Queued job result
   */
  async _legacyAddBatchRetryJob(batchRetryJob) {
    try {
      console.log(` RetryExecutor: addBatchRetryJob called with job type: ${batchRetryJob.type}`);
      
      const { imageIds, useOriginalSettings, modifiedSettings, includeMetadata, failOptions } = batchRetryJob;
      
      console.log(` RetryExecutor: Processing batch retry job:`);
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
        failOptions: {
          enabled: !!(failOptions && failOptions.enabled),
          steps: Array.isArray(failOptions?.steps) ? failOptions.steps : []
        },
        status: 'pending',
        createdAt: new Date()
      }));

      console.log(` RetryExecutor: Created ${retryJobs.length} individual retry jobs`);

      // Add all jobs to the queue
      this.queue.push(...retryJobs);
    
    // Emit queue update event
    this.emit('queue-updated', {
        queueLength: this.queue.length,
        addedJobs: retryJobs.length,
        timestamp: new Date(),
        context: 'retry'
      });

      console.log(` RetryExecutor: Added ${retryJobs.length} jobs to queue. Queue length: ${this.queue.length}`);

      // Start processing if not already running (legacy path only)
      if (!this.isProcessing) {
        console.log(` RetryExecutor: Starting processing queue`);
        this._legacyProcessQueue();
      }

      return {
        success: true,
        jobId: batchRetryJob.id || `batch_${Date.now()}`,
        queuedJobs: retryJobs.length,
        queueLength: this.queue.length,
        message: `Successfully queued ${retryJobs.length} retry jobs`
      };

    } catch (error) {
      console.error(` RetryExecutor: Error adding batch retry job:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process the retry queue (bridge: routes to RetryQueueService when FEATURE_MODULAR_RETRY_QUEUE)
   */
  async processQueue() {
    if (this._useModularRetryQueue()) {
      try {
        return await this.retryQueueService.startProcessing();
      } catch (error) {
        console.warn(' RetryExecutor: RetryQueueService.startProcessing failed, falling back to legacy:', error?.message || error);
        return this._legacyProcessQueue();
      }
    }
    return this._legacyProcessQueue();
  }

  /**
   * Legacy: Process the retry queue
   */
  async _legacyProcessQueue() {
    if (this.isProcessing) {
      console.log(` RetryExecutor: Already processing, skipping`);
      return;
    }

    this.isProcessing = true;
    console.log(` RetryExecutor: Starting to process queue. Queue length: ${this.queue.length}`);

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        console.log(` RetryExecutor: Processing job with keys:`, Object.keys(job));
        
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

          console.log(` RetryExecutor: Job ${job.id} completed with result keys:`, Object.keys(result));

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
          console.error(` RetryExecutor: Error processing job ${job.id}:`, error);
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

      console.log(` RetryExecutor: Queue processing completed`);
      
    } catch (error) {
      console.error(` RetryExecutor: Error during queue processing:`, error);
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
   * Process a single image for retry (bridge: routes to RetryProcessorService when FEATURE_MODULAR_RETRY_PROCESSOR)
   * @param {Object} job - { imageId, useOriginalSettings, modifiedSettings, includeMetadata, failOptions }
   * @returns {Promise<Object>} Processing result
   */
  async processSingleImage(job) {
    if (this._useModularRetryProcessor()) {
      try {
        return await this.retryProcessorService.processImage(job);
      } catch (error) {
        console.warn(' RetryExecutor: RetryProcessorService failed, falling back to legacy:', error?.message || error);
        return this._legacyProcessSingleImage(job);
      }
    }
    return this._legacyProcessSingleImage(job);
  }

  /**
   * Legacy: Process a single image for retry
   * @param {Object} job - { imageId, useOriginalSettings, modifiedSettings, includeMetadata, failOptions }
   * @returns {Promise<Object>} Processing result
   */
  async _legacyProcessSingleImage(job) {
    let imageId;
    try {
      const { imageId: _imageId, useOriginalSettings, modifiedSettings, includeMetadata, failOptions } = job;
      imageId = _imageId;
      this.currentImageId = imageId; // Track current image being processed
      
      console.log(` RetryExecutor: Starting to process image ${imageId}`);
      console.log(` RetryExecutor: useOriginalSettings: ${useOriginalSettings}`);
      console.log(` RetryExecutor: modifiedSettings:`, modifiedSettings ? Object.keys(modifiedSettings) : 'null');
      console.log(` RetryExecutor: includeMetadata: ${includeMetadata}`);
      
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
        console.log(` RetryExecutor: Using tempImagePath for retry: ${sourcePath}`);
      } else if (image.finalImagePath) {
        sourcePath = image.finalImagePath;
        console.log(` RetryExecutor: No tempImagePath, using finalImagePath: ${sourcePath}`);
      } else {
        throw new Error(`No image path found for image ${imageId}`);
      }
      
      // Resolve the source path
      sourcePath = path.resolve(sourcePath);
      console.log(` RetryExecutor: Resolved source path: ${sourcePath}`);
      
      // Check if source file exists
      try {
        await fs.access(sourcePath);
        console.log(` RetryExecutor: Source file found: ${sourcePath}`);
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
        console.log(` RetryExecutor: Retrieved job configuration for image ${imageId}`);
        console.log(` RetryExecutor: DEBUG - jobConfiguration structure:`, {
          hasSettings: !!jobConfiguration.settings,
          hasFilePaths: !!(jobConfiguration.settings && jobConfiguration.settings.filePaths),
          outputDirectory: jobConfiguration.settings?.filePaths?.outputDirectory || 'not set'
        });
      } catch (error) {
        console.error(` RetryExecutor: Error getting job configuration for image ${imageId}:`, error);
        // Use fallback configuration
        jobConfiguration = this.getFallbackConfiguration();
      }
      
      if (useOriginalSettings) {
        // Parse original processing settings from database
        processingSettings = await this.getOriginalProcessingSettings(image);
        console.log(` RetryExecutor: Using original settings keys:`, Object.keys(processingSettings));
      } else {
        // Use modified settings passed from frontend
        processingSettings = modifiedSettings;
        console.log(` RetryExecutor: Using modified settings keys:`, Object.keys(processingSettings));
      }

      // Ensure provider credentials are present for retry processing (e.g., remove.bg)
      try {
        const rbKey = jobConfiguration?.settings?.apiKeys?.removeBg;
        if (rbKey && String(rbKey).trim() !== '') {
          process.env.REMOVE_BG_API_KEY = String(rbKey);
          console.log(' RetryExecutor: remove.bg credentials initialized for retry');
        }
      } catch (e) {
        // non-fatal
      }

      // Update image status to processing
      await this.updateImageStatus(imageId, 'processing');

      // Run post-processing with correct paths
      const processingResult = await this.runPostProcessing(sourcePath, processingSettings, includeMetadata, jobConfiguration, useOriginalSettings, failOptions);
      
      if (processingResult.success) {
        // Processing successful
        await this.updateImageStatus(imageId, 'approved', 'Retry processing successful');
        console.log(` RetryExecutor: Image ${imageId} processed successfully:`, processingResult.message);
      } else {
        // Processing failed
        // Prefer structured qcReason when provided; fallback to error string
        const failReason = (processingResult && processingResult.qcReason)
          ? String(processingResult.qcReason)
          : String(processingResult.error || 'processing_failed:qc');
        await this.updateImageStatus(imageId, 'retry_failed', failReason);
        console.error(` RetryExecutor: Image ${imageId} processing failed:`, processingResult.error);
      }
      
      return processingResult;
      
    } catch (error) {
      console.error(` RetryExecutor: Error processing image ${imageId}:`, error);
      
      // Update image status to failed
      try {
        const stage = String((error && error.stage) || '').toLowerCase();
        let qcReason = 'processing_failed:qc';
        if (stage === 'remove_bg') qcReason = 'processing_failed:remove_bg';
        else if (stage === 'trim') qcReason = 'processing_failed:trim';
        else if (stage === 'enhancement') qcReason = 'processing_failed:enhancement';
        else if (stage === 'metadata') qcReason = 'processing_failed:metadata';
        else if (stage === 'convert') qcReason = 'processing_failed:convert';
        else if (stage === 'save_final') qcReason = 'processing_failed:save_final';
        await this.updateImageStatus(imageId, 'retry_failed', qcReason);
      } catch {
        await this.updateImageStatus(imageId, 'retry_failed', 'processing_failed:qc');
      }
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.currentImageId = null; // Clear current image tracking
    }
  }

  /**
   * Get original job configuration (bridge: routes to RetryConfigService when FEATURE_MODULAR_RETRY_CONFIG)
   */
  async getOriginalJobConfiguration(image) {
    if (this._useModularRetryConfig()) {
      try {
        return await RetryConfigService.getOriginalJobConfiguration(this, image);
      } catch (error) {
        console.warn(' RetryExecutor: RetryConfigService.getOriginalJobConfiguration failed, falling back to legacy:', error?.message || error);
        return this._legacyGetOriginalJobConfiguration(image);
      }
    }
    return this._legacyGetOriginalJobConfiguration(image);
  }

  /**
   * Legacy: Get original job configuration including file paths
   */
  async _legacyGetOriginalJobConfiguration(image) {
    try {
      console.log(` RetryExecutor: Getting original job configuration for image ${image.id}, executionId: ${image.executionId}`);
      const { JobExecution } = require('../database/models/JobExecution');
      const jobExecution = new JobExecution();
      try { await jobExecution.init(); } catch (e) { console.warn('RetryExecutor: jobExecution.init failed (continuing):', e?.message || e); }
      try { if (this.jobConfig && this.jobConfig.init) { await this.jobConfig.init(); } } catch (e) { console.warn('RetryExecutor: jobConfig.init failed (continuing):', e?.message || e); }

      let executionResult = await jobExecution.getJobExecution(image.executionId);
      if (!executionResult.success) {
        try { await this.delay(300); } catch {}
        executionResult = await jobExecution.getJobExecution(image.executionId);
      }
      if (!executionResult.success) {
        return this._legacyGetFallbackConfiguration();
      }

      const execution = executionResult.execution;
      if (!execution.configurationId) {
        return this._legacyGetFallbackConfiguration();
      }

      let configResult = await this.jobConfig.getConfigurationById(execution.configurationId);
      if (!configResult.success) {
        try { await this.delay(300); } catch {}
        configResult = await this.jobConfig.getConfigurationById(execution.configurationId);
      }
      if (!configResult.success) {
        return this._legacyGetFallbackConfiguration();
      }
      
      const originalConfig = configResult.configuration;
      console.log(` RetryExecutor: Retrieved original job configuration for image ${image.id} (configurationId=${execution.configurationId})`);
      
      // Apply cross-platform path logic if original job didn't have custom paths
      const settings = originalConfig.settings || {};
      const filePaths = settings.filePaths || {};
      
      console.log(` RetryExecutor: DEBUG - Original filePaths:`, JSON.stringify(filePaths, null, 2));
      
      // Check if original job had custom paths set (not empty strings)
      const hasCustomOutputDir = filePaths.outputDirectory && filePaths.outputDirectory.trim() !== '';
      const hasCustomTempDir = filePaths.tempDirectory && filePaths.tempDirectory.trim() !== '';
      
      console.log(` RetryExecutor: DEBUG - hasCustomOutputDir: ${hasCustomOutputDir}, hasCustomTempDir: ${hasCustomTempDir}`);
      
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
      
      console.log(` RetryExecutor: Original outputDirectory: ${filePaths.outputDirectory || 'not set'}`);
      console.log(` RetryExecutor: Original tempDirectory: ${filePaths.tempDirectory || 'not set'}`);
      console.log(` RetryExecutor: Corrected outputDirectory: ${correctedFilePaths.outputDirectory}`);
      console.log(` RetryExecutor: Corrected tempDirectory: ${correctedFilePaths.tempDirectory}`);
      
      return {
        ...originalConfig,
        settings: {
          ...settings,
          filePaths: correctedFilePaths
        }
      };
      
    } catch (error) {
      console.error(` RetryExecutor: Error getting original job configuration for image ${image?.id || 'unknown'}:`, error);
      return this._legacyGetFallbackConfiguration();
    }
  }

  /**
   * Get fallback configuration (bridge: routes to RetryConfigService when FEATURE_MODULAR_RETRY_CONFIG)
   */
  getFallbackConfiguration() {
    if (this._useModularRetryConfig()) {
      try {
        return RetryConfigService.getFallbackConfiguration(this);
      } catch (error) {
        console.warn(' RetryExecutor: RetryConfigService.getFallbackConfiguration failed, falling back to legacy:', error?.message || error);
        return this._legacyGetFallbackConfiguration();
      }
    }
    return this._legacyGetFallbackConfiguration();
  }

  /**
   * Legacy: Get fallback configuration
   */
  _legacyGetFallbackConfiguration() {
    console.log(` RetryExecutor: Using fallback configuration with cross-platform paths`);
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
   * Get original processing settings (bridge: routes to RetryConfigService when FEATURE_MODULAR_RETRY_CONFIG)
   */
  async getOriginalProcessingSettings(image) {
    if (this._useModularRetryConfig()) {
      try {
        return await RetryConfigService.getOriginalProcessingSettings(this, image);
      } catch (error) {
        console.warn(' RetryExecutor: RetryConfigService.getOriginalProcessingSettings failed, falling back to legacy:', error?.message || error);
        return this._legacyGetOriginalProcessingSettings(image);
      }
    }
    return this._legacyGetOriginalProcessingSettings(image);
  }

  /**
   * Legacy: Get original processing settings for an image
   */
  async _legacyGetOriginalProcessingSettings(image) {
    try {
      if (!image) {
        throw new Error(`Image data not provided for processing settings`);
      }
      
      // Parse the processing settings from the database
      let originalSettings = {};
      if (image.processingSettings) {
        try {
          originalSettings = JSON.parse(image.processingSettings);
          console.log(` RetryExecutor: Retrieved original processing settings keys for image:`, Object.keys(originalSettings));
        } catch (parseError) {
          console.warn(` RetryExecutor: Failed to parse processing settings for image, using defaults:`, parseError);
        }
      }
      
      // Return original settings with defaults as fallback
      return {
        imageEnhancement: originalSettings.imageEnhancement || false,
        sharpening: originalSettings.sharpening || 0,
        saturation: originalSettings.saturation || 1.0,
        imageConvert: originalSettings.imageConvert || false,
        convertToJpg: originalSettings.convertToJpg || false,
        convertToWebp: originalSettings.convertToWebp || false,
        jpgQuality: originalSettings.jpgQuality || 100,
        pngQuality: originalSettings.pngQuality || 100,
        webpQuality: originalSettings.webpQuality || 85,
        removeBg: originalSettings.removeBg || false,
        removeBgSize: originalSettings.removeBgSize || 'auto',
        trimTransparentBackground: originalSettings.trimTransparentBackground || false,
        jpgBackground: originalSettings.jpgBackground || 'white'
      };
    } catch (error) {
      console.error(` RetryExecutor: Error getting original processing settings for image:`, error);
      // Return safe defaults if we can't get original settings
    return {
      imageEnhancement: false,
        sharpening: 0,
        saturation: 1.0,
      imageConvert: false,
        convertToJpg: false,
        convertToWebp: false,
        jpgQuality: 100,
        pngQuality: 100,
        webpQuality: 85,
      removeBg: false,
      removeBgSize: 'auto',
      trimTransparentBackground: false,
        jpgBackground: 'white'
    };
    }
  }

  /**
   * Update image status (bridge: routes to RetryConfigService when FEATURE_MODULAR_RETRY_CONFIG)
   */
  async updateImageStatus(imageId, status, reason = '') {
    if (this._useModularRetryConfig()) {
      try {
        await RetryConfigService.updateImageStatus(this, imageId, status, reason);
        return;
      } catch (error) {
        console.warn(' RetryExecutor: RetryConfigService.updateImageStatus failed, falling back to legacy:', error?.message || error);
        return this._legacyUpdateImageStatus(imageId, status, reason);
      }
    }
    return this._legacyUpdateImageStatus(imageId, status, reason);
  }

  /**
   * Legacy: Update image status in database
   */
  async _legacyUpdateImageStatus(imageId, status, reason = '') {
    try {
      if (this.generatedImage && typeof this.generatedImage.updateQCStatus === 'function') {
        await this.generatedImage.updateQCStatus(imageId, status, reason);
        console.log(` RetryExecutor: Updated image ${imageId} status to ${status} in database`);
      } else {
        console.warn(` RetryExecutor: Cannot update database - generatedImage model not available`);
      }
    } catch (error) {
      console.error(` RetryExecutor: Failed to update database status for image ${imageId}:`, error);
    }
    this.emit('image-status-updated', {
      imageId,
      status,
      reason,
      timestamp: new Date(),
      context: 'retry'
    });
  }

  /**
   * Run post-processing (bridge: routes to RetryPostProcessingService when FEATURE_MODULAR_RETRY_POST_PROCESSING)
   */
  async runPostProcessing(sourcePath, settings, includeMetadata, jobConfiguration = null, useOriginalSettings = false, failOptions = { enabled: false, steps: [] }) {
    if (this._useModularRetryPostProcessing()) {
      try {
        return await runPostProcessingService(this, sourcePath, settings, includeMetadata, jobConfiguration, useOriginalSettings, failOptions);
      } catch (error) {
        console.warn(' RetryExecutor: RetryPostProcessingService.run failed, falling back to legacy:', error?.message || error);
        return this._legacyRunPostProcessing(sourcePath, settings, includeMetadata, jobConfiguration, useOriginalSettings, failOptions);
      }
    }
    return this._legacyRunPostProcessing(sourcePath, settings, includeMetadata, jobConfiguration, useOriginalSettings, failOptions);
  }

  /**
   * Legacy: Run post-processing on an image using the real processing pipeline
   */
  async _legacyRunPostProcessing(sourcePath, settings, includeMetadata, jobConfiguration = null, useOriginalSettings = false, failOptions = { enabled: false, steps: [] }) {
    try {
      console.log(` RetryExecutor: Starting real image processing for: ${sourcePath}`);
      console.log(` RetryExecutor: Processing settings keys:`, Object.keys(settings)); // Sanitized
      console.log(` RetryExecutor: Include metadata: ${includeMetadata}`);
      
      // Verify source file exists
      try {
        await fs.access(sourcePath);
        console.log(` RetryExecutor: Source file verified: ${sourcePath}`);
      } catch (error) {
        throw new Error(`Source file not accessible: ${sourcePath}`);
      }
      
      // Get the directory and filename for the source
      const sourceDir = path.dirname(sourcePath);
      const sourceFileName = path.basename(sourcePath, path.extname(sourcePath));
      const sourceExt = path.extname(sourcePath);
      
      console.log(` RetryExecutor: Source directory: ${sourceDir}`);
      console.log(` RetryExecutor: Source filename: ${sourceFileName}`);
      console.log(` RetryExecutor: Source extension: ${sourceExt}`);
      
      // CRITICAL: Keep original in place, process it there
      // The sourcePath should be in the 'generated' folder, we'll process it there
      console.log(` RetryExecutor: Processing original file in place: ${sourcePath}`);
      
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
        console.warn(` RetryExecutor: Temp directory creation failed:`, error.message);
      }
      
      // Create sanitized config without API keys
      const { apiKeys, ...sanitizedSettings } = settings;
      
      // IMPORTANT: Always process into a temporary directory first
      // Final move to original job's outputDirectory happens after processing
      const processOutputDir = tempProcessingDir;
      console.log(` RetryExecutor: Using TEMP directory for processImage: ${processOutputDir}`);
      
      const processingConfig = {
        tempDirectory: tempProcessingDir,
        outputDirectory: processOutputDir,
        ...sanitizedSettings,
        // Preserve the original source file during retry; cleanup is handled below with guards
        preserveInput: true,
        failRetryEnabled: !!(failOptions && failOptions.enabled),
        failOnSteps: Array.isArray(failOptions?.steps) ? failOptions.steps : []
      };

      // Normalize/clamp processing fields to expected ranges
      try {
        const { normalizeProcessingSettings } = require('../utils/processing');
        const normalized = normalizeProcessingSettings(processingConfig);
        Object.assign(processingConfig, normalized);
      } catch (e) {
        // Non-fatal if normalizer not available
      }
      
      // Debug: print effective background-processing flags before processing
      try {
        console.log(' RetryExecutor: EFFECTIVE processingConfig (bg/trim/convert):', {
          removeBg: !!processingConfig.removeBg,
          removeBgSize: processingConfig.removeBgSize,
          trimTransparentBackground: !!processingConfig.trimTransparentBackground,
          imageConvert: !!processingConfig.imageConvert,
          convertToJpg: !!processingConfig.convertToJpg,
          convertToWebp: !!processingConfig.convertToWebp
        });
      } catch {}
      
      // Process the image using the real processing pipeline
      console.log(` RetryExecutor: Calling processImage with config keys:`, Object.keys(processingConfig)); // Sanitized
      let processedImagePath;
      try {
        processedImagePath = await processImage(sourcePath, sourceFileName, processingConfig);
      } catch (procErr) {
        const stage = String((procErr && procErr.stage) || '').toLowerCase();
        const enabled = !!(failOptions && failOptions.enabled);
        const steps = Array.isArray(failOptions?.steps) ? failOptions.steps.map(s => String(s).toLowerCase()) : [];
        if (stage === 'convert') {
          if (enabled && steps.includes('convert')) {
            throw procErr;
          } else {
            console.warn(' RetryExecutor: Convert/Save failed but not selected to hard-fail. Falling back to original source.');
            processedImagePath = sourcePath;
          }
        } else if (stage === 'trim') {
          if (enabled && steps.includes('trim')) {
            throw procErr;
          } else {
            console.warn(' RetryExecutor: Trim failed but not selected to hard-fail. Continuing without trim.');
            processedImagePath = sourcePath; // safe fallback; subsequent steps will proceed
          }
        } else if (stage === 'enhancement') {
          if (enabled && steps.includes('enhancement')) {
            throw procErr;
          } else {
            console.warn(' RetryExecutor: Enhancement failed but not selected to hard-fail. Continuing without enhancement.');
            processedImagePath = sourcePath;
          }
        } else {
          throw procErr;
        }
      }
      console.log(` RetryExecutor: Image processing completed: ${processedImagePath}`);
      
      // Determine the final destination path (Toupload folder)
      // Use job configuration paths if available, otherwise use constructor defaults
      console.log(` RetryExecutor: DEBUG - jobConfiguration exists: ${!!jobConfiguration}`);
      console.log(` RetryExecutor: DEBUG - jobConfiguration.settings exists: ${!!(jobConfiguration && jobConfiguration.settings)}`);
      console.log(` RetryExecutor: DEBUG - jobConfiguration.settings.filePaths exists: ${!!(jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths)}`);
      
      let outputDirectory;
      if (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths) {
        outputDirectory = jobConfiguration.settings.filePaths.outputDirectory;
        console.log(` RetryExecutor: Using original job outputDirectory: ${outputDirectory}`);
      } else {
        outputDirectory = this.outputDirectory;
        console.log(` RetryExecutor: Using default outputDirectory: ${outputDirectory}`);
      }
      
      console.log(` RetryExecutor: DEBUG - Final outputDirectory for move: ${outputDirectory}`);
      
      let finalOutputPath;
      let finalExtension;
      
      if (settings.imageConvert && (settings.convertToWebp === true)) {
        // Converting to WEBP
        finalExtension = '.webp';
        finalOutputPath = path.join(outputDirectory, `${sourceFileName}.webp`);
        console.log(` RetryExecutor: Converting to WEBP, final path: ${finalOutputPath}`);
      } else if (settings.convertToJpg && settings.imageConvert) {
        // Converting to JPG
        finalExtension = '.jpg';
        // Final path should be in the configured output directory
        finalOutputPath = path.join(outputDirectory, `${sourceFileName}.jpg`);
        console.log(` RetryExecutor: Converting to JPG, final path: ${finalOutputPath}`);
      } else {
        // Keeping original format
        finalExtension = path.extname(processedImagePath);
        // Final path should be in the configured output directory
        finalOutputPath = path.join(outputDirectory, `${sourceFileName}${finalExtension}`);
        console.log(` RetryExecutor: Keeping format, final path: ${finalOutputPath}`);
      }
      
      // Ensure the temporary processing directory exists
      try {
        await fs.mkdir(tempProcessingDir, { recursive: true });
        console.log(` RetryExecutor: Created temporary processing directory: ${tempProcessingDir}`);
      } catch (error) {
        console.warn(` RetryExecutor: Temporary processing directory creation failed:`, error.message);
      }
      
      // Ensure the final output directory exists
      try {
        await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
        console.log(` RetryExecutor: Created final output directory: ${path.dirname(finalOutputPath)}`);
      } catch (error) {
        console.warn(` RetryExecutor: Final output directory creation failed:`, error.message);
      }
      
      // Generate new metadata if requested
      let metadataResult = null;
      if (includeMetadata) {
        try {
          console.log(` RetryExecutor: Generating new metadata for processed image`);
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
          console.log(` RetryExecutor: Metadata generation completed:`, metadataResult);
        } catch (metadataError) {
          const enabled = !!(failOptions && failOptions.enabled);
          const steps = Array.isArray(failOptions?.steps) ? failOptions.steps.map(s => String(s).toLowerCase()) : [];
          if (enabled && steps.includes('metadata')) {
            // Ensure downstream failure mapping tags this as a metadata failure
            const err = new Error(`Metadata generation failed: ${metadataError?.message || metadataError}`);
            // @ts-ignore
            err.stage = 'metadata';
            // @ts-ignore
            err.name = 'MetadataError';
            throw err;
          }
          console.warn(` RetryExecutor: Metadata generation failed, continuing without metadata:`, metadataError);
        }
      }
      
      // CRITICAL: Move the processed image to final destination (Toupload folder)
      console.log(` RetryExecutor: Moving processed image to final destination: ${finalOutputPath}`);
      
      // Move the processed image to final destination (safe copy-first strategy)
      try {
        // Copy ensures we don't destroy an existing final file unless copy succeeds
        await fs.copyFile(processedImagePath, finalOutputPath);
        console.log(` RetryExecutor: Successfully copied processed image to: ${finalOutputPath}`);
        // Best-effort cleanup of processed temp file
        try {
          await fs.unlink(processedImagePath);
        } catch (cleanupTempErr) {
          console.warn(` RetryExecutor: Failed to cleanup temp processed file:`, cleanupTempErr.message);
        }
      } catch (moveError) {
        const enabled = !!(failOptions && failOptions.enabled);
        const steps = Array.isArray(failOptions?.steps) ? failOptions.steps.map(s => String(s).toLowerCase()) : [];
        const convertSelected = steps.includes('convert');
        if (enabled && convertSelected) {
          // Hard-fail when explicitly selected
          const err = new Error(`processing_failed:save_final: ${moveError?.message || moveError}`);
          // @ts-ignore
          err.stage = 'save_final';
          throw err;
        }
        // Soft-fail: fallback to original source path; do not move
        console.warn(` RetryExecutor: Move to final output failed but not selected to hard-fail. Falling back to source: ${sourcePath}`);
        finalOutputPath = sourcePath;
      }
      
      // CRITICAL: Now delete the original source file from generated folder
      try {
        const resolvedSource = path.resolve(sourcePath);
        const resolvedFinal = path.resolve(finalOutputPath);
        // Only delete if the source is inside the temp/generated directory to avoid
        // removing files that already live in the final output directory (legacy images).
        const tempDirForGuard =
          (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths && jobConfiguration.settings.filePaths.tempDirectory)
            ? jobConfiguration.settings.filePaths.tempDirectory
            : this.tempDirectory;
        const resolvedTempRoot = path.resolve(tempDirForGuard || '');
        const isInsideTemp =
          resolvedTempRoot &&
          (resolvedSource === resolvedTempRoot || resolvedSource.startsWith(resolvedTempRoot + path.sep));

        if (resolvedSource !== resolvedFinal && isInsideTemp) {
          console.log(` RetryExecutor: Deleting original source file (inside temp): ${resolvedSource}`);
          await fs.unlink(resolvedSource);
          console.log(` RetryExecutor: Original source file deleted successfully`);
        } else if (resolvedSource === resolvedFinal) {
          console.log(` RetryExecutor: Skipping delete - source and final paths are the same (${resolvedSource})`);
        } else {
          console.log(` RetryExecutor: Skipping delete - source is not inside temp directory (${resolvedSource})`);
        }
      } catch (cleanupError) {
        console.warn(` RetryExecutor: Failed to delete original source file:`, cleanupError.message);
        // Don't throw error here, as the main processing was successful
      }
      
      // Update the database with the NEW image path and persist metadata if present
      if (this.currentImageId) {
        try {
          console.log(` RetryExecutor: Updating database with new image path: ${finalOutputPath}`);
          
          // Get the existing image data to preserve all required fields
          const existingImageData = await this.generatedImage.getGeneratedImage(this.currentImageId);
          if (!existingImageData.success || !existingImageData.image) {
            throw new Error(`Failed to get existing image data for update`);
          }
          
          const existingImage = existingImageData.image;
          
          // Build a processing settings snapshot that reflects the effective retry settings
          const processingSnapshot = (() => {
            const s = processingConfig || {};
            return {
              imageEnhancement: !!s.imageEnhancement,
              sharpening: Number.isFinite(Number(s.sharpening)) ? Number(s.sharpening) : 0,
              saturation: Number.isFinite(Number(s.saturation)) ? Number(s.saturation) : 1.0,
              imageConvert: !!s.imageConvert,
              convertToJpg: !!s.convertToJpg,
              convertToWebp: !!s.convertToWebp,
              jpgQuality: Number.isFinite(Number(s.jpgQuality)) ? Number(s.jpgQuality) : 100,
              pngQuality: Number.isFinite(Number(s.pngQuality)) ? Number(s.pngQuality) : 100,
              webpQuality: Number.isFinite(Number(s.webpQuality)) ? Number(s.webpQuality) : 85,
              removeBg: !!s.removeBg,
              trimTransparentBackground: !!s.trimTransparentBackground,
              jpgBackground: s.jpgBackground || 'white',
              removeBgSize: s.removeBgSize || 'auto'
            };
          })();
          
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
            processingSettings: useOriginalSettings ? (existingImage.processingSettings || null) : processingSnapshot
          };
          
          console.log(` RetryExecutor: Updating image with all required fields preserved`);
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
              console.log(' RetryExecutor: Persisted regenerated metadata');
            } catch (e) {
              console.warn(' RetryExecutor: Metadata persistence (byId) failed:', e.message);
            }
          }
          console.log(` RetryExecutor: Database updated successfully`);
        } catch (dbError) {
          console.error(` RetryExecutor: Failed to update database with new path:`, dbError);
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
      console.error(` RetryExecutor: Image processing failed:`, error);
      try {
        const stage = String((error && error.stage) || '').toLowerCase();
        const name = String((error && error.name) || '').toLowerCase();
        const message = String((error && error.message) || '');
        let qcReason = 'processing_failed:qc';
        if (stage === 'remove_bg') qcReason = 'processing_failed:remove_bg';
        else if (stage === 'trim') qcReason = 'processing_failed:trim';
        else if (stage === 'enhancement') qcReason = 'processing_failed:enhancement';
        else if (stage === 'metadata') qcReason = 'processing_failed:metadata';
        else if (stage === 'convert') qcReason = 'processing_failed:convert';
        else if (stage === 'save_final') qcReason = 'processing_failed:save_final';
        // Heuristic fallback if stage not set
        if (qcReason === 'processing_failed:qc') {
          if (name === 'metadataerror' || /metadata generation failed/i.test(message)) {
            qcReason = 'processing_failed:metadata';
          }
        }
        return {
          success: false,
          error: error.message,
          qcReason
        };
      } catch {
        return {
          success: false,
          error: String(error && error.message || error) || 'processing_failed:qc',
          qcReason: 'processing_failed:qc'
        };
      }
    }
  }

  /**
   * Get current queue status (bridge: routes to RetryQueueService when FEATURE_MODULAR_RETRY_QUEUE)
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    if (this._useModularRetryQueue()) {
      try {
        return this.retryQueueService.getQueueStatus();
      } catch (error) {
        console.warn(' RetryExecutor: RetryQueueService.getQueueStatus failed, falling back to legacy:', error?.message || error);
        return this._legacyGetQueueStatus();
      }
    }
    return this._legacyGetQueueStatus();
  }

  /**
   * Legacy: Get current queue status
   * @returns {Object} Queue status
   */
  _legacyGetQueueStatus() {
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
   * Clear completed jobs from queue (bridge: routes to RetryQueueService when FEATURE_MODULAR_RETRY_QUEUE)
   */
  clearCompletedJobs() {
    if (this._useModularRetryQueue()) {
      try {
        return this.retryQueueService.clearCompletedJobs();
      } catch (error) {
        console.warn(' RetryExecutor: RetryQueueService.clearCompletedJobs failed, falling back to legacy:', error?.message || error);
        return this._legacyClearCompletedJobs();
      }
    }
    return this._legacyClearCompletedJobs();
  }

  /**
   * Legacy: Clear completed jobs from queue
   */
  _legacyClearCompletedJobs() {
    this.queue = this.queue.filter(job => job.status !== 'completed');
    this.emit('queue-updated', {
      queueLength: this.queue.length
    });
  }

  /**
   * Stop processing and clear queue (bridge: routes to RetryQueueService when FEATURE_MODULAR_RETRY_QUEUE)
   */
  stop() {
    if (this._useModularRetryQueue()) {
      try {
        return this.retryQueueService.stopProcessing();
      } catch (error) {
        console.warn(' RetryExecutor: RetryQueueService.stopProcessing failed, falling back to legacy:', error?.message || error);
        return this._legacyStop();
      }
    }
    return this._legacyStop();
  }

  /**
   * Legacy: Stop processing and clear queue
   */
  _legacyStop() {
    this.isProcessing = false;
    this.queue = [];
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
