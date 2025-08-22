const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { logDebug } = require('../utils/logDebug');

// Import existing CLI modules
const producePictureModule = require('../producePictureModule');
const paramsGeneratorModule = require('../paramsGeneratorModule');
const aiVision = require('../aiVision');

// Progress steps with weights - more granular for better synchronization
const PROGRESS_STEPS = [
  { name: 'initialization', weight: 5, description: 'Initializing job configuration' },
  { name: 'parameter_generation', weight: 10, description: 'Generating parameters from keywords' },
  { name: 'image_generation', weight: 25, description: 'Generating images with AI' },
  { name: 'image_processing', weight: 20, description: 'Processing individual images' },
  { name: 'quality_check', weight: 25, description: 'Running quality checks' },
  { name: 'metadata_generation', weight: 15, description: 'Generating metadata' }
];

class JobRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.currentJob = null;
    this.jobState = {
      id: null,
      status: 'idle',
      startTime: null,
      endTime: null,
      error: null,
      progress: 0,
      currentStep: null,
      totalImages: 0,
      successfulImages: 0,
      failedImages: 0
    };
    this.completedSteps = [];
    this.isStopping = false;
    this.isRerun = options.isRerun || false; // Flag to prevent duplicate database saves during reruns
    
    // Set global reference so logDebug can find us
    global.currentJobRunner = this;
  }

  /**
   * Enhanced structured logging helper
   * @param {Object} options - Logging options
   * @param {string} options.level - Log level (debug, info, warn, error)
   * @param {string} options.stepName - Current step name
   * @param {string} options.subStep - Sub-operation within the step
   * @param {number} options.imageIndex - Image index (0-based)
   * @param {string} options.message - Human-readable message
   * @param {number} options.durationMs - Operation duration in milliseconds
   * @param {string} options.errorCode - Specific error identifier
   * @param {Object} options.metadata - Additional context
   * @param {boolean} options.updateProgress - Whether to update progress state for this log
   */
  _logStructured(options) {
    const {
      level = 'info',
      stepName = this.jobState.currentStep || 'unknown',
      subStep = 'general',
      imageIndex = null,
      message,
      durationMs = null,
      errorCode = null,
      metadata = {},
      updateProgress = false
    } = options;

    // Update progress state if requested (for major step transitions)
    if (updateProgress && stepName !== this.jobState.currentStep) {
      // Update internal state
      this.jobState.currentStep = stepName;
      
      // Calculate and emit progress for UI updates
      const progress = this.calculateProgress(this.completedSteps, stepName);
      this.emitProgress(stepName, progress, `Step: ${stepName}`);
    }

    // Security: Sanitize metadata to remove any potential sensitive information
    const sanitizedMetadata = this._sanitizeMetadata(metadata);

    // Create structured log entry
    const structuredLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      level,
      message,
      source: 'job-runner',
      // New structured fields
      stepName,
      subStep,
      imageIndex,
      durationMs,
      errorCode,
      metadata: sanitizedMetadata,
      // Progress context
      progress: this.jobState.progress,
      totalImages: this.jobState.totalImages,
      successfulImages: this.jobState.successfulImages,
      failedImages: this.jobState.failedImages
    };

    // Add to in-memory logs (preserving existing behavior)
    if (!this._inMemoryLogs) {
      this._inMemoryLogs = [];
    }
    this._inMemoryLogs.push(structuredLog);

    // Emit event for real-time listeners (new capability)
    this.emit('log', structuredLog);

    return structuredLog;
  }

  /**
   * Security: Sanitize metadata to remove sensitive information
   * @param {Object} metadata - Raw metadata object
   * @returns {Object} Sanitized metadata object
   */
  _sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return metadata;
    }

    const sanitized = {};
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /auth/i,
      /credential/i
    ];

    for (const [key, value] of Object.entries(metadata)) {
      // Check if key contains sensitive patterns
      const isSensitiveKey = sensitivePatterns.some(pattern => pattern.test(key));
      
      if (isSensitiveKey) {
        // Replace sensitive values with [REDACTED]
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        // Truncate long strings to prevent potential sensitive data exposure
        sanitized[key] = value.substring(0, 100) + '...';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this._sanitizeMetadata(value);
      } else {
        // Safe to include
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Start a new job with the given configuration
   * @param {Object} config - Job configuration object
   * @returns {Promise<Object>} Job result
   */
  async startJob(config) {
    try {
      console.log('🚀 JobRunner.startJob called with config:', config);
      console.log('🔍 DEBUG: config.ai:', config.ai);
      console.log('🔍 DEBUG: config.ai?.runQualityCheck:', config.ai?.runQualityCheck);
      console.log('🔍 DEBUG: config.ai?.runMetadataGen:', config.ai?.runMetadataGen);
      
      // Check if job is already running
      if (this.jobState.status === 'running') {
        console.log('⚠️ Job already running, cannot start new job');
        return {
          success: false,
          error: 'A job is already running. Please stop the current job first.',
          code: 'JOB_ALREADY_RUNNING'
        };
      }

      console.log('✅ No job currently running, proceeding...');
      
      // Validate configuration
      console.log('🔍 Validating configuration...');
      const validationResult = this.validateConfiguration(config);
      if (!validationResult.valid) {
        console.log('❌ Configuration validation failed:', validationResult.error);
        return {
          success: false,
          error: validationResult.error,
          code: 'JOB_CONFIGURATION_ERROR'
        };
      }
      console.log('✅ Configuration validation passed');

      // Initialize job
      const jobId = uuidv4();
      console.log('🆔 Generated job ID:', jobId);
      
      // Preserve completed status from previous job if it exists
      const wasCompleted = this.jobState.status === 'completed';

      
      // PRESERVE the configurationId that was set by backendAdapter!
      const preservedConfigurationId = this.configurationId;
      console.log('🔍 PRESERVING configurationId:', preservedConfigurationId);
      
      this.jobState = {
        id: jobId,
        status: 'running',
        startTime: new Date(),
        endTime: null,
        error: null,
        progress: 0,
        currentStep: 'initialization',
        totalImages: 0,
        successfulImages: 0,
        failedImages: 0
      };
      this.completedSteps = [];
      this.isStopping = false;
      
      // RESTORE the configurationId after resetting jobState
      this.configurationId = preservedConfigurationId;
      console.log('🔍 RESTORED configurationId:', this.configurationId);
      
      // If previous job was completed, log it for debugging
      if (wasCompleted) {

      }

      console.log('✅ Job state initialized:', this.jobState);

      // Emit progress update
      this.emitProgress('initialization', 0, 'Initializing job configuration...');

      // Set environment variables from config
      console.log('🔧 Setting environment variables...');
      try {
        console.log('🔧 About to call setEnvironmentFromConfig...');
        this.setEnvironmentFromConfig(config);
  
      } catch (error) {
        console.error('❌ Error in setEnvironmentFromConfig:', error);
        console.error('❌ Error stack:', error.stack);
        throw error; // Re-throw to prevent silent failure
      }
      console.log('🔧 AFTER setEnvironmentFromConfig - about to start backendAdapter initialization');
      console.log('🔧 DEBUG: About to log next line');
      console.log('🔧 DEBUG: This line should appear');
      console.log('🔧 DEBUG: If you see this, the issue is after this point');

      // Initialize backend adapter

      console.log('🔧 MODULE LOAD: About to enter try block');
      try {
        console.log('🔧 MODULE LOAD: Inside try block - about to log first message');
        // Try to get the backend adapter instance
        console.log('🔧 MODULE LOAD: Attempting to initialize backend adapter for database integration...');
        console.log('🔧 MODULE LOAD: Current directory:', __dirname);
        // Instead of creating a new instance, try to get the existing one
        // This avoids IPC handler conflicts
        console.log("🔧 MODULE LOAD: Attempting to get existing backend adapter instance...");
        
        // Try to get the existing backend adapter from the parent process
        // Since we are in the main process, we can access the existing instance
        if (process.mainModule && process.mainModule.exports && process.mainModule.exports.backendAdapter) {
          this.backendAdapter = process.mainModule.exports.backendAdapter;
          console.log("✅ MODULE LOAD: Using existing main process backend adapter");
        } else if (global.backendAdapter) {
          this.backendAdapter = global.backendAdapter;
          console.log("✅ MODULE LOAD: Using existing global backend adapter");
        } else {
          console.log("🔧 MODULE LOAD: No existing backend adapter found, will skip database integration");
          this.backendAdapter = null;
        }
        
        if (this.backendAdapter) {
          console.log("✅ MODULE LOAD: Database integration enabled - job executions will be saved");
          console.log("🔧 MODULE LOAD: backendAdapter object:", typeof this.backendAdapter, this.backendAdapter ? "AVAILABLE" : "NULL");
        } else {
          console.warn("⚠️ MODULE LOAD: No backend adapter available - job executions will not be saved to database");
        }
      } catch (error) {
        console.error('❌ MODULE LOAD: Could not initialize backend adapter for database integration:', error);
        console.error('❌ MODULE LOAD: Error stack:', error.stack);
        console.warn('❌ MODULE LOAD: Job executions will not be saved to database');
        console.warn('❌ MODULE LOAD: Frontend will continue to show no data');
        console.log('🔧 MODULE LOAD: Exiting catch block');
      }
      console.log('🔧 MODULE LOAD: After try-catch block - about to start job execution');

      // Start the job execution
      
      // Log job start with structured logging
      this._logStructured({
        level: 'info',
        stepName: 'initialization',
        subStep: 'start',
        message: 'Starting job execution',
        updateProgress: true, // Update progress for job start
        metadata: { 
          jobId,
          hasBackendAdapter: !!this.backendAdapter,
          isRerun: this.isRerun
        }
      });
      
      this.currentJob = this.executeJob(config, jobId);
      // Save job execution to database if backendAdapter is available
      // BUT NOT during reruns (reruns are handled by the backend rerun handler)
      if (this.backendAdapter && !this.isRerun) {
        try {
          console.log("💾 Saving job execution to database...");
          const jobExecution = {
            configurationId: this.configurationId || null, // Use the configuration ID passed from backendAdapter
            startedAt: this.jobState.startTime,
            completedAt: null,
            status: "running",
            totalImages: 0,
            successfulImages: 0,
            failedImages: 0,
            errorMessage: null,
            label: null
          };
          
          const saveResult = await this.backendAdapter.saveJobExecution(jobExecution);
          console.log("✅ Job execution saved to database:", saveResult);
          console.log("🔍 saveResult type:", typeof saveResult);
          console.log("🔍 saveResult keys:", Object.keys(saveResult));
          console.log("🔍 saveResult.success:", saveResult.success);
          console.log("🔍 saveResult.id:", saveResult.id);
          
          // Store the database execution ID for later use
          if (saveResult.success && saveResult.id) {
            this.databaseExecutionId = saveResult.id;
            console.log('🔍 Stored database execution ID:', this.databaseExecutionId);
            console.log('🔍 this.databaseExecutionId after assignment:', this.databaseExecutionId);
          } else {
            console.warn('⚠️ saveResult missing required fields:', saveResult);
          }
        } catch (error) {
          console.error("❌ Failed to save job execution to database:", error);
        }
      } else if (this.isRerun) {
        console.log("🔄 Rerun mode - skipping JobRunner database save (handled by backend rerun handler)");
      } else {
        console.warn("⚠️ No backendAdapter available - job execution will not be saved to database");
      }
      
      
      // For testing purposes, wait a bit to ensure job state is set
      await new Promise(resolve => setTimeout(resolve, 10));

      console.log('✅ Job started successfully, returning result');
      return {
        success: true,
        jobId: jobId,
        message: 'Job started successfully'
      };

    } catch (error) {
      console.error('❌ Error starting job in JobRunner:', error);
      this.jobState.status = 'error';
      this.jobState.error = error.message;
      
      return {
        success: false,
        error: error.message,
        code: 'JOB_START_ERROR'
      };
    }
  }

  /**
   * Stop the current job gracefully
   * @returns {Promise<void>}
   */
  async stopJob() {
    if (this.jobState.status === 'running') {
      this.isStopping = true;
      this.jobState.status = 'stopped';
      this.jobState.endTime = new Date();
      
      this.emitProgress('stopped', 100, 'Job stopped by user');
      
      // Clean up any running processes
      if (this.currentJob) {
        // Note: The actual cleanup will depend on how the modules handle cancellation
        this.currentJob = null;
      }
    }
  }

  /**
   * Force stop all jobs
   * @returns {Promise<void>}
   */
  async forceStopAll() {
    this.isStopping = true;
    this.jobState.status = 'stopped';
    this.jobState.endTime = new Date();
    this.currentJob = null;
    
    this.emitProgress('force_stopped', 100, 'All jobs force stopped');
  }

  /**
   * Get current job state
   * @returns {Object} Job state
   */
  getJobState() {
    return { ...this.jobState };
  }

  /**
   * Validate job configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfiguration(config) {
    console.log('🔍 validateConfiguration called');
    // Never log raw API keys
    console.log('🔍 config.apiKeys: [REDACTED]');
    console.log('🔍 config.filePaths:', config.filePaths);
    console.log('🔍 config.parameters:', config.parameters);
    
    // Check required API keys
    if (!config.apiKeys || !config.apiKeys.openai) {
      console.log('❌ OpenAI API key missing or invalid');
      return { valid: false, error: 'OpenAI API key is required' };
    }
    if (!config.apiKeys.piapi) {
      console.log('❌ PiAPI key missing');
      return { valid: false, error: 'PiAPI key is required' };
    }

    // Check file paths
    if (!config.filePaths || !config.filePaths.outputDirectory) {
      console.log('❌ Output directory missing');
      return { valid: false, error: 'Output directory is required' };
    }

    // Check parameters
    if (!config.parameters || !config.parameters.processMode) {
      console.log('❌ Process mode missing');
      return { valid: false, error: 'Process mode is required' };
    }

    console.log('✅ Configuration validation passed');
    return { valid: true };
  }

  /**
   * Set environment variables from configuration
   * @param {Object} config - Job configuration
   */
  setEnvironmentFromConfig(config) {
    // Never log raw API keys
    console.log('🔧 Setting environment variables from config: [REDACTED]');
    console.log('🔧 Before setting - Environment variables:');
    console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  - PIAPI_API_KEY:', process.env.PIAPI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  - REMOVE_BG_API_KEY:', process.env.REMOVE_BG_API_KEY ? 'SET' : 'NOT SET');
    
    // Set API keys
    if (config.apiKeys.openai) {
      process.env.OPENAI_API_KEY = config.apiKeys.openai;
      console.log('✅ OpenAI API key set');
    }
    if (config.apiKeys.piapi) {
      process.env.PIAPI_API_KEY = config.apiKeys.piapi;  // Fixed: was PIAPI_KEY
      console.log('✅ PiAPI key set');
    }
    if (config.apiKeys.removeBg) {
      process.env.REMOVE_BG_API_KEY = config.apiKeys.removeBg;
      console.log('✅ RemoveBG API key set');
    }

    // Set other environment variables as needed
    if (config.advanced && config.advanced.debugMode) {
      process.env.DEBUG_MODE = 'true';
      console.log('✅ Debug mode enabled');
    }
    
    console.log('🔧 After setting - Environment variables:');
    console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  - PIAPI_API_KEY:', process.env.PIAPI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  - REMOVE_BG_API_KEY:', process.env.REMOVE_BG_API_KEY ? 'SET' : 'NOT SET');
    console.log('🔧 Environment variables set successfully');
  }

  /**
   * Execute the job with the given configuration
   * @param {Object} config - Job configuration
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async executeJob(config, jobId) {
    try {
      // Do not log entire config to avoid leaking secrets
      
      // Step 1: Parameter Generation
      if (this.isStopping) return;
      
      // Call the real paramsGeneratorModule
      const parameters = await this.generateParameters(config);
      
      this.completedSteps.push('parameter_generation');

      // Step 2: Image Generation
      if (this.isStopping) return;
      
      // Call the real producePictureModule
      let images;
      try {
        images = await this.generateImages(config, parameters);
      } catch (error) {
        throw error;
      }
      // Save generated images to database if backendAdapter is available
      if (this.backendAdapter && Array.isArray(images)) {
        try {
          console.log("💾 Saving generated images to database...");
          for (const image of images) {
            if (image.path && image.status === "generated") {
              // Use the stored database execution ID
              const executionId = this.databaseExecutionId;
              console.log('🔍 Using stored database execution ID for generated image:', executionId);
              console.log('🔍 this.databaseExecutionId type:', typeof this.databaseExecutionId);
              console.log('🔍 this.databaseExecutionId value:', this.databaseExecutionId);
              console.log('🔍 this object keys:', Object.keys(this));
              
              if (executionId) {
                const generatedImage = {
                  imageMappingId: image.mappingId || `img_${Date.now()}_${i}`, // Use mapping ID from producePictureModule
                  executionId: executionId,
                  generationPrompt: image.metadata?.prompt || 'Generated image',
                  seed: null,
                  qcStatus: 'failed',
                  qcReason: null,
                  finalImagePath: image.path,
                  metadata: JSON.stringify(image.metadata || {}),
                  processingSettings: JSON.stringify({
                    aspectRatio: image.aspectRatio || '16:9',
                    status: image.status
                  })
                };
                
                const saveResult = await this.backendAdapter.saveGeneratedImage(generatedImage);
                console.log("✅ Generated image saved to database:", saveResult);
              } else {
                console.warn('⚠️ Skipping image save - no execution ID available');
              }
            }
          }
        } catch (error) {
          console.error("❌ Failed to save generated images to database:", error);
        }
      } else {
        console.warn("⚠️ No backendAdapter available or no images - generated images will not be saved to database");
      }
      
      
              this.completedSteps.push('image_generation');
        this.completedSteps.push('image_processing');

      // Step 3: Background Removal (if enabled)
      if (config.processing && config.processing.removeBg && !this.isStopping) {
        await this.removeBackgrounds(images, config);
        
        this.completedSteps.push('background_removal');
      }

      // Step 4: Quality Check (if enabled) - Run after images are saved to database
      // Note: If QC is disabled, images are automatically approved to maintain happy path
      console.log('🔍 DEBUG: About to check quality check condition');
      console.log('🔍 DEBUG: config.ai:', config.ai);
      console.log('🔍 DEBUG: config.ai?.runQualityCheck:', config.ai?.runQualityCheck);
      console.log('🔍 DEBUG: this.isStopping:', this.isStopping);
      console.log('🔍 DEBUG: Full condition:', config.ai && config.ai.runQualityCheck && !this.isStopping);
      
      if (config.ai && config.ai.runQualityCheck && !this.isStopping) {
        console.log('✅ Quality check condition is TRUE - proceeding with quality checks');
        
        // Get the saved images from database to have their IDs
        console.log('🔍 DEBUG: About to call getSavedImagesForExecution with executionId:', this.databaseExecutionId);
        const savedImages = await this.getSavedImagesForExecution(this.databaseExecutionId);
        console.log('🔍 DEBUG: getSavedImagesForExecution returned:', savedImages);
        console.log('🔍 DEBUG: savedImages length:', savedImages ? savedImages.length : 'undefined');
        
        if (savedImages && savedImages.length > 0) {
          console.log('✅ Found saved images, running quality checks');
          await this.runQualityChecks(savedImages, config);
        } else {
          console.warn('⚠️ No saved images found for quality checks');
        }
        
        this.completedSteps.push('quality_check');
      } else {
        console.log('❌ Quality check condition is FALSE - skipping quality checks');
        console.log('❌ Reason: config.ai =', config.ai, ', runQualityCheck =', config.ai?.runQualityCheck, ', isStopping =', this.isStopping);
        
        // When quality checks are disabled, automatically approve all images
        console.log('✅ Quality checks disabled - automatically approving all images');
        
        try {
          // Get the saved images from database to have their IDs
          const savedImages = await this.getSavedImagesForExecution(this.databaseExecutionId);
          if (savedImages && savedImages.length > 0) {
            console.log(`✅ Auto-approving ${savedImages.length} images (QC disabled)`);
            
            // Update all images to approved status
            for (const image of savedImages) {
              if (this.backendAdapter && image.imageMappingId) {
                try {
                  console.log(`💾 Auto-approving image ${image.imageMappingId} (QC disabled)`);
                  await this.backendAdapter.updateQCStatusByMappingId(image.imageMappingId, 'approved', 'Auto-approved (quality checks disabled)');
                  console.log(`✅ Image ${image.imageMappingId} auto-approved successfully`);
                } catch (dbError) {
                  console.error(`❌ Failed to auto-approve image ${image.imageMappingId}:`, dbError);
                }
              }
            }
            
            console.log(`✅ Auto-approved ${savedImages.length} images successfully`);
          } else {
            console.warn('⚠️ No saved images found for auto-approval');
          }
        } catch (error) {
          console.error('❌ Error during auto-approval:', error);
        }
        
        this.completedSteps.push('auto_approval');
      }

      // Step 5: Metadata Generation (if enabled)
      if (config.ai && config.ai.runMetadataGen && !this.isStopping) {
        await this.generateMetadata(images, config);
        
        this.completedSteps.push('metadata_generation');
      }

      // Job completed successfully
      this.jobState.status = 'completed';
      this.jobState.endTime = new Date();
      
      // Save completed job execution to database if backendAdapter is available
      if (this.backendAdapter) {
        try {
          console.log("💾 Updating job execution in database...");
          console.log("🔍 Job state before update:", {
            totalImages: this.jobState.totalImages,
            successfulImages: this.jobState.successfulImages,
            failedImages: this.jobState.failedImages,
            startTime: this.jobState.startTime,
            endTime: this.jobState.endTime
          });
          
          const updatedJobExecution = {
            configurationId: this.configurationId, // Preserve the configuration ID
            startedAt: this.jobState.startTime,
            completedAt: this.jobState.endTime,
            status: "completed",
            totalImages: this.jobState.totalImages || 0,
            successfulImages: this.jobState.successfulImages || 0,
            failedImages: this.jobState.failedImages || 0,
            errorMessage: null,
            label: null
          };
          
          console.log("🔍 About to update job execution with data:", JSON.stringify(updatedJobExecution, null, 2));
          const updateResult = await this.backendAdapter.updateJobExecution(this.databaseExecutionId, updatedJobExecution);
          console.log("✅ Job execution updated in database:", updateResult);
          
          // Verify the update worked by reading back the job execution
          if (updateResult.success) {
            try {
              const verifyResult = await this.backendAdapter.getJobExecution(this.databaseExecutionId);
              console.log("🔍 Verification - job execution after update:", JSON.stringify(verifyResult, null, 2));
            } catch (verifyError) {
              console.error("❌ Failed to verify job execution update:", verifyError);
            }
          }
        } catch (error) {
          console.error("❌ Failed to update job execution in database:", error);
        }
      } else {
        console.warn("⚠️ No backendAdapter available - job execution will not be saved to database");
      }
      

      
      // Check if there are bulk rerun jobs in the queue and process the next one
      if (this.backendAdapter && this.isRerun) {
        try {
          console.log('📋 Checking for next bulk rerun job in queue...');
          const nextJobResult = await this.backendAdapter.processNextBulkRerunJob();
          if (nextJobResult.success) {
            console.log(`📋 Started next bulk rerun job: ${nextJobResult.message}`);
          } else if (nextJobResult.message === 'No jobs in queue') {
            console.log('📋 No more bulk rerun jobs in queue');
          } else {
            console.log(`📋 Next bulk rerun job not ready: ${nextJobResult.message}`);
          }
        } catch (error) {
          console.error('❌ Error processing next bulk rerun job:', error);
        }
      }

    } catch (error) {
      console.error('❌ Job execution error:', error);
      this.jobState.status = 'error';
      this.jobState.error = error.message;
      this.jobState.endTime = new Date();
      
      // Save error state to database if backendAdapter is available
      if (this.backendAdapter) {
        try {
          console.log("💾 Updating job execution with error status in database...");
          const errorJobExecution = {
            configurationId: this.configurationId, // Preserve the configuration ID
            startedAt: this.jobState.startTime,
            completedAt: this.jobState.endTime,
            status: "failed",
            totalImages: this.jobState.totalImages || 0,
            successfulImages: this.jobState.successfulImages || 0,
            failedImages: this.jobState.failedImages || 0,
            errorMessage: error.message,
            label: null
          };
          
          const updateResult = await this.backendAdapter.updateJobExecution(this.databaseExecutionId, errorJobExecution);
          console.log("✅ Job execution error status updated in database:", updateResult);
        } catch (dbError) {
          console.error("❌ Failed to update job execution error status in database:", dbError);
        }
      } else {
        console.warn("⚠️ No backendAdapter available - job error status will not be saved to database");
      }
      
      this.emit('error', {
        jobId: jobId,
        error: error.message,
        code: 'JOB_EXECUTION_ERROR',
        timestamp: new Date(),
        userMessage: 'Job execution failed. Please check the configuration and try again.',
        retryable: true
      });
    }
  }

  /**
   * Generate parameters using the existing paramsGeneratorModule
   * @param {Object} config - Job configuration
   * @returns {Promise<Object>} Generated parameters
   */
  async generateParameters(config) {
    const startTime = Date.now();
    try {
      this._logStructured({
        level: 'info',
        stepName: 'parameter_generation',
        subStep: 'start',
        message: 'Starting parameter generation',
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          configKeys: Object.keys(config || {}).filter(key => key !== 'apiKeys'),
          hasApiKeys: !!config?.apiKeys,
          hasParameters: !!config?.parameters,
          hasProcessing: !!config?.processing,
          hasAI: !!config?.ai,
          hasFilePaths: !!config?.filePaths
        }
      });

      // Extract keywords from config
      const keywords = config.parameters?.keywords || config.parameters?.prompt || 'default image';
      
      // Ensure aspectRatios is always an array
      let aspectRatios = config.parameters?.aspectRatios || ['1:1'];
      if (typeof aspectRatios === 'string') {
        aspectRatios = [aspectRatios]; // Convert string to array
      } else if (!Array.isArray(aspectRatios)) {
        aspectRatios = ['1:1']; // Fallback to default
      }
      
      const mjVersion = config.parameters?.mjVersion || '6';
      
      this._logStructured({
        level: 'debug',
        stepName: 'parameter_generation',
        subStep: 'extract',
        message: `Extracted configuration: keywords="${keywords}", aspectRatios=${JSON.stringify(aspectRatios)}, mjVersion=${mjVersion}`,
        metadata: { keywords, aspectRatios, mjVersion }
      });
      
      // Call the real paramsGeneratorModule with correct signature
      this._logStructured({
        level: 'info',
        stepName: 'parameter_generation',
        subStep: 'generate',
        message: 'Calling paramsGeneratorModule',
        metadata: { 
          hasSystemPrompt: !!config.parameters?.systemPrompt,
          systemPromptLength: config.parameters?.systemPrompt?.length || 0,
          openaiModel: config.parameters?.openaiModel 
        }
      });
      
      const parameters = await paramsGeneratorModule.paramsGeneratorModule(
        keywords,
        config.parameters?.systemPrompt || null,
        null, // keywordFilePath not needed
        {
          mjVersion: mjVersion,
          openaiModel: config.parameters?.openaiModel || 'gpt-4o'
        }
      );
      
      // Add the aspect ratios to the returned parameters
      const enhancedParameters = {
        ...parameters,
        aspectRatios: aspectRatios  // Include aspect ratios from config
      };
      
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'info',
        stepName: 'parameter_generation',
        subStep: 'complete',
        message: 'Parameter generation completed successfully',
        durationMs: duration,
        updateProgress: true, // Update progress for step completion
        metadata: { 
          finalAspectRatios: enhancedParameters.aspectRatios,
          aspectRatiosType: typeof enhancedParameters.aspectRatios,
          isArray: Array.isArray(enhancedParameters.aspectRatios)
        }
      });
      
      return enhancedParameters;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'parameter_generation',
        subStep: 'error',
        message: `Parameter generation failed: ${error.message}`,
        durationMs: duration,
        errorCode: 'PARAM_GEN_ERROR',
        metadata: { error: error.message, stack: error.stack }
      });
      
      console.error('❌ Error generating parameters:', error);
      throw new Error(`Failed to generate parameters: ${error.message}`);
    }
  }

  /**
   * Generate images using the existing producePictureModule
   * @param {Object} config - Job configuration
   * @param {Object} parameters - Generated parameters
   * @returns {Promise<Array>} Generated images
   */
  async generateImages(config, parameters) {
    const startTime = Date.now();
    try {
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'start',
        message: 'Starting image generation',
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          totalImages: config.parameters?.processMode === 'single' ? 1 : 4,
          aspectRatios: parameters.aspectRatios,
          processMode: config.parameters?.processMode
        }
      });


      
      // Prepare the configuration for producePictureModule
      const moduleConfig = {
        removeBg: config.processing?.removeBg || false,
        imageConvert: config.processing?.imageConvert || false,
        convertToJpg: config.processing?.convertToJpg || false,
        trimTransparentBackground: config.processing?.trimTransparentBackground || false,
        aspectRatios: Array.isArray(parameters.aspectRatios) ? parameters.aspectRatios : 
                     (Array.isArray(config.parameters?.aspectRatios) ? config.parameters.aspectRatios : 
                     (typeof config.parameters?.aspectRatios === 'string' ? [config.parameters.aspectRatios] : ['1:1'])),
        pollingTimeout: config.processing?.pollingTimeout || 30000,
        processMode: config.parameters?.processMode || 'single',
        removeBgSize: config.processing?.removeBgSize || 'preview',
        runQualityCheck: config.ai?.runQualityCheck || false,
        runMetadataGen: config.ai?.runMetadataGen || false,
        // Image enhancement settings
        imageEnhancement: config.processing?.imageEnhancement || false,
        sharpening: config.processing?.sharpening || 0,
        saturation: config.processing?.saturation || 1,
        jpgBackground: config.processing?.jpgBackground || 'white',
        jpgQuality: config.processing?.jpgQuality || 90,
        pngQuality: config.processing?.pngQuality || 9,
        // Paths
        outputDirectory: config.filePaths?.outputDirectory || './pictures/toupload',
        tempDirectory: config.filePaths?.tempDirectory || './pictures/generated'
      };
      
      this._logStructured({
        level: 'debug',
        stepName: 'image_generation',
        subStep: 'config',
        message: 'Module configuration prepared',
        metadata: { 
          aspectRatios: moduleConfig.aspectRatios,
          processMode: moduleConfig.processMode,
          removeBg: moduleConfig.removeBg,
          imageEnhancement: moduleConfig.imageEnhancement
        }
      });
      

      
      // Call the real producePictureModule with correct signature
      // Note: This is a simplified call - the real module expects more complex setup
      // For now, we'll create a basic implementation
      const imgNameBase = `job_${Date.now()}`;
      
      // Create settings object with API keys and prompt
      const settings = {
        prompt: parameters.prompt,
        promptContext: parameters.promptContext,
        apiKeys: config.apiKeys  // Pass API keys in settings
      };
      
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'call_module',
        message: 'Calling producePictureModule',
        metadata: { 
          imgNameBase,
          prompt: parameters.prompt,
          hasApiKeys: !!config.apiKeys
        }
      });
      
      console.log('🔧 Settings prepared for producePictureModule:', settings);
      
      const result = await producePictureModule.producePictureModule(
        settings, // Pass settings with API keys as first parameter
        imgNameBase,
        null, // customMetadataPrompt
        moduleConfig
      );
      
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'module_result',
        message: `Module returned ${Array.isArray(result) ? result.length : 1} images`,
        metadata: { 
          resultType: typeof result,
          isArray: Array.isArray(result),
          resultLength: Array.isArray(result) ? result.length : 'N/A'
        }
      });
      
      console.log('✅ Images generated by module:', result);
      console.log('🔍 Result type:', typeof result);
      console.log('🔍 Result is array:', Array.isArray(result));
      console.log('🔍 Result length:', Array.isArray(result) ? result.length : 'N/A');
      console.log('🔍 Result structure:', JSON.stringify(result, null, 2));
      
      // The module returns an array of image objects, each with outputPath
      if (result && Array.isArray(result)) {
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'process_array',
          message: `Processing ${result.length} images from array result`,
          metadata: { imageCount: result.length }
        });
        
        console.log('🔧 Result is an array, processing', result.length, 'images');
        
        // Update job state with image counts
        this.jobState.totalImages = result.length;
        this.jobState.successfulImages = result.length; // All images are successful initially
        this.jobState.failedImages = 0;
        
        // Create separate image objects for each result
        const processedImages = result.map((item, index) => {
          // Update to image_processing step for individual image handling
          this._logStructured({
            level: 'info',
            stepName: 'image_processing',
            subStep: 'process_image',
            imageIndex: index,
            message: `Processing image ${index + 1}/${result.length}`,
            updateProgress: index === 0, // Update progress only on first image to transition to processing step
            metadata: { 
              itemType: typeof item,
              itemKeys: Object.keys(item),
              mappingId: item.mappingId,
              currentImageProgress: Math.round(((index + 1) / result.length) * 100)
            }
          });
          
          // Extract the outputPath from each item
          const imagePath = item.outputPath || item.path || item;
          
          // Get the correct aspect ratio for this image
          // If we have multiple aspect ratios, cycle through them
          // If we have only one, use it for all images
          let aspectRatio;
          if (parameters.aspectRatios && parameters.aspectRatios.length > 0) {
            if (parameters.aspectRatios.length === 1) {
              // Single aspect ratio - use for all images
              aspectRatio = parameters.aspectRatios[0];
            } else {
              // Multiple aspect ratios - cycle through them
              aspectRatio = parameters.aspectRatios[index % parameters.aspectRatios.length];
            }
          } else {
            // Fallback to default
            aspectRatio = '1:1';
          }
          
          this._logStructured({
            level: 'debug',
            stepName: 'image_generation',
            subStep: 'aspect_ratio',
            imageIndex: index,
            message: `Image ${index + 1} using aspect ratio: ${aspectRatio}`,
            metadata: { 
              aspectRatio,
              aspectRatiosCount: parameters.aspectRatios?.length || 0,
              aspectRatioIndex: index % (parameters.aspectRatios?.length || 1)
            }
          });
          

          
          const imageObject = {
            path: imagePath,  // This should be a string path
            aspectRatio: aspectRatio,
            status: 'generated',
            metadata: { prompt: parameters.prompt },
            mappingId: item.mappingId || `img_${Date.now()}_${index}` // Preserve the mapping ID from producePictureModule
          };
          
          this._logStructured({
            level: 'info',
            stepName: 'image_generation',
            subStep: 'image_created',
            imageIndex: index,
            message: `Image ${index + 1} created successfully`,
            metadata: { 
              path: imagePath,
              aspectRatio,
              mappingId: imageObject.mappingId,
              status: imageObject.status
            }
          });
          
          console.log(`🔧 Created image object ${index}:`, imageObject);
          console.log(`🔧 Image object mappingId:`, imageObject.mappingId);
          console.log(`🔧 Item mappingId:`, item.mappingId);
          return imageObject;
        });
        
        const duration = Date.now() - startTime;
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'complete',
          message: `Image generation completed successfully: ${processedImages.length} images`,
          durationMs: duration,
          updateProgress: true, // Update progress for step completion
          metadata: { 
            totalImages: processedImages.length,
            successfulImages: processedImages.length,
            failedImages: 0,
            allMappingIds: processedImages.map(img => img.mappingId)
          }
        });
        
              return processedImages;  // Return array of image objects
      } else if (result && typeof result === 'string') {
        // Fallback: single string path
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'fallback_single',
          message: 'Single image result (string path)',
          metadata: { resultType: 'string', path: result }
        });
        
        // Update job state with image counts
        this.jobState.totalImages = 1;
        this.jobState.successfulImages = 1;
        this.jobState.failedImages = 0;
        
        return [{
          path: result,
          aspectRatio: parameters.aspectRatios?.[0] || '1:1',
          status: 'generated',
          metadata: { prompt: parameters.prompt }
        }];
      } else {
        throw new Error('No images were generated or invalid result format');
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'image_generation',
        subStep: 'error',
        message: `Image generation failed: ${error.message}`,
        durationMs: duration,
        errorCode: 'IMAGE_GEN_ERROR',
        metadata: { error: error.message, stack: error.stack }
      });
      
      console.error('❌ Error generating images:', error);
      throw new Error(`Failed to generate images: ${error.message}`);
    }
  }

  /**
   * Remove backgrounds from images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async removeBackgrounds(images, config) {
    try {

      
    } catch (error) {
      console.error('❌ Error during background removal:', error);
      throw new Error(`Background removal failed: ${error.message}`);
    }
  }

  /**
   * Get saved images from database for a specific execution
   * @param {number} executionId - Database execution ID
   * @returns {Promise<Array>} Array of saved images with database IDs
   */
  async getSavedImagesForExecution(executionId) {
    try {
      console.log('🔍 DEBUG: getSavedImagesForExecution called with executionId:', executionId);
      console.log('🔍 DEBUG: this.backendAdapter exists:', !!this.backendAdapter);
      
      if (!this.backendAdapter || !executionId) {
        console.warn('⚠️ Cannot get saved images: missing backendAdapter or executionId');
        return [];
      }
      
      console.log(`🔍 Getting saved images for execution ${executionId}...`);
      const result = await this.backendAdapter.getAllGeneratedImages();
      console.log('🔍 DEBUG: getAllGeneratedImages result:', result);
      
      // Handle both response formats: direct array or {success, images} object
      let images = result;
      if (result && typeof result === 'object' && result.success !== undefined) {
        // Response is wrapped in {success, images} format
        images = result.images;
        console.log('🔍 DEBUG: result.success:', result.success);
        console.log('🔍 DEBUG: result.images is array:', Array.isArray(result.images));
        console.log('🔍 DEBUG: result.images length:', result.images ? result.images.length : 'undefined');
      } else {
        // Response is direct array
        console.log('🔍 DEBUG: result is direct array, length:', Array.isArray(result) ? result.length : 'not array');
      }
      
      if (Array.isArray(images)) {
        // Filter images for this specific execution
        console.log('🔍 DEBUG: About to filter images for executionId:', executionId);
        console.log('🔍 DEBUG: All images executionIds:', images.map(img => img.executionId));
        const executionImages = images.filter(img => img.executionId === executionId);
        console.log(`✅ Found ${executionImages.length} saved images for execution ${executionId}`);
        console.log('🔍 DEBUG: Filtered images:', executionImages);
        return executionImages;
      } else {
        console.warn('⚠️ Failed to get saved images - not an array:', images);
        return [];
      }
    } catch (error) {
      console.error('❌ Error getting saved images:', error);
      return [];
    }
  }

  /**
   * Run quality checks on images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async runQualityChecks(images, config) {
    const startTime = Date.now();
    try {
      this._logStructured({
        level: 'info',
        stepName: 'quality_check',
        subStep: 'start',
        message: `Starting quality checks for ${images.length} images`,
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          imageCount: images.length,
          openaiModel: config.parameters?.openaiModel || "gpt-4o",
          hasQualityCheckPrompt: !!config.ai?.qualityCheckPrompt
        }
      });
      


      
      for (const image of images) {
        if (this.isStopping) return;
        
        this._logStructured({
          level: 'info',
          stepName: 'quality_check',
          subStep: 'check_image',
          imageIndex: images.indexOf(image),
          message: `Running quality check on image ${images.indexOf(image) + 1}/${images.length}`,
          metadata: { 
            imagePath: image.finalImagePath,
            imageMappingId: image.imageMappingId,
            imageId: image.id
          }
        });
        

        
        let result;
        try {
          result = await aiVision.runQualityCheck(
            image.finalImagePath, // Use finalImagePath for database images
            config.parameters?.openaiModel || "gpt-4o",
            config.ai?.qualityCheckPrompt || null
          );
        } catch (aiError) {
          throw aiError;
        }
        
        if (result) {
          this._logStructured({
            level: 'info',
            stepName: 'quality_check',
            subStep: 'result',
            imageIndex: images.indexOf(image),
            message: `Quality check completed: ${result.passed ? 'PASSED' : 'FAILED'}`,
            metadata: { 
              passed: result.passed,
              reason: result.reason,
              imagePath: image.finalImagePath
            }
          });
          
          image.qualityDetails = result;
          
          // Update QC status in database based on quality check result
          if (this.backendAdapter && image.imageMappingId) {
            try {
              const qcStatus = result.passed ? "approved" : "failed";
              const qcReason = result.reason || (result.passed ? "Quality check passed" : "Quality check failed");
              
              this._logStructured({
                level: 'info',
                stepName: 'quality_check',
                subStep: 'db_update',
                imageIndex: images.indexOf(image),
                message: `Updating QC status in database: ${qcStatus}`,
                metadata: { 
                  qcStatus,
                  qcReason,
                  imageMappingId: image.imageMappingId
                }
              });
              
              await this.backendAdapter.updateQCStatusByMappingId(image.imageMappingId, qcStatus, qcReason);
              
              // Also update the local image object
              image.qcStatus = qcStatus;
              image.qcReason = qcReason;
            } catch (dbError) {
              this._logStructured({
                level: 'error',
                stepName: 'quality_check',
                subStep: 'db_error',
                imageIndex: images.indexOf(image),
                message: `Failed to update QC status in database: ${dbError.message}`,
                errorCode: 'QC_DB_UPDATE_ERROR',
                metadata: { 
                  error: dbError.message,
                  imageMappingId: image.imageMappingId
                }
              });
              

            }
          } else {
            this._logStructured({
              level: 'warn',
              stepName: 'quality_check',
              subStep: 'skip_db',
              imageIndex: images.indexOf(image),
              message: 'Skipping database update - missing backendAdapter or imageMappingId',
              metadata: { 
                hasBackendAdapter: !!this.backendAdapter,
                imageMappingId: image.imageMappingId
              }
            });
            

          }
        } else {
          this._logStructured({
            level: 'warn',
            stepName: 'quality_check',
            subStep: 'no_result',
            imageIndex: images.indexOf(image),
            message: 'Quality check returned no result',
            metadata: { imagePath: image.finalImagePath }
          });
          
          image.qualityDetails = { error: "Quality check failed" };
          
          // Update QC status to failed in database
          if (this.backendAdapter && image.imageMappingId) {
            try {
              this._logStructured({
                level: 'info',
                stepName: 'quality_check',
                subStep: 'db_update_failed',
                imageIndex: images.indexOf(image),
                message: 'Updating QC status to failed in database',
                metadata: { imageMappingId: image.imageMappingId }
              });
              
              await this.backendAdapter.updateQCStatusByMappingId(image.imageMappingId, "failed", "Quality check failed");
              
              // Also update the local image object
              image.qcStatus = "failed";
              image.qcReason = "Quality check failed";
            } catch (dbError) {
              this._logStructured({
                level: 'error',
                stepName: 'quality_check',
                subStep: 'db_error_failed',
                imageIndex: images.indexOf(image),
                message: `Failed to update QC status to failed in database: ${dbError.message}`,
                errorCode: 'QC_DB_UPDATE_FAILED_ERROR',
                metadata: { 
                  error: dbError.message,
                  imageMappingId: image.imageMappingId
                }
              });
              

            }
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'info',
        stepName: 'quality_check',
        subStep: 'complete',
        message: `Quality checks completed for all ${images.length} images`,
        durationMs: duration,
        updateProgress: true, // Update progress for step completion
        metadata: { 
          totalImages: images.length,
          successfulChecks: images.filter(img => img.qcStatus === 'approved').length,
          failedChecks: images.filter(img => img.qcStatus === 'failed').length
        }
      });
      
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'quality_check',
        subStep: 'error',
        message: `Quality checks failed: ${error.message}`,
        durationMs: duration,
        errorCode: 'QC_SYSTEM_ERROR',
        metadata: { 
          error: error.message,
          stack: error.stack,
          imageCount: images.length
        }
      });
      
      throw new Error(`Quality checks failed: ${error.message}`);
    }
  }

  /**
   * Generate metadata for images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async generateMetadata(images, config) {
    const startTime = Date.now();
    try {
      this._logStructured({
        level: 'info',
        stepName: 'metadata_generation',
        subStep: 'start',
        message: `Starting metadata generation for ${images.length} images`,
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          imageCount: images.length,
          openaiModel: config.parameters?.openaiModel || 'gpt-4o',
          hasMetadataPrompt: !!config.ai?.metadataPrompt
        }
      });
      
      for (const image of images) {
        if (this.isStopping) return;
        
        // Call the real metadata generation from aiVision module with correct signature
        const result = await aiVision.generateMetadata(
          image.path,
          image.metadata?.prompt || 'default image',
          config.ai?.metadataPrompt || null,
          config.parameters?.openaiModel || 'gpt-4o'
        );
        
        if (result) {
          image.metadata = {
            ...image.metadata,
            title: result.new_title,
            description: result.new_description,
            tags: result.uploadTags
          };
        } else {
          image.metadata = {
            ...image.metadata,
            error: 'Metadata generation failed'
          };
        }
      }
      
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'info',
        stepName: 'metadata_generation',
        subStep: 'complete',
        message: `Metadata generation completed for all ${images.length} images`,
        durationMs: duration,
        updateProgress: true, // Update progress for step completion
        metadata: { 
          totalImages: images.length,
          successfulMetadata: images.filter(img => !img.metadata?.error).length,
          failedMetadata: images.filter(img => img.metadata?.error).length
        }
      });
      
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'metadata_generation',
        subStep: 'error',
        message: `Metadata generation failed: ${error.message}`,
        durationMs: duration,
        errorCode: 'METADATA_GEN_ERROR',
        metadata: { 
          error: error.message,
          stack: error.stack,
          imageCount: images.length
        }
      });
      
      throw new Error(`Metadata generation failed: ${error.message}`);
    }
  }

  /**
   * Emit progress update
   * @param {string} step - Current step
   * @param {number} progress - Progress percentage
   * @param {string} message - Progress message
   */
  emitProgress(step, progress, message) {
    const progressUpdate = {
      jobId: this.jobState.id,
      step: step,
      progress: progress,
      message: message,
      timestamp: new Date(),
      details: {
        currentStep: step,
        completedSteps: [...this.completedSteps]
      }
    };

    this.jobState.currentStep = step;
    this.jobState.progress = progress;

    this.emit('progress', progressUpdate);
  }

  /**
   * Calculate progress based on completed steps
   * @param {Array} completedSteps - List of completed step names
   * @param {string} currentStep - Current step name
   * @returns {number} Progress percentage
   */
  calculateProgress(completedSteps, currentStep = null) {
    let totalWeight = 0;
    let completedWeight = 0;

    for (const step of PROGRESS_STEPS) {
      totalWeight += step.weight;
      if (completedSteps.includes(step.name)) {
        completedWeight += step.weight;
      } else if (currentStep === step.name) {
        // Add partial weight for current step
        completedWeight += step.weight * 0.5;
      }
    }

    return Math.round((completedWeight / totalWeight) * 100);
  }

  /**
   * Get current job status
   * @returns {Object} Job status object
   */
  getJobStatus() {
    const currentStepConfig = PROGRESS_STEPS.find(s => s.name === this.jobState.currentStep);
    const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.name === this.jobState.currentStep);
    
    return {
      state: this.jobState.status,
      currentJob: this.currentJob ? {
        id: this.jobState.id,
        status: this.jobState.status,
        startTime: this.jobState.startTime,
        progress: this.jobState.progress,
        currentStep: currentStepIndex + 1,
        totalSteps: PROGRESS_STEPS.length
      } : null,
      progress: this.jobState.progress / 100,
      currentStep: currentStepIndex + 1,
      totalSteps: PROGRESS_STEPS.length,
      startTime: this.jobState.startTime,
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining()
    };
  }

  /**
   * Get current job progress
   * @returns {Object} Job progress object
   */
  getJobProgress() {
    const currentStepConfig = PROGRESS_STEPS.find(s => s.name === this.jobState.currentStep);
    const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.name === this.jobState.currentStep);
    
    return {
      progress: this.jobState.progress / 100,
      currentStep: currentStepIndex + 1,
      totalSteps: PROGRESS_STEPS.length,
      stepName: currentStepConfig ? currentStepConfig.description : '',
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining()
    };
  }

  /**
   * Get job logs
   * @param {string} mode - 'standard' or 'debug'
   * @returns {Array} Array of log entries
   */
  getJobLogs(mode = 'standard') {
    // Return only the structured logs from _inMemoryLogs
    // Legacy "Currently executing" messages removed - they were not synchronized with actual progress
    if (!this._inMemoryLogs) {
      this._inMemoryLogs = [];
    }
    const logs = this._inMemoryLogs;
    
    // No more legacy progress messages - rely entirely on structured logging
    // which is properly synchronized with actual job execution

    if (this.jobState.error) {
      const msg = this.jobState.error;
      if (!logs.length || logs[logs.length - 1].message !== msg) {
        logs.push({
          id: (Date.now() + 1).toString(),
          timestamp: new Date(),
          level: 'error',
          message: msg,
          source: 'job-runner',
          // Add structured fields for backward compatibility
          stepName: this.jobState.currentStep || 'error',
          subStep: 'error',
          imageIndex: null,
          durationMs: null,
          errorCode: 'JOB_STATE_ERROR',
          metadata: { error: msg },
          progress: this.jobState.progress,
          totalImages: this.jobState.totalImages,
          successfulImages: this.jobState.successfulImages,
          failedImages: this.jobState.failedImages
        });
      }
    }

    // Filter logs based on mode
    // No more old-style progress heartbeat - structured logging handles all progress updates
    
    // Return a copy, filtered by mode
    const output = mode === 'standard' ? logs.filter(log => log.level !== 'debug') : logs;
    // Increase server-side cap so UI and export can include deeper traces
    return output.slice(-1000);
  }

  /**
   * Calculate estimated time remaining
   * @returns {number|null} Estimated time remaining in seconds
   */
  calculateEstimatedTimeRemaining() {
    if (this.jobState.status !== 'running' || !this.jobState.startTime) {
      return null;
    }

    const elapsed = (Date.now() - this.jobState.startTime.getTime()) / 1000;
    const progress = this.jobState.progress / 100;
    
    if (progress <= 0) {
      return null;
    }

    const totalEstimatedTime = elapsed / progress;
    return Math.max(0, totalEstimatedTime - elapsed);
  }
}

module.exports = { JobRunner };