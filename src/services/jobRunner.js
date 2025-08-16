const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { logDebug } = require('../utils/logDebug');

// Import existing CLI modules
const producePictureModule = require('../producePictureModule');
const paramsGeneratorModule = require('../paramsGeneratorModule');
const aiVision = require('../aiVision');

// Progress steps with weights
const PROGRESS_STEPS = [
  { name: 'initialization', weight: 5, description: 'Initializing job configuration' },
  { name: 'parameter_generation', weight: 15, description: 'Generating parameters from keywords' },
  { name: 'image_generation', weight: 50, description: 'Generating images with AI' },
  { name: 'background_removal', weight: 15, description: 'Removing backgrounds' },
  { name: 'quality_check', weight: 10, description: 'Running quality checks' },
  { name: 'metadata_generation', weight: 5, description: 'Generating metadata' }
];

class JobRunner extends EventEmitter {
  constructor() {
    super();
    this.currentJob = null;
    this.jobState = {
      id: null,
      status: 'idle',
      startTime: null,
      endTime: null,
      error: null,
      progress: 0,
      currentStep: null
    };
    this.completedSteps = [];
    this.isStopping = false;
  }

  /**
   * Start a new job with the given configuration
   * @param {Object} config - Job configuration object
   * @returns {Promise<Object>} Job result
   */
  async startJob(config) {
    try {
      console.log('🚀 JobRunner.startJob called with config:', config);
      
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
      
      this.jobState = {
        id: jobId,
        status: 'running',
        startTime: new Date(),
        endTime: null,
        error: null,
        progress: 0,
        currentStep: 'initialization'
      };
      this.completedSteps = [];
      this.isStopping = false;

      console.log('✅ Job state initialized:', this.jobState);

      // Emit progress update
      this.emitProgress('initialization', 0, 'Initializing job configuration...');

      // Set environment variables from config
      console.log('🔧 Setting environment variables...');
      try {
        console.log('🔧 About to call setEnvironmentFromConfig...');
        this.setEnvironmentFromConfig(config);
        console.log('🔧 setEnvironmentFromConfig completed successfully');
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
      console.log('🔧 MODULE LOAD: Starting backendAdapter initialization...');
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
      console.log('🎯 Starting job execution...');
      this.currentJob = this.executeJob(config, jobId);
      
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
    console.log('🔍 validateConfiguration called with config:', config);
    console.log('🔍 config.apiKeys:', config.apiKeys);
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
    console.log('🔧 Setting environment variables from config:', config.apiKeys);
    console.log('🔧 Before setting - Environment variables:');
    console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  - PIAPI_API_KEY:', process.env.PIAPI_API_KEY ? 'SET' : 'NOT SET');
    console.log('  - REMOVE_BG_API_KEY:', process.env.REMOVE_BG_API_KEY ? 'SET' : 'NOT SET');
    
    // Set API keys
    if (config.apiKeys.openai) {
      process.env.OPENAI_API_KEY = config.apiKeys.openai;
      console.log('✅ OpenAI API key set to:', config.apiKeys.openai.substring(0, 10) + '...');
    }
    if (config.apiKeys.piapi) {
      process.env.PIAPI_API_KEY = config.apiKeys.piapi;  // Fixed: was PIAPI_KEY
      console.log('✅ PiAPI key set to:', config.apiKeys.piapi.substring(0, 10) + '...');
    }
    if (config.apiKeys.removeBg) {
      process.env.REMOVE_BG_API_KEY = config.apiKeys.removeBg;
      console.log('✅ RemoveBG API key set to:', config.apiKeys.removeBg.substring(0, 10) + '...');
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
      console.log('🚀 Starting real job execution with config:', config);
      
      // Step 1: Parameter Generation
      if (this.isStopping) return;
      this.emitProgress('parameter_generation', 10, 'Generating parameters from keywords...');
      
      console.log('🔧 About to call generateParameters with config:', config);
      console.log('🔧 Config.parameters:', config.parameters);
      console.log('🔧 Config.parameters.aspectRatios:', config.parameters?.aspectRatios);
      
      // Call the real paramsGeneratorModule
      const parameters = await this.generateParameters(config);
      console.log('✅ Parameters generated:', parameters);
      console.log('✅ Parameters.aspectRatios:', parameters.aspectRatios);
      
      this.completedSteps.push('parameter_generation');
      this.emitProgress('parameter_generation', 15, 'Parameters generated successfully');

      // Step 2: Image Generation
      if (this.isStopping) return;
      this.emitProgress('image_generation', 25, 'Starting image generation...');
      
      // Call the real producePictureModule
      const images = await this.generateImages(config, parameters);
      console.log('✅ Images generated in executeJob:', images);
      console.log('✅ Images type:', typeof images);
      console.log('✅ Images length:', Array.isArray(images) ? images.length : 'Not an array');
      console.log('✅ Images structure:', JSON.stringify(images, null, 2));
      
      this.completedSteps.push('image_generation');
      this.emitProgress('image_generation', 75, 'Images generated successfully');

      // Step 3: Background Removal (if enabled)
      if (config.processing && config.processing.removeBg && !this.isStopping) {
        this.emitProgress('background_removal', 80, 'Removing backgrounds...');
        
        await this.removeBackgrounds(images, config);
        
        this.completedSteps.push('background_removal');
        this.emitProgress('background_removal', 90, 'Backgrounds removed successfully');
      }

      // Step 4: Quality Check (if enabled)
      if (config.ai && config.ai.runQualityCheck && !this.isStopping) {
        this.emitProgress('quality_check', 92, 'Running quality checks...');
        
        await this.runQualityChecks(images, config);
        
        this.completedSteps.push('quality_check');
        this.emitProgress('quality_check', 95, 'Quality checks completed');
      }

      // Step 5: Metadata Generation (if enabled)
      if (config.ai && config.ai.runMetadataGen && !this.isStopping) {
        this.emitProgress('metadata_generation', 97, 'Generating metadata...');
        
        await this.generateMetadata(images, config);
        
        this.completedSteps.push('metadata_generation');
        this.emitProgress('metadata_generation', 100, 'Metadata generated successfully');
      }

      // Job completed successfully
      this.jobState.status = 'completed';
      this.jobState.endTime = new Date();
      this.emitProgress('completed', 100, 'Job completed successfully');
      
      console.log('🎉 Job execution completed successfully!');

    } catch (error) {
      console.error('❌ Job execution error:', error);
      this.jobState.status = 'error';
      this.jobState.error = error.message;
      this.jobState.endTime = new Date();
      
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
    try {
      console.log('🔧 generateParameters called with config:', config);
      
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
      
      console.log('🔧 Extracted from config:');
      console.log('  - keywords:', keywords);
      console.log('  - aspectRatios:', aspectRatios);
      console.log('  - mjVersion:', mjVersion);
      
      // Call the real paramsGeneratorModule with correct signature
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
      
      console.log('✅ Parameters generated by module:', parameters);
      console.log('✅ Enhanced parameters with aspect ratios:', enhancedParameters);
      console.log('✅ FINAL aspectRatios being returned:', enhancedParameters.aspectRatios);
      return enhancedParameters;
      
    } catch (error) {
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
    try {
      console.log('🎨 Calling producePictureModule with parameters:', parameters);
      
      // Debug: Check what API keys are available
      console.log('🔑 Available API keys in config:', config.apiKeys);
      console.log('🔑 Environment variables:');
      console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
      console.log('  - PIAPI_API_KEY:', process.env.PIAPI_API_KEY ? 'SET' : 'NOT SET');
      console.log('  - REMOVE_BG_API_KEY:', process.env.REMOVE_BG_API_KEY ? 'SET' : 'NOT SET');
      
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
      
      console.log('🔧 Module config prepared:', moduleConfig);
      console.log('🔧 Aspect ratios being used:', moduleConfig.aspectRatios);
      
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
      
      console.log('🔧 Settings prepared for producePictureModule:', settings);
      
      const result = await producePictureModule.producePictureModule(
        settings, // Pass settings with API keys as first parameter
        imgNameBase,
        null, // customMetadataPrompt
        moduleConfig
      );
      
      console.log('✅ Images generated by module:', result);
      console.log('🔍 Result type:', typeof result);
      console.log('🔍 Result is array:', Array.isArray(result));
      console.log('🔍 Result length:', Array.isArray(result) ? result.length : 'N/A');
      console.log('🔍 Result structure:', JSON.stringify(result, null, 2));
      
      // The module returns an array of image objects, each with outputPath
      if (result && Array.isArray(result)) {
        console.log('🔧 Result is an array, processing', result.length, 'images');
        
        // Create separate image objects for each result
        const processedImages = result.map((item, index) => {
          console.log(`🔧 Processing image ${index}:`, item);
          console.log(`🔧 Item type:`, typeof item);
          console.log(`🔧 Item keys:`, Object.keys(item));
          // Extract the outputPath from each item
          const imagePath = item.outputPath || item.path || item;
          console.log(`🔧 Extracted path for image ${index}:`, imagePath);
          console.log(`🔧 Path type:`, typeof imagePath);
          
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
          
          console.log(`🔧 Using aspect ratio for image ${index}:`, aspectRatio);
          
          const imageObject = {
            path: imagePath,  // This should be a string path
            aspectRatio: aspectRatio,
            status: 'generated',
            metadata: { prompt: parameters.prompt }
          };
          console.log(`🔧 Created image object ${index}:`, imageObject);
          return imageObject;
        });
        
        console.log('🔧 Final processed images:', processedImages);
        console.log('🔧 Processed images length:', processedImages.length);
        console.log('🔧 First image path type:', typeof processedImages[0]?.path);
        console.log('🔧 First image path value:', processedImages[0]?.path);
        return processedImages;  // Return array of image objects
      } else if (result && typeof result === 'string') {
        // Fallback: single string path
        console.log('🔧 Result is a string, creating single image object');
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
      console.log('🔄 Starting background removal for', images.length, 'images');
      
      for (const image of images) {
        if (this.isStopping) return;
        
        console.log(`🔄 Removing background from: ${image.path}`);
        
        // Note: The producePictureModule doesn't have a separate removeBackground function
        // Background removal is integrated into the main process
        // For now, we'll skip this step and let the main module handle it
        console.log(`ℹ️ Background removal will be handled by producePictureModule for: ${image.path}`);
      }
      
      console.log('✅ Background removal step completed (handled by main module)');
      
    } catch (error) {
      console.error('❌ Error during background removal:', error);
      throw new Error(`Background removal failed: ${error.message}`);
    }
  }

  /**
   * Run quality checks on images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async runQualityChecks(images, config) {
    try {
      console.log('🔍 Starting quality checks for', images.length, 'images');
      console.log('🔍 Images array:', images);
      
      for (const image of images) {
        if (this.isStopping) return;
        
        console.log(`🔍 Running quality check on image:`, image);
        console.log(`🔍 Image path:`, image.path);
        console.log(`🔍 Image path type:`, typeof image.path);
        console.log(`🔍 Image path value:`, image.path);
        
        // Call the real quality check from aiVision module with correct signature
        const result = await aiVision.runQualityCheck(
          image.path,
          config.parameters?.openaiModel || 'gpt-4o',
          config.ai?.qualityCheckPrompt || null
        );
        
        if (result) {
          console.log(`✅ Quality check completed for: ${image.path}`, result);
          image.qualityScore = result.score || (result.passed ? 9 : 2);
          image.qualityDetails = result;
        } else {
          console.warn(`⚠️ Quality check failed for: ${image.path}`);
          image.qualityScore = 0;
          image.qualityDetails = { error: 'Quality check failed' };
        }
      }
      
      console.log('✅ Quality checks completed for all images');
      
    } catch (error) {
      console.error('❌ Error during quality checks:', error);
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
    try {
      console.log('📝 Starting metadata generation for', images.length, 'images');
      
      for (const image of images) {
        if (this.isStopping) return;
        
        console.log(`📝 Generating metadata for: ${image.path}`);
        
        // Call the real metadata generation from aiVision module with correct signature
        const result = await aiVision.generateMetadata(
          image.path,
          image.metadata?.prompt || 'default image',
          config.ai?.metadataPrompt || null,
          config.parameters?.openaiModel || 'gpt-4o'
        );
        
        if (result) {
          console.log(`✅ Metadata generated for: ${image.path}`, result);
          image.metadata = {
            ...image.metadata,
            title: result.new_title,
            description: result.new_description,
            tags: result.uploadTags
          };
        } else {
          console.warn(`⚠️ Metadata generation failed for: ${image.path}`);
          image.metadata = {
            ...image.metadata,
            error: 'Metadata generation failed'
          };
        }
      }
      
      console.log('✅ Metadata generation completed for all images');
      
    } catch (error) {
      console.error('❌ Error during metadata generation:', error);
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
    // This would typically come from a log service
    // For now, return mock logs based on current state
    const logs = [];
    
    if (this.jobState.status === 'running' && this.jobState.currentStep) {
      const currentStepConfig = PROGRESS_STEPS.find(s => s.name === this.jobState.currentStep);
      logs.push({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'info',
        message: `Currently executing: ${currentStepConfig ? currentStepConfig.description : this.jobState.currentStep}`,
        source: 'job-runner'
      });
    }

    if (this.jobState.error) {
      logs.push({
        id: (Date.now() + 1).toString(),
        timestamp: new Date(),
        level: 'error',
        message: this.jobState.error,
        source: 'job-runner'
      });
    }

    // Filter logs based on mode
    if (mode === 'standard') {
      return logs.filter(log => log.level !== 'debug');
    }
    
    return logs;
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
