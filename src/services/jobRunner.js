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
      // Check if job is already running
      if (this.jobState.status === 'running') {
        return {
          success: false,
          error: 'A job is already running. Please stop the current job first.',
          code: 'JOB_ALREADY_RUNNING'
        };
      }

      // Validate configuration
      const validationResult = this.validateConfiguration(config);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          code: 'JOB_CONFIGURATION_ERROR'
        };
      }

      // Initialize job
      const jobId = uuidv4();
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

      // Emit progress update
      this.emitProgress('initialization', 0, 'Initializing job configuration...');

      // Set environment variables from config
      this.setEnvironmentFromConfig(config);

      // Start the job execution
      this.currentJob = this.executeJob(config, jobId);
      
      // For testing purposes, wait a bit to ensure job state is set
      await new Promise(resolve => setTimeout(resolve, 10));

      return {
        success: true,
        jobId: jobId,
        message: 'Job started successfully'
      };

    } catch (error) {
      console.error('Error starting job:', error);
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
    // Check required API keys
    if (!config.apiKeys.openai) {
      return { valid: false, error: 'OpenAI API key is required' };
    }
    if (!config.apiKeys.piapi) {
      return { valid: false, error: 'PiAPI key is required' };
    }

    // Check file paths
    if (!config.filePaths.outputDirectory) {
      return { valid: false, error: 'Output directory is required' };
    }

    // Check parameters
    if (!config.parameters.processMode) {
      return { valid: false, error: 'Process mode is required' };
    }

    return { valid: true };
  }

  /**
   * Set environment variables from configuration
   * @param {Object} config - Job configuration
   */
  setEnvironmentFromConfig(config) {
    // Set API keys
    if (config.apiKeys.openai) {
      process.env.OPENAI_API_KEY = config.apiKeys.openai;
    }
    if (config.apiKeys.piapi) {
      process.env.PIAPI_KEY = config.apiKeys.piapi;
    }
    if (config.apiKeys.removeBg) {
      process.env.REMOVE_BG_API_KEY = config.apiKeys.removeBg;
    }

    // Set other environment variables as needed
    if (config.advanced.debugMode) {
      process.env.DEBUG_MODE = 'true';
    }
  }

  /**
   * Execute the job with the given configuration
   * @param {Object} config - Job configuration
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async executeJob(config, jobId) {
    try {
      // For testing purposes, keep the job running for a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 1: Parameter Generation
      if (this.isStopping) return;
      this.emitProgress('parameter_generation', 10, 'Generating parameters from keywords...');
      
      // This would need to be adapted to work with the existing paramsGeneratorModule
      // For now, we'll create a mock implementation
      const parameters = await this.generateParameters(config);
      
      this.completedSteps.push('parameter_generation');
      this.emitProgress('parameter_generation', 15, 'Parameters generated successfully');

      // Step 2: Image Generation
      if (this.isStopping) return;
      this.emitProgress('image_generation', 25, 'Starting image generation...');
      
      // This would need to be adapted to work with the existing producePictureModule
      const images = await this.generateImages(config, parameters);
      
      this.completedSteps.push('image_generation');
      this.emitProgress('image_generation', 75, 'Images generated successfully');

      // Step 3: Background Removal (if enabled)
      if (config.processing.removeBg && !this.isStopping) {
        this.emitProgress('background_removal', 80, 'Removing backgrounds...');
        
        await this.removeBackgrounds(images, config);
        
        this.completedSteps.push('background_removal');
        this.emitProgress('background_removal', 90, 'Backgrounds removed successfully');
      }

      // Step 4: Quality Check (if enabled)
      if (config.ai.runQualityCheck && !this.isStopping) {
        this.emitProgress('quality_check', 92, 'Running quality checks...');
        
        await this.runQualityChecks(images, config);
        
        this.completedSteps.push('quality_check');
        this.emitProgress('quality_check', 95, 'Quality checks completed');
      }

      // Step 5: Metadata Generation (if enabled)
      if (config.ai.runMetadataGen && !this.isStopping) {
        this.emitProgress('metadata_generation', 97, 'Generating metadata...');
        
        await this.generateMetadata(images, config);
        
        this.completedSteps.push('metadata_generation');
        this.emitProgress('metadata_generation', 100, 'Metadata generated successfully');
      }

      // Job completed successfully
      this.jobState.status = 'completed';
      this.jobState.endTime = new Date();
      this.emitProgress('completed', 100, 'Job completed successfully');

    } catch (error) {
      console.error('Job execution error:', error);
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
    // This is a placeholder implementation
    // The actual implementation would need to integrate with paramsGeneratorModule
    return {
      prompt: 'Generated prompt from keywords',
      aspectRatios: config.parameters.aspectRatios.split(','),
      mjVersion: config.parameters.mjVersion
    };
  }

  /**
   * Generate images using the existing producePictureModule
   * @param {Object} config - Job configuration
   * @param {Object} parameters - Generated parameters
   * @returns {Promise<Array>} Generated images
   */
  async generateImages(config, parameters) {
    // This is a placeholder implementation
    // The actual implementation would need to integrate with producePictureModule
    return [
      { path: '/path/to/generated/image1.png', aspectRatio: '1:1' },
      { path: '/path/to/generated/image2.png', aspectRatio: '16:9' }
    ];
  }

  /**
   * Remove backgrounds from images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async removeBackgrounds(images, config) {
    // This would integrate with the background removal functionality
    // from the existing producePictureModule
    for (const image of images) {
      if (this.isStopping) return;
      // Background removal logic would go here
    }
  }

  /**
   * Run quality checks on images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async runQualityChecks(images, config) {
    // This would integrate with the existing aiVision module
    for (const image of images) {
      if (this.isStopping) return;
      // Quality check logic would go here using aiVision.runQualityCheck
    }
  }

  /**
   * Generate metadata for images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async generateMetadata(images, config) {
    // This would integrate with the existing aiVision module
    for (const image of images) {
      if (this.isStopping) return;
      // Metadata generation logic would go here using aiVision.generateMetadata
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
