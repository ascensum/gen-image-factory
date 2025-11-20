const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const { logDebug } = require('../utils/logDebug');

// Import existing CLI modules
const producePictureModule = require('../producePictureModule');
const paramsGeneratorModule = require('../paramsGeneratorModule');
const aiVision = require('../aiVision');

// Base progress steps - clean 2-step structure
const BASE_PROGRESS_STEPS = [
  { name: 'initialization', weight: 20, description: 'Initializing job configuration and setup', required: true },
  { name: 'image_generation', weight: 80, description: 'Generating images with all processing and metadata', required: true }
];

// Dynamic progress steps based on job configuration
let PROGRESS_STEPS = BASE_PROGRESS_STEPS;

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
      failedImages: 0,
      gensDone: 0,
      totalGenerations: Math.max(1, Number(options?.parameters?.count || 1))
    };
    this.completedSteps = [];
    this.isStopping = false;
    this.isRerun = options.isRerun || false; // Flag to prevent duplicate database saves during reruns
    this.jobConfiguration = null; // Store the actual job configuration
    this.persistedLabel = null; // Track the label we save on job start to avoid overwrites
    
    // Initialize PROGRESS_STEPS with default configuration to ensure proper step count
    // This prevents getJobStatus from returning incorrect totalSteps when idle
    PROGRESS_STEPS = this._getEnabledProgressSteps({});
    
    // Set global reference so logDebug can find us
    global.currentJobRunner = this;
  }

  /**
   * Utility: wrap a promise with a timeout to avoid indefinite hangs
   * @param {Promise<any>} promise
   * @param {number} timeoutMs
   * @param {string} message
   * @returns {Promise<any>}
   */
  async withTimeout(promise, timeoutMs, message = 'Operation timed out') {
    if (!Number.isFinite(Number(timeoutMs)) || timeoutMs <= 0) {
      return promise;
    }
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Per-generation orchestration to support partial success
   */
  async _generateImagesPerGeneration(config, parameters, generations) {
    const startTime = Date.now();
    try {
      // Compute expected variations per generation dynamically; no fixed "4 per gen" legacy
      const allProcessed = [];
      let expectedTotalAcrossGens = 0;

      for (let genIndex = 0; genIndex < generations; genIndex += 1) {
        // Determine expected variations for this generation (clamped)
        const requestedVariationsCfg = Math.max(1, Number((config.parameters && config.parameters.variations) || 1));
        const maxVariationsAllowed = Math.max(1, Math.min(20, Math.floor(10000 / Math.max(1, generations))));
        const effectiveVariationsForGen = Math.min(requestedVariationsCfg, maxVariationsAllowed);
        expectedTotalAcrossGens += effectiveVariationsForGen;

        // Re-generate parameters per generation to rotate keywords/prompts
        let genParameters;
        try {
          const cfgForGen = { ...config, __forceSequentialIndex: genIndex, __perGen: true };
          genParameters = await this.generateParameters(cfgForGen);
          this._logStructured({
            level: 'info',
            stepName: 'initialization',
            subStep: 'parameter_generation_per_gen',
            message: `Parameters generated for generation ${genIndex + 1}/${generations}`,
            metadata: { generationIndex: genIndex, hasPrompt: !!genParameters?.prompt }
          });
        } catch (paramErr) {
          this._logStructured({
            level: 'error',
            stepName: 'initialization',
            subStep: 'parameter_generation_per_gen_error',
            message: `Parameter generation failed for generation ${genIndex + 1}: ${paramErr.message}`,
            errorCode: 'PARAM_GEN_ERROR',
            metadata: { generationIndex: genIndex }
          });
          // If parameter generation fails for this generation, all its variations are considered failed
          this.jobState.failedImages = (this.jobState.failedImages || 0) + effectiveVariationsForGen;
          continue;
        }

        const imgNameBase = `job_${Date.now()}_${genIndex}`;
        const settings = {
          prompt: genParameters.prompt,
          promptContext: genParameters.promptContext,
          apiKeys: config.apiKeys,
          // Pass through full parameters so provider-specific fields are available
          parameters: { ...(config.parameters || {}) }
        };

        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'call_module',
          message: `Calling producePictureModule (generation ${genIndex + 1}/${generations})`,
          metadata: { imgNameBase, prompt: parameters.prompt, hasApiKeys: !!config.apiKeys }
        });

        let result;
        const maxRetries = Math.max(0, Number(config.parameters?.generationRetryAttempts ?? 1));
        const backoffMs = Math.max(0, Number(config.parameters?.generationRetryBackoffMs ?? 0));
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            if (attempt > 0) {
              this._logStructured({
                level: 'info',
                stepName: 'image_generation',
                subStep: 'generation_retry',
                message: `Retrying generation ${genIndex + 1} (attempt ${attempt}/${maxRetries})`,
                metadata: { generationIndex: genIndex, attempt, maxRetries }
              });
              if (backoffMs > 0) {
                await new Promise(r => setTimeout(r, backoffMs));
              }
            }
            // Build module config with per-generation context and Runware parameters
            const cfgForGen = { ...config, __forceSequentialIndex: genIndex, __perGen: true };
            // Enforce total images cap: generations × variations ≤ 10000 (variations 1–20)
            const requestedVariations = Math.max(1, Math.min(20, Number(cfgForGen.parameters?.variations || 1)));
            const maxAllowed = Math.max(1, Math.min(20, Math.floor(10000 / Math.max(1, generations))));
            const effectiveVariations = Math.min(requestedVariations, maxAllowed);
            if (effectiveVariations !== requestedVariations) {
              this._logStructured({
                level: 'warn',
                stepName: 'image_generation',
                subStep: 'clamp_total_cap',
                message: `Clamped variations from ${requestedVariations} to ${effectiveVariations} to satisfy total images cap (≤ 10000)`,
                metadata: { generations, requestedVariations, effectiveVariations }
              });
            }
            const moduleConfig = {
              ...this._buildModuleConfig(cfgForGen, genParameters),
              generationIndex: genIndex,
              variations: effectiveVariations,
              // Surface Runware-specific params also on config for module convenience
              runwareDimensionsCsv: (config.parameters && config.parameters.runwareDimensionsCsv) || ''
            };

            result = await producePictureModule.producePictureModule(
              settings,
              imgNameBase,
              (config.ai && config.ai.metadataPrompt) ? config.ai.metadataPrompt : null,
              moduleConfig
            );
            if (attempt > 0) {
              this._logStructured({
                level: 'info',
                stepName: 'image_generation',
                subStep: 'generation_retry_success',
                message: `Generation ${genIndex + 1} succeeded after retry (attempt ${attempt})`,
                metadata: { generationIndex: genIndex, attempt }
              });
            }
            break;
          } catch (genErr) {
            const isLast = attempt === maxRetries;
            this._logStructured({
              level: 'error',
              stepName: 'image_generation',
              subStep: isLast ? 'generation_error' : 'generation_retry_error',
              message: `Generation ${genIndex + 1} ${isLast ? 'failed' : 'retry failed'}: ${genErr.message}`,
              errorCode: 'IMAGE_GEN_ERROR',
              metadata: { generationIndex: genIndex, attempt, maxRetries }
            });
            if (isLast) {
              this.jobState.failedImages = (this.jobState.failedImages || 0) + imagesPerTask;
            } else {
              continue;
            }
          }
        }
        if (typeof result === 'undefined') {
          // All attempts failed; move to next generation
          continue;
        }

        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'module_result',
          message: `Generation ${genIndex + 1} returned ${Array.isArray(result) ? result.length : 1} images`,
          metadata: { resultType: typeof result, isArray: Array.isArray(result), resultLength: Array.isArray(result) ? result.length : 'N/A' }
        });

        if (Array.isArray(result)) {
          const processedImages = result.map((item, index) => this._buildImageObject(item, genParameters, index, genIndex, result.length));
          allProcessed.push(...processedImages);
          this.jobState.totalImages = (this.jobState.totalImages || 0) + processedImages.length;
          this.jobState.generatedImages = (this.jobState.generatedImages || 0) + processedImages.length;
          // Update gensDone for UI overall progress (1/N)
          this.jobState.gensDone = Math.max(this.jobState.gensDone || 0, genIndex + 1);
        } else if (typeof result === 'string') {
          const single = [{ path: result, aspectRatio: genParameters.aspectRatios?.[0] || '1:1', status: 'generated', metadata: { prompt: genParameters.prompt } }];
          allProcessed.push(...single);
          this.jobState.totalImages = (this.jobState.totalImages || 0) + 1;
          this.jobState.generatedImages = (this.jobState.generatedImages || 0) + 1;
          this.jobState.gensDone = Math.max(this.jobState.gensDone || 0, genIndex + 1);
        } else if (result && typeof result === 'object' && Array.isArray(result.processedImages)) {
          // New structured result: { processedImages, failedItems }
          const processedImages = result.processedImages.map((item, index) => this._buildImageObject(item, genParameters, index, genIndex, result.processedImages.length));
          allProcessed.push(...processedImages);
          this.jobState.totalImages = (this.jobState.totalImages || 0) + processedImages.length;
          this.jobState.generatedImages = (this.jobState.generatedImages || 0) + processedImages.length;
          this.jobState.gensDone = Math.max(this.jobState.gensDone || 0, genIndex + 1);
          // Persist per-image failures so they appear in review even if job later fails
          try {
            const failures = Array.isArray(result.failedItems) ? result.failedItems : [];
            if (this.backendAdapter && this.databaseExecutionId && failures.length > 0) {
              const effectiveProc = (this.jobConfiguration && this.jobConfiguration.processing) ? this.jobConfiguration.processing : (config.processing || {});
              for (const f of failures) {
                if (!f || !f.mappingId) continue;
                const generatedImage = {
                  imageMappingId: f.mappingId,
                  executionId: this.databaseExecutionId,
                  generationPrompt: genParameters.prompt || 'Generated image',
                  seed: null,
                  qcStatus: 'qc_failed',
                  qcReason: `processing_failed:${f.stage || 'processing'}`,
                  tempImagePath: null,
                  finalImagePath: null,
                  metadata: JSON.stringify({ failure: { stage: f.stage, vendor: f.vendor, message: f.message } }),
                  processingSettings: JSON.stringify({
                    sharpening: Number.isFinite(Number(effectiveProc.sharpening)) ? Number(effectiveProc.sharpening) : 0,
                    saturation: Number.isFinite(Number(effectiveProc.saturation)) ? Number(effectiveProc.saturation) : 1.0,
                    imageEnhancement: !!effectiveProc.imageEnhancement,
                    imageConvert: !!effectiveProc.imageConvert,
                    convertToJpg: !!effectiveProc.convertToJpg,
                    convertToWebp: !!effectiveProc.convertToWebp,
                    jpgQuality: Number.isFinite(Number(effectiveProc.jpgQuality)) ? Number(effectiveProc.jpgQuality) : 100,
                    pngQuality: Number.isFinite(Number(effectiveProc.pngQuality)) ? Number(effectiveProc.pngQuality) : 100,
                    webpQuality: Number.isFinite(Number(effectiveProc.webpQuality)) ? Number(effectiveProc.webpQuality) : 85,
                    removeBg: !!effectiveProc.removeBg,
                    trimTransparentBackground: !!effectiveProc.trimTransparentBackground,
                    jpgBackground: effectiveProc.jpgBackground || 'white',
                    removeBgSize: effectiveProc.removeBgSize || 'auto'
                  })
                };
                await this.backendAdapter.saveGeneratedImage(generatedImage);
              }
            }
          } catch (_persistFailureErr) {
            // Non-fatal: continue
          }
        } else {
          // Treat entire generation as failed for this gen's expected variations
          this.jobState.failedImages = (this.jobState.failedImages || 0) + effectiveVariationsForGen;
          this._logStructured({ level: 'error', stepName: 'image_generation', subStep: 'invalid_result', message: `Invalid generation result format (generation ${genIndex + 1})` });
        }
      }

      if (allProcessed.length === 0) {
        throw new Error('No images were generated across all generations');
      }

      // Final reconciliation based on actual expected count across generations (sum of per-gen effective variations)
      const generatedTotal = this.jobState.generatedImages || allProcessed.length;
      const expectedTotal = expectedTotalAcrossGens > 0 ? expectedTotalAcrossGens : generatedTotal;
      this.jobState.totalImages = expectedTotal;
      this.jobState.failedImages = Math.max(0, expectedTotal - generatedTotal);

      const durationSummary = Date.now() - startTime;
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'complete',
        message: `Image generation completed: ${generatedTotal}/${expectedTotal} images across ${generations} generation(s)`,
        durationMs: durationSummary,
        updateProgress: true,
        metadata: { totalImages: generatedTotal, expectedTotal, failedImages: this.jobState.failedImages }
      });

      return allProcessed;
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({ level: 'error', stepName: 'image_generation', subStep: 'error', message: `Image generation failed: ${error.message}`, durationMs: duration, errorCode: 'IMAGE_GEN_ERROR' });
      throw new Error(`Failed to generate images: ${error.message}`);
    }
  }

  _buildModuleConfig(config, parameters) {
    const processingEnabled = !(config.ai?.runQualityCheck === true);
    return {
      removeBg: processingEnabled ? (config.processing?.removeBg || false) : false,
      imageConvert: processingEnabled ? (config.processing?.imageConvert || false) : false,
      convertToJpg: processingEnabled ? (config.processing?.convertToJpg || false) : false,
      convertToWebp: processingEnabled ? (config.processing?.convertToWebp || false) : false,
      trimTransparentBackground: processingEnabled ? (config.processing?.trimTransparentBackground || false) : false,
      aspectRatios: Array.isArray(parameters.aspectRatios) ? parameters.aspectRatios : (Array.isArray(config.parameters?.aspectRatios) ? config.parameters.aspectRatios : (typeof config.parameters?.aspectRatios === 'string' ? [config.parameters.aspectRatios] : ['1:1'])),
      pollingTimeout: config.parameters?.enablePollingTimeout ? (config.parameters?.pollingTimeout || 15) : null,
      pollingInterval: config.parameters?.pollingInterval || 1,
      processMode: config.parameters?.processMode || 'single',
      removeBgSize: processingEnabled ? (config.processing?.removeBgSize || 'preview') : 'preview',
      runQualityCheck: config.ai?.runQualityCheck || false,
      // Always handle metadata in JobRunner after images are persisted
      runMetadataGen: false,
      imageEnhancement: processingEnabled ? (config.processing?.imageEnhancement || false) : false,
      sharpening: processingEnabled ? (config.processing?.sharpening || 0) : 0,
      saturation: processingEnabled ? (config.processing?.saturation || 1) : 1,
      jpgBackground: processingEnabled ? (config.processing?.jpgBackground || 'white') : 'white',
      jpgQuality: processingEnabled ? (config.processing?.jpgQuality || 85) : 85,
      pngQuality: processingEnabled ? (config.processing?.pngQuality || 100) : 100,
      webpQuality: processingEnabled ? (config.processing?.webpQuality || 85) : 85,
      outputDirectory: config.filePaths?.tempDirectory || './pictures/generated',
      tempDirectory: config.filePaths?.tempDirectory || './pictures/generated'
    };
  }

  _buildImageObject(item, parameters, index, genIndex, total) {
    this._logStructured({
      level: 'info', stepName: 'ai_operations', subStep: 'process_image', imageIndex: index,
      message: `Processing image ${index + 1}/${total} (generation ${genIndex + 1})`, updateProgress: index === 0,
      metadata: { itemType: typeof item, itemKeys: Object.keys(item), mappingId: item.mappingId, currentImageProgress: Math.round(((index + 1) / total) * 100) }
    });

    const imagePath = item.outputPath || item.path || item;
    let aspectRatio = '1:1';
    if (parameters.aspectRatios && parameters.aspectRatios.length > 0) {
      aspectRatio = parameters.aspectRatios.length === 1 ? parameters.aspectRatios[0] : parameters.aspectRatios[index % parameters.aspectRatios.length];
    }

    return {
      path: imagePath,
      aspectRatio,
      status: 'generated',
      metadata: {
        prompt: parameters.prompt,
        ...(item.settings?.title?.title && { title: item.settings.title.title }),
        ...(item.settings?.title?.description && { description: item.settings.title.description }),
        ...(item.settings?.uploadTags && { uploadTags: item.settings.uploadTags })
      },
      mappingId: item.mappingId || `img_${Date.now()}_${genIndex}_${index}`
    };
  }
    /**
   * Get enabled progress steps - simplified for 2-step structure
   * @param {Object} config - Job configuration (not used in simplified version)
   * @returns {Array} Always returns the 2 base progress steps
   */
  _getEnabledProgressSteps(config) {
    // Always return the 2 base steps - they're all required
    return BASE_PROGRESS_STEPS;
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
      message = '',
      metadata = {}
    } = options;

    // Create structured log entry for UI
    const structuredLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      level,
      message,
      source: 'job-runner',
      stepName,
      subStep,
      metadata
    };

    // Add to in-memory logs for UI display
    if (!this._inMemoryLogs) {
      this._inMemoryLogs = [];
    }
    this._inMemoryLogs.push(structuredLog);

    // Emit event for real-time listeners (UI logs)
    this.emit('log', structuredLog);

    // Also log to console
    switch (level) {
      case 'debug':
        console.debug('', message);
        break;
      case 'info':
        console.info('️', message);
        break;
      case 'warn':
        console.warn('️', message);
        break;
      case 'error':
        console.error('', message);
        break;
      default:
        console.log('', message);
    }

    return structuredLog;
  }

  _sanitizeMetadata(metadata) {
    // Simple sanitization - just return the metadata as-is for now
    return metadata;
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
        console.log('️ Job already running, cannot start new job');
        return {
          success: false,
          error: 'A job is already running. Please stop the current job first.',
          code: 'JOB_ALREADY_RUNNING'
        };
      }

      console.log(' No job currently running, proceeding...');
      
      // Validate configuration
      console.log(' Validating configuration...');
      const validationResult = this.validateConfiguration(config);
      if (!validationResult.valid) {
        console.log(' Configuration validation failed:', validationResult.error);
        return {
          success: false,
          error: validationResult.error,
          code: 'JOB_CONFIGURATION_ERROR'
        };
      }
      console.log(' Configuration validation passed');

      // Normalize processing sub-object if present
      try {
        if (config && config.processing) {
          const { normalizeProcessingSettings } = require('../utils/processing');
          config.processing = normalizeProcessingSettings(config.processing);
        }
      } catch (e) {
        // Continue without fatal error
      }

      // Load custom QC and Metadata prompt templates from files for regular jobs/reruns
      try {
        // Ensure ai object exists
        config.ai = config.ai || {};
        if (config.filePaths?.qualityCheckPromptFile) {
          try {
            const qcText = await fs.readFile(config.filePaths.qualityCheckPromptFile, 'utf8');
            if (qcText && qcText.trim() !== '') {
              config.ai.qualityCheckPrompt = qcText;
            }
          } catch (e) {
            console.warn('JobRunner: Failed to load qualityCheckPromptFile:', e.message);
          }
        }
        if (config.filePaths?.metadataPromptFile) {
          try {
            const mdText = await fs.readFile(config.filePaths.metadataPromptFile, 'utf8');
            if (mdText && mdText.trim() !== '') {
              config.ai.metadataPrompt = mdText;
            }
          } catch (e) {
            console.warn('JobRunner: Failed to load metadataPromptFile:', e.message);
          }
        }
      } catch (e) {
        console.warn('JobRunner: prompt template load skipped:', e.message);
      }

      // Initialize job
      const jobId = uuidv4();
      console.log(' Generated job ID:', jobId);
      
      // Preserve completed status from previous job if it exists
      const wasCompleted = this.jobState.status === 'completed';

      
      // PRESERVE the configurationId that was set by backendAdapter!
      const preservedConfigurationId = this.configurationId;
      console.log(' PRESERVING configurationId:', preservedConfigurationId);
      
      this.jobState = {
        id: jobId,
        status: 'running',
        startTime: new Date(),
        endTime: null,
        error: null,
        progress: 0,
        currentStep: 'initialization',
        totalImages: 0,
        generatedImages: 0,      // Renamed from successfulImages for clarity
        failedImages: 0,
        gensDone: 0,
        totalGenerations: Math.max(1, Number(config?.parameters?.count || 1))
      };
      this.completedSteps = [];
      this.isStopping = false;
      
      // RESTORE the configurationId after resetting jobState
      this.configurationId = preservedConfigurationId;
      console.log(' RESTORED configurationId:', this.configurationId);
      
      // If previous job was completed, log it for debugging
      if (wasCompleted) {

      }

      console.log(' Job state initialized:', this.jobState);

      // Emit progress update
      this.emitProgress('initialization', 0, 'Initializing job configuration...');

      // Set environment variables from config
      try {
        this.setEnvironmentFromConfig(config);
  
      } catch (error) {
        console.error(' Error in setEnvironmentFromConfig:', error);
        console.error(' Error stack:', error.stack);
        throw error; // Re-throw to prevent silent failure
      }

      // Initialize backend adapter

      try {
        // Try to get the backend adapter instance
        // Instead of creating a new instance, try to get the existing one
        // This avoids IPC handler conflicts
        
        // Try to get the existing backend adapter from the parent process
        // Since we are in the main process, we can access the existing instance
        if (process.mainModule && process.mainModule.exports && process.mainModule.exports.backendAdapter) {
          this.backendAdapter = process.mainModule.exports.backendAdapter;
          console.log(" MODULE LOAD: Using existing main process backend adapter");
        } else if (global.backendAdapter) {
          this.backendAdapter = global.backendAdapter;
          console.log(" MODULE LOAD: Using existing global backend adapter");
        } else {
          this.backendAdapter = null;
        }
        
        if (this.backendAdapter) {
          console.log(" MODULE LOAD: Database integration enabled - job executions will be saved");
        } else {
          console.warn("️ MODULE LOAD: No backend adapter available - job executions will not be saved to database");
        }
      } catch (error) {
        console.error(' MODULE LOAD: Could not initialize backend adapter for database integration:', error);
        console.error(' MODULE LOAD: Error stack:', error.stack);
        console.warn(' MODULE LOAD: Job executions will not be saved to database');
        console.warn(' MODULE LOAD: Frontend will continue to show no data');
      }

      // Store the job configuration for progress step filtering
      this.jobConfiguration = config;
      
      
      // Update progress steps based on job configuration
      PROGRESS_STEPS = this._getEnabledProgressSteps(config);
      
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
          isRerun: this.isRerun,
          enabledSteps: PROGRESS_STEPS.map(s => s.name),
          totalSteps: PROGRESS_STEPS.length
        }
      });
      
      // If rerun flag is set but no execution id passed in from backend, clear rerun state for normal job
      if (this.isRerun && (this.databaseExecutionId === null || this.databaseExecutionId === undefined)) {
        console.log(' Rerun flag cleared: no databaseExecutionId set for rerun, proceeding as normal job');
        this.isRerun = false;
        this.persistedLabel = null;
      }

      this.currentJob = this.executeJob(config, jobId);
      // Save job execution to database if backendAdapter is available
      // BUT NOT during reruns (reruns are handled by the backend rerun handler)
      if (this.backendAdapter && !this.isRerun) {
        try {
          console.log(" Saving job execution to database...");
          // Compute a persisted fallback label if none provided
          const providedLabel = (config && config.parameters && typeof config.parameters.label === 'string')
            ? config.parameters.label.trim()
            : '';
          // BackendAdapter now injects a fallback label into config.parameters.label when missing.
          const fallbackLabel = providedLabel !== '' ? providedLabel : `job_${Date.now()}`;

          const jobExecution = {
            configurationId: this.configurationId || null, // Use the configuration ID passed from backendAdapter
            startedAt: this.jobState.startTime,
            completedAt: null,
            status: "running",
            totalImages: 0,
            successfulImages: 0,
            failedImages: 0,
            errorMessage: null,
            label: providedLabel !== '' ? providedLabel : fallbackLabel,
            // Persist execution-level snapshot of effective settings (without API keys)
            configurationSnapshot: (() => {
              try {
                const { apiKeys, ...sanitized } = (config || {});
                if (sanitized && sanitized.parameters) {
                  const adv = sanitized.parameters.runwareAdvanced || {};
                  const flag = sanitized.parameters.runwareAdvancedEnabled;
                  const advEnabled = (flag === true)
                    ? true
                    : (flag === false)
                      ? false
                      : Boolean(
                          adv && (
                            adv.CFGScale != null ||
                            adv.steps != null ||
                            (adv.scheduler && String(adv.scheduler).trim() !== '') ||
                            adv.checkNSFW === true ||
                            (Array.isArray(adv.lora) && adv.lora.length > 0)
                          )
                        );
                  sanitized.parameters.runwareAdvancedEnabled = advEnabled;
                }
                return sanitized || null;
              } catch {
                return null;
              }
            })()
          };
          // Remember the label we persisted so later updates do not clear it
          this.persistedLabel = jobExecution.label;
          
          const saveResult = await this.backendAdapter.saveJobExecution(jobExecution);
          console.log(" Job execution saved to database:", saveResult);
          console.log(" saveResult type:", typeof saveResult);
          console.log(" saveResult keys:", Object.keys(saveResult));
          console.log(" saveResult.success:", saveResult.success);
          console.log(" saveResult.id:", saveResult.id);
          
          // Store the database execution ID for later use
          if (saveResult.success && saveResult.id) {
            this.databaseExecutionId = saveResult.id;
            console.log(' Stored database execution ID:', this.databaseExecutionId);
            console.log(' this.databaseExecutionId after assignment:', this.databaseExecutionId);
          } else {
            console.warn('️ saveResult missing required fields:', saveResult);
          }
        } catch (error) {
          console.error(" Failed to save job execution to database:", error);
        }
      } else if (this.isRerun) {
        console.log(" Rerun mode - skipping JobRunner database save (handled by backend rerun handler)");
      } else {
        console.warn("️ No backendAdapter available - job execution will not be saved to database");
      }
      
      
      // For testing purposes, wait a bit to ensure job state is set
      await new Promise(resolve => setTimeout(resolve, 10));

      console.log(' Job started successfully, returning result');
      return {
        success: true,
        jobId: jobId,
        message: 'Job started successfully'
      };

    } catch (error) {
      console.error(' Error starting job in JobRunner:', error);
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
      this.jobState.status = 'failed';
      this.jobState.endTime = new Date();
      // Persist failure to DB immediately
      try {
        if (this.backendAdapter && this.databaseExecutionId) {
          await this.backendAdapter.updateJobExecution(this.databaseExecutionId, {
            configurationId: this.configurationId,
            startedAt: this.jobState.startTime,
            completedAt: this.jobState.endTime,
            status: 'failed',
            totalImages: this.jobState.totalImages || 0,
            successfulImages: this.jobState.generatedImages || 0,
            failedImages: this.jobState.failedImages || 0,
            errorMessage: 'Stopped by user',
            label: this.persistedLabel || null
          });
        }
      } catch (e) {
        console.warn('️ Failed to persist stop status:', e?.message || e);
      }
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
    this.jobState.status = 'failed';
    this.jobState.endTime = new Date();
    this.currentJob = null;
    // Abort in-flight operations immediately
    try {
      if (this.abortController && typeof this.abortController.abort === 'function') {
        this.abortController.abort(new Error('Force-stopped by user'));
      }
    } catch (_e) {}
    // Persist failure to DB immediately
    try {
      if (this.backendAdapter && this.databaseExecutionId) {
        await this.backendAdapter.updateJobExecution(this.databaseExecutionId, {
          configurationId: this.configurationId,
          startedAt: this.jobState.startTime,
          completedAt: this.jobState.endTime,
          status: 'failed',
          totalImages: this.jobState.totalImages || 0,
          successfulImages: this.jobState.generatedImages || 0,
          failedImages: this.jobState.failedImages || 0,
          errorMessage: 'Force-stopped by user',
          label: this.persistedLabel || null
        });
      }
    } catch (e) {
      console.warn('️ Failed to persist force-stop status:', e?.message || e);
    }
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
    console.log(' validateConfiguration called');
    // Never log raw API keys
    // do not log apiKeys presence explicitly
    console.log(' config.filePaths:', config.filePaths);
    console.log(' config.parameters:', config.parameters);
    
    // Check required API keys
    if (!config.apiKeys || !config.apiKeys.openai) {
      console.log(' Required credential missing: openai');
      return { valid: false, error: 'OpenAI API key is required' };
    }
    if (!config.apiKeys.runware) {
      console.log(' Required credential missing: runware');
      return { valid: false, error: 'Runware API key is required' };
    }

    // Check file paths
    if (!config.filePaths || !config.filePaths.outputDirectory) {
      console.log(' Output directory missing');
      return { valid: false, error: 'Output directory is required' };
    }

    // Check parameters
    if (!config.parameters || !config.parameters.processMode) {
      console.log(' Process mode missing');
      return { valid: false, error: 'Process mode is required' };
    }

    console.log(' Configuration validation passed');
    return { valid: true };
  }

  /**
   * Set environment variables from configuration
   * @param {Object} config - Job configuration
   */
  setEnvironmentFromConfig(config) {
    // Never log raw API keys or even variable presence details
    console.log(' Credentials checked');
    
    // Set API keys
    if (config.apiKeys.openai) {
      process.env.OPENAI_API_KEY = config.apiKeys.openai;
      console.log(' Provider initialized: openai');
    }
    if (config.apiKeys.runware) {
      process.env.RUNWARE_API_KEY = config.apiKeys.runware;
      console.log(' Provider initialized: runware');
    }
    if (config.apiKeys.removeBg) {
      process.env.REMOVE_BG_API_KEY = config.apiKeys.removeBg;
      console.log(' Provider initialized: remove.bg');
    }

    // Set other environment variables as needed
    if (config.advanced && config.advanced.debugMode) {
      process.env.DEBUG_MODE = 'true';
      console.log(' Debug mode enabled');
    }
    
    console.log(' Environment credentials finalized');
  }

  /**
   * Execute the job with the given configuration
   * @param {Object} config - Job configuration
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async executeJob(config, jobId) {
    try {
      console.log(' Starting job execution with clean 2-step workflow...');
      
      // Create AbortController to support immediate abort on force stop
      try {
        this.abortController = new (global.AbortController || require('abort-controller'))();
      } catch {
        this.abortController = new AbortController();
      }
      
            // Step 1: Initialization (includes parameter generation)
      if (this.isStopping) return;
      this._logStructured({
        level: 'info',
        stepName: 'initialization',
        subStep: 'start',
        message: ' Step 1: Initialization - generating parameters...'
      });
      
      // Apply initialization timeout using the same Generation Timeout (pollingTimeout, minutes)
      // - If enabled: use exact user value (minutes) with safe fallback to 30s if missing/NaN
      // - If disabled: default to 30s (no extra cap)
      const pollingTimeoutMinutes = Number(config?.parameters?.pollingTimeout);
      const initTimeoutMs = (config?.parameters?.enablePollingTimeout === true)
        ? (Number.isFinite(pollingTimeoutMinutes) ? pollingTimeoutMinutes * 60 * 1000 : 30_000)
        : 30_000;
      const parameters = await this.withTimeout(
        this.generateParameters({ ...config, __abortSignal: this.abortController?.signal }),
        initTimeoutMs,
        'Initialization (parameter generation) timed out'
      );
      this._logStructured({
        level: 'info',
        stepName: 'initialization',
        subStep: 'complete',
        message: ' Parameters generated successfully'
      });
      
      // Mark initialization as complete and update progress
      this.completedSteps.push('initialization');
      this.emitProgress('initialization', 20, 'Initialization completed');
      
      // Step 2: Image Generation (producePictureModule handles everything)
      if (this.isStopping) return;
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'start',
        message: ' Step 2: Image Generation - calling producePictureModule...'
      });
      // Flip UI to Image Generation active (blue) immediately after initialization
      this.emitProgress('image_generation', 25, 'Image generation started');
      
      let images;
      try {
        images = await this.generateImages({ ...config, __abortSignal: this.abortController?.signal }, parameters);
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'complete',
          message: ` Generated ${images?.length || 0} images successfully`
        });
      } catch (error) {
        this._logStructured({
          level: 'error',
          stepName: 'image_generation',
          subStep: 'error',
          message: ` Image generation failed: ${error.message}`
        });
        throw error;
      }
      
      // Save images to database with correct paths
      if (this.backendAdapter && Array.isArray(images)) {
        try {
          console.log(" Saving generated images to database...");
      // Local helper to strip Midjourney-style flags from prompt for storage/UI
      const sanitizePromptForRunware = (prompt) => {
        if (!prompt || typeof prompt !== 'string') return '';
        let p = prompt;
        p = p.replace(/\s--v\s?\d+(?:\.\d+)?/gi, '');
        p = p.replace(/\s--(ar|aspect-ratio)\s?\d+:\d+/gi, '');
        p = p.replace(/\s--(stylize|style)\s?\d+/gi, '');
        p = p.replace(/\s--(q|quality)\s?\d+(?:\.\d+)?/gi, '');
        p = p.replace(/\s--(chaos|weird)\s?\d+/gi, '');
        p = p.replace(/\s--(seed)\s?\d+/gi, '');
        p = p.replace(/\s--(tile|uplight|upbeta|niji|turbo)\b/gi, '');
        return p.trim();
      };
          for (const image of images) {
            if (image.path && image.status === "generated") {
              const executionId = this.databaseExecutionId;
              console.log(' Using database execution ID:', executionId);
              
              if (executionId) {
                // QC-first flow: treat module output as temp image; final path set later after QC/move
                const tempImagePath = image.path;
                const finalImagePath = null;
                
                const initialQCStatus = (this.jobConfiguration?.ai?.runQualityCheck) ? 'qc_failed' : 'approved';
                const initialQCReason = (this.jobConfiguration?.ai?.runQualityCheck) ? null : 'Auto-approved (quality checks disabled)';
                
            const rawPrompt = image.metadata?.prompt || 'Generated image';
            const displayPrompt = sanitizePromptForRunware(rawPrompt);
                const effectiveProc = (this.jobConfiguration && this.jobConfiguration.processing) ? this.jobConfiguration.processing : (config.processing || {});
                const generatedImage = {
                  imageMappingId: image.mappingId || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  executionId: executionId,
              generationPrompt: displayPrompt,
                  seed: null,
                  qcStatus: initialQCStatus,
                  qcReason: initialQCReason,
                  tempImagePath: tempImagePath,
                  finalImagePath: finalImagePath,
                  metadata: JSON.stringify(image.metadata || {}),
                  processingSettings: JSON.stringify({
                    aspectRatio: image.aspectRatio || '16:9',
                    status: image.status,
                    // Include user's processing settings (from effective job configuration)
                    sharpening: Number.isFinite(Number(effectiveProc.sharpening)) ? Number(effectiveProc.sharpening) : 0,
                    saturation: Number.isFinite(Number(effectiveProc.saturation)) ? Number(effectiveProc.saturation) : 1.0,
                    imageEnhancement: !!effectiveProc.imageEnhancement,
                    imageConvert: !!effectiveProc.imageConvert,
                    convertToJpg: !!effectiveProc.convertToJpg,
                    convertToWebp: !!effectiveProc.convertToWebp,
                    jpgQuality: Number.isFinite(Number(effectiveProc.jpgQuality)) ? Number(effectiveProc.jpgQuality) : 100,
                    pngQuality: Number.isFinite(Number(effectiveProc.pngQuality)) ? Number(effectiveProc.pngQuality) : 100,
                    webpQuality: Number.isFinite(Number(effectiveProc.webpQuality)) ? Number(effectiveProc.webpQuality) : 85,
                    removeBg: !!effectiveProc.removeBg,
                    trimTransparentBackground: !!effectiveProc.trimTransparentBackground,
                    jpgBackground: effectiveProc.jpgBackground || 'white',
                    removeBgSize: effectiveProc.removeBgSize || 'auto'
                  })
                };
                
                // Log the generatedImage object to see what's being saved
                console.log(' Saving generatedImage to database with keys:', Object.keys(generatedImage));
                console.log(' Image metadata being saved with keys:', image.metadata ? Object.keys(image.metadata) : 'none');
                console.log(' Stringified metadata length:', JSON.stringify(image.metadata || {}).length, 'characters');
                
                const saveResult = await this.backendAdapter.saveGeneratedImage(generatedImage);
                console.log(" Generated image saved to database:", saveResult);
              } else {
                console.warn('️ Skipping image save - no execution ID available');
              }
            }
          }
          // After initial save, if QC is disabled, move images to final immediately and approve
          if (!this.jobConfiguration?.ai?.runQualityCheck) {
            try {
              const savedImages = await this.getSavedImagesForExecution(this.databaseExecutionId);
              for (const dbImg of savedImages) {
                const fs = require('fs');
                const sourcePath = dbImg.tempImagePath || dbImg.temp_image_path || dbImg.finalImagePath || dbImg.final_image_path || dbImg.path;
                const mappingKey = dbImg.imageMappingId || dbImg.image_mapping_id || dbImg.mappingId || dbImg.id;
                if (!sourcePath || !mappingKey) continue;
                try { fs.accessSync(sourcePath); } catch { continue; }
                try {
                  this._logStructured({
                    level: 'info',
                    stepName: 'image_generation',
                    subStep: 'immediate_move_start',
                    message: 'QC disabled: moving image to final',
                    metadata: { imageMappingId: mappingKey, sourcePath }
                  });
                } catch {}
                const movedFinal = await this.moveImageToFinalLocation(sourcePath, mappingKey);
                if (movedFinal) {
                  await this.updateImagePaths(mappingKey, null, movedFinal);
                  await this.backendAdapter.updateQCStatusByMappingId(mappingKey, 'approved', 'QC disabled, auto-approved');
                  try {
                    this._logStructured({
                      level: 'info',
                      stepName: 'image_generation',
                      subStep: 'immediate_move_done',
                      message: 'QC disabled: image moved and DB updated',
                      metadata: { imageMappingId: mappingKey, finalImagePath: movedFinal }
                    });
                  } catch {}
                } else {
                  try {
                    this._logStructured({
                      level: 'warn',
                      stepName: 'image_generation',
                      subStep: 'immediate_move_failed',
                      message: 'QC disabled: move failed',
                      metadata: { imageMappingId: mappingKey, sourcePath }
                    });
                  } catch {}
                }
              }
            } catch (immediateMoveErr) {
              console.error(' Immediate move (QC disabled) failed:', immediateMoveErr);
              try {
                this._logStructured({
                  level: 'error',
                  stepName: 'image_generation',
                  subStep: 'immediate_move_exception',
                  message: 'QC disabled: exception during immediate move',
                  metadata: { error: String(immediateMoveErr && immediateMoveErr.message || immediateMoveErr) }
                });
              } catch {}
            }
          }
        } catch (error) {
          console.error(" Failed to save generated images to database:", error);
        }
      } else {
        console.warn("️ No backendAdapter available or no images - generated images will not be saved to database");
      }
      
      // After images are saved (and QC pass/moves), run metadata if enabled at the job level
      try {
        const savedImages = await this.getSavedImagesForExecution(this.databaseExecutionId);
        if (Array.isArray(savedImages) && savedImages.length > 0 && (this.jobConfiguration?.ai?.runMetadataGen === true)) {
          await this.generateMetadata(savedImages, this.jobConfiguration);
        }
      } catch (metadataErr) {
        console.warn('️ Metadata generation step reported failures or timed out:', metadataErr?.message || metadataErr);
        // Continue; job status handling will be done below
      }
      
      // Run QC if enabled (QC-first flow) and then move passing images to final
      try {
        const savedImages = await this.getSavedImagesForExecution(this.databaseExecutionId);
        if (Array.isArray(savedImages) && savedImages.length > 0) {
          if (this.jobConfiguration?.ai?.runQualityCheck) {
            await this.runQualityChecks(savedImages, this.jobConfiguration);
          }
          // After QC (or if disabled earlier), move any images still lacking final paths but approved
          for (const dbImg of savedImages) {
            const isApproved = dbImg.qcStatus === 'approved' || !this.jobConfiguration?.ai?.runQualityCheck;
            if (isApproved && !dbImg.finalImagePath) {
              const fs = require('fs');
              const sourcePath = dbImg.tempImagePath || dbImg.finalImagePath;
              if (!sourcePath) continue;
              try { fs.accessSync(sourcePath); } catch { continue; }
              let pathForFinal = sourcePath;
              // If QC was enabled and image is approved, apply processing before moving to final
              if (this.jobConfiguration?.ai?.runQualityCheck === true) {
                try {
                  const pathMod = require('path');
                  const fsP = require('fs').promises;
                  // Temporary processing directory
                  let tempProcessingDir;
                  try {
                    const { app } = require('electron');
                    const desktopPath = app.getPath('desktop');
                    tempProcessingDir = pathMod.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing');
                  } catch (_e) {
                    const os = require('os');
                    const homeDir = os.homedir();
                    tempProcessingDir = pathMod.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'temp_processing');
                  }
                  await fsP.mkdir(tempProcessingDir, { recursive: true });

                  const proc = this.jobConfiguration?.processing || {};
                  const processingConfig = {
                    tempDirectory: tempProcessingDir,
                    outputDirectory: tempProcessingDir,
                    removeBg: !!proc.removeBg,
                    imageConvert: !!proc.imageConvert,
                    convertToJpg: !!proc.convertToJpg,
                    convertToWebp: !!proc.convertToWebp,
                    trimTransparentBackground: !!proc.trimTransparentBackground,
                    imageEnhancement: !!proc.imageEnhancement,
                    sharpening: proc.sharpening ?? 0,
                    saturation: proc.saturation ?? 1,
                    jpgBackground: proc.jpgBackground || 'white',
                    removeBgSize: proc.removeBgSize || 'preview',
                    jpgQuality: proc.jpgQuality ?? 85,
                    pngQuality: proc.pngQuality ?? 100,
                    webpQuality: proc.webpQuality ?? 85
                  };
                  const sourceFileName = pathMod.basename(sourcePath);
                  const processedImagePath = await producePictureModule.processImage(sourcePath, sourceFileName, processingConfig);
                  if (processedImagePath) {
                    pathForFinal = processedImagePath;
                  }
                } catch (procErr) {
                  console.warn('QC-pass processing failed, using original temp image for move:', procErr?.message || procErr);
                }
              }

              const movedFinal = await this.moveImageToFinalLocation(pathForFinal, dbImg.imageMappingId || dbImg.mappingId || dbImg.id);
              if (movedFinal) {
                await this.updateImagePaths(dbImg.imageMappingId || dbImg.mappingId || dbImg.id, null, movedFinal);
              }
            }
          }
        }
      } catch (qcErr) {
        console.error(' QC/move phase error:', qcErr);
      }
      
      // Finalize QC: wait until all images leave transient QC states before marking job completed
      try {
        if (this.jobConfiguration?.ai?.runQualityCheck && this.backendAdapter && this.databaseExecutionId) {
          // Dynamic finalize window: 5s per image
          let imagesCount = 0;
          try {
            const savedImages = await this.getSavedImagesForExecution(this.databaseExecutionId);
            if (Array.isArray(savedImages)) {
              imagesCount = savedImages.length;
            }
          } catch (_e) {}
          const qcFinalizeTimeoutMs = Math.max(5000, imagesCount * 5000);
          await this.waitForQCToSettle(this.databaseExecutionId, qcFinalizeTimeoutMs);
        }
      } catch (qcWaitErr) {
        console.warn('️ QC finalize wait skipped or timed out:', qcWaitErr?.message || qcWaitErr);
      }
      
      // Mark image generation/QC as complete and update progress
      this.completedSteps.push('image_generation');
      this.emitProgress('image_generation', 100, 'Image generation completed');
      
      console.log(' Job execution completed successfully!');

      // Note: producePictureModule already handles metadata generation if enabled
      // No additional metadata processing needed here

      // Job completed successfully
      this.jobState.status = 'completed';
      this.jobState.endTime = new Date();
      
      // Send final progress update to reach 100%
      this.emitProgress('completed', 100, 'Job completed successfully');
      
      // Save completed job execution to database if backendAdapter is available
      if (this.backendAdapter) {
        try {
          console.log(" Updating job execution in database...");
          console.log(" Job state before update:", {
            totalImages: this.jobState.totalImages,
            generatedImages: this.jobState.generatedImages,
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
            generatedImages: this.jobState.generatedImages || 0,
            failedImages: this.jobState.failedImages || 0,
            errorMessage: null,
            label: this.persistedLabel || null
          };
          
          // console.log(" About to update job execution with data:", JSON.stringify(updatedJobExecution, null, 2));
          const updateResult = await this.backendAdapter.updateJobExecution(this.databaseExecutionId, updatedJobExecution);
          console.log(" Job execution updated in database:", updateResult);
          // Recalculate and persist technical counts (successful/failed) from DB snapshot
          try {
            if (this.databaseExecutionId) {
              await this.backendAdapter.updateJobExecutionStatistics(this.databaseExecutionId);
            }
          } catch (statsErr) {
            console.warn('️ Failed to update job execution statistics:', statsErr?.message || statsErr);
          }
          
          // Verify the update worked by reading back the job execution
          if (updateResult.success) {
            try {
              const verifyResult = await this.backendAdapter.getJobExecution(this.databaseExecutionId);
              // console.log(" Verification - job execution after update:", JSON.stringify(verifyResult, null, 2));
              console.log(" About to update job execution with keys:", Object.keys(updatedJobExecution));
              console.log(" Job execution update successful, changes:", verifyResult.changes);
            } catch (verifyError) {
              console.error(" Failed to verify job execution update:", verifyError);
            }
          }
        } catch (error) {
          console.error(" Failed to update job execution in database:", error);
        }
      } else {
        console.warn("️ No backendAdapter available - job execution will not be saved to database");
      }
      

      
      // Check if there are bulk rerun jobs in the queue and process the next one
      if (this.backendAdapter && this.isRerun) {
        try {
          console.log(' Checking for next bulk rerun job in queue...');
          const nextJobResult = await this.backendAdapter.processNextBulkRerunJob();
          if (nextJobResult.success) {
            console.log(` Started next bulk rerun job: ${nextJobResult.message}`);
          } else if (nextJobResult.message === 'No jobs in queue') {
            console.log(' No more bulk rerun jobs in queue');
          } else {
            console.log(` Next bulk rerun job not ready: ${nextJobResult.message}`);
          }
        } catch (error) {
          console.error(' Error processing next bulk rerun job:', error);
        }
      }

    } catch (error) {
      console.error(' Job execution error:', error);
      this.jobState.status = 'error';
      this.jobState.error = error.message;
      this.jobState.endTime = new Date();
      
      // Save error state to database if backendAdapter is available
      if (this.backendAdapter) {
        try {
          console.log(" Updating job execution with error status in database...");
          const errorJobExecution = {
            configurationId: this.configurationId, // Preserve the configuration ID
            startedAt: this.jobState.startTime,
            completedAt: this.jobState.endTime,
            status: "failed",
            totalImages: this.jobState.totalImages || 0,
            generatedImages: this.jobState.generatedImages || 0,
            failedImages: this.jobState.failedImages || 0,
            errorMessage: error.message,
            label: this.persistedLabel || null
          };
          
          const updateResult = await this.backendAdapter.updateJobExecution(this.databaseExecutionId, errorJobExecution);
          console.log(" Job execution error status updated in database:", updateResult);
        } catch (dbError) {
          console.error(" Failed to update job execution error status in database:", dbError);
        }
      } else {
        console.warn("️ No backendAdapter available - job error status will not be saved to database");
      }
      
      this.emit('error', {
        jobId: jobId,
        error: error.message,
        code: 'JOB_EXECUTION_ERROR',
        timestamp: new Date(),
        userMessage: 'Job execution failed. Please check the configuration and try again.',
        retryable: true
      });

      // If this was part of a bulk rerun, advance the queue even on failure
      if (this.backendAdapter && this.isRerun) {
        try {
          console.log(' Bulk rerun: current job failed, attempting to start next queued job...');
          const nextJobResult = await this.backendAdapter.processNextBulkRerunJob();
          if (nextJobResult.success) {
            console.log(` Started next bulk rerun job after failure: ${nextJobResult.message}`);
          } else if (nextJobResult.message === 'No jobs in queue') {
            console.log(' No more bulk rerun jobs in queue after failure');
          } else {
            console.log(` Next bulk rerun job not ready after failure: ${nextJobResult.message}`);
          }
        } catch (queueErr) {
          console.error(' Error advancing bulk rerun queue after failure:', queueErr);
        }
      }
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
      const abortSignal = config?.__abortSignal;
      this._logStructured({
        level: 'info',
        stepName: 'initialization',
        subStep: 'parameter_generation',
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

      // Read keywords from file
      let keywords = 'default image';
      let systemPrompt = null;
      
      try {
        // Read keywords file
        if (config.filePaths?.keywordsFile) {
          const fs = require('fs').promises;
          const keywordsContent = await fs.readFile(config.filePaths.keywordsFile, 'utf8');
          
          // Check if this is a CSV file (contains commas and quotes)
          if (keywordsContent.includes(',') && keywordsContent.includes('"')) {
            // Parse CSV format
            const lines = keywordsContent.trim().split('\n').filter(line => line.trim());
            if (lines.length > 1) { // Need at least header + one data row
              const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
              // Choose data row based on keywordRandom toggle
              const keywordRandom = !!(config.parameters && config.parameters.keywordRandom);
              const dataStartIndex = 1;
              const dataEndIndex = lines.length - 1;
              let chosenIndex;
              if (keywordRandom) {
                chosenIndex = dataStartIndex + Math.floor(Math.random() * (dataEndIndex - dataStartIndex + 1));
              } else if (config.__perGen && Number.isInteger(config.__forceSequentialIndex)) {
                const span = (dataEndIndex - dataStartIndex + 1);
                chosenIndex = dataStartIndex + (config.__forceSequentialIndex % span);
              } else {
                chosenIndex = dataStartIndex;
              }
              const dataRow = lines[chosenIndex].split(',').map(cell => cell.trim().replace(/"/g, ''));
              
              // Create object mapping headers to values
              const csvRow = {};
              headers.forEach((header, index) => {
                csvRow[header] = dataRow[index] || '';
              });
              
              keywords = csvRow; // Pass as object for CSV mode
              this._logStructured({
                level: 'debug',
                stepName: 'initialization',
                subStep: 'csv_parsed',
                message: `Parsed CSV keywords: ${JSON.stringify(csvRow)}`,
                metadata: { keywordsFile: config.filePaths.keywordsFile, csvRow, headers }
              });
            }
          } else {
            // Parse as TXT format (one keyword per line)
            const keywordsList = keywordsContent.trim().split('\n').filter(line => line.trim());
            
            if (keywordsList.length > 0) {
              const keywordRandom = !!(config.parameters && config.parameters.keywordRandom);
              const seqIndex = (config.__perGen && Number.isInteger(config.__forceSequentialIndex))
                ? (config.__forceSequentialIndex % keywordsList.length)
                : 0;
              const index = keywordRandom ? Math.floor(Math.random() * keywordsList.length) : seqIndex;
              keywords = keywordsList[index].trim();
              this._logStructured({
                level: 'debug',
                stepName: 'initialization',
                subStep: 'txt_parsed',
                message: `Read TXT keywords: ${keywords}`,
                metadata: { keywordsFile: config.filePaths.keywordsFile, selectedKeyword: keywords, keywordRandom, seqIndex }
              });
            }
          }
        }
        
        // Read system prompt template
        if (config.filePaths?.systemPromptFile) {
          const fs = require('fs').promises;
          systemPrompt = await fs.readFile(config.filePaths.systemPromptFile, 'utf8');
          this._logStructured({
            level: 'debug',
            stepName: 'initialization',
            subStep: 'system_prompt_read',
            message: `Read system prompt template from file`,
            metadata: { systemPromptFile: config.filePaths.systemPromptFile, systemPromptLength: systemPrompt.length }
          });
        }
      } catch (fileError) {
        this._logStructured({
          level: 'warn',
          stepName: 'initialization',
          subStep: 'file_read_warning',
          message: `Warning: Could not read keywords or system prompt files, using defaults`,
          metadata: { error: fileError.message, keywordsFile: config.filePaths?.keywordsFile, systemPromptFile: config.filePaths?.systemPromptFile }
        });
      }
      
      // Ensure aspectRatios is always an array; support comma-separated input like "16:9,1:1,9:16"
      let aspectRatios = config.parameters?.aspectRatios || ['1:1'];
      if (typeof aspectRatios === 'string') {
        const raw = aspectRatios;
        aspectRatios = raw.includes(',')
          ? raw.split(',').map(r => r.trim()).filter(Boolean)
          : [raw.trim()];
      } else if (!Array.isArray(aspectRatios)) {
        aspectRatios = ['1:1'];
      }
      
      const mjVersion = config.parameters?.mjVersion || '6';
      
      // Reduced verbosity: avoid legacy Midjourney-style log spam in dashboard
      this._logStructured({
        level: 'debug',
        stepName: 'parameter_generation',
        subStep: 'extract',
        message: `Configuration extracted for parameter generation`,
        metadata: { keywords, aspectRatiosCount: Array.isArray(aspectRatios) ? aspectRatios.length : 0 }
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
        systemPrompt, // Use the system prompt we read from file
        null, // keywordFilePath not needed
        {
          mjVersion: mjVersion,
          // Do not append MJ flags for non-Midjourney provider (Runware)
          appendMjVersion: false,
          openaiModel: config.parameters?.openaiModel || 'gpt-4o',
          signal: abortSignal
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
        stepName: 'initialization',
        subStep: 'parameter_generation_complete',
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
        stepName: 'initialization',
        subStep: 'parameter_generation_error',
        message: `Parameter generation failed: ${error.message}`,
        durationMs: duration,
        errorCode: 'PARAM_GEN_ERROR',
        metadata: { error: error.message, stack: error.stack }
      });
      
      console.error(' Error generating parameters:', error);
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
      const abortSignal = config?.__abortSignal;
      // If multiple generations requested, run per-generation orchestration to allow partial success
      const __genCount = Math.max(1, Number(config?.parameters?.count || 1));
      if (__genCount > 1) {
        return await this._generateImagesPerGeneration(config, parameters, __genCount);
      }
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
      console.log(` JobRunner: DEBUG - config.filePaths:`, JSON.stringify(config.filePaths, null, 2));
      // Clarify directory mapping in logs: temp is where generator writes first; final move goes to outputDirectory
      console.log(` JobRunner: DEBUG - OUTPUT directory (final):`, config.filePaths?.outputDirectory);
      console.log(` JobRunner: DEBUG - TEMP directory (initial writes):`, config.filePaths?.tempDirectory);
      
      // When QC is enabled, defer processing until retry flows (QC-first design)
      const processingEnabled = !(config.ai?.runQualityCheck === true);
      const requestedVariations = Math.max(1, Math.min(20, Number(config.parameters?.variations || 1)));
      const effectiveVariations = Math.min(requestedVariations, 20);
      const moduleConfig = {
        removeBg: processingEnabled ? (config.processing?.removeBg || false) : false,
        imageConvert: processingEnabled ? (config.processing?.imageConvert || false) : false,
        convertToJpg: processingEnabled ? (config.processing?.convertToJpg || false) : false,
        trimTransparentBackground: processingEnabled ? (config.processing?.trimTransparentBackground || false) : false,
        aspectRatios: Array.isArray(parameters.aspectRatios)
          ? parameters.aspectRatios
          : (Array.isArray(config.parameters?.aspectRatios)
              ? config.parameters.aspectRatios
              : (typeof config.parameters?.aspectRatios === 'string'
                  ? (config.parameters.aspectRatios.includes(',')
                      ? config.parameters.aspectRatios.split(',').map(r => r.trim()).filter(Boolean)
                      : [config.parameters.aspectRatios.trim()])
                  : ['1:1'])),
        pollingTimeout: config.parameters?.enablePollingTimeout ? (config.parameters?.pollingTimeout || 15) : null, // 15 minutes if enabled, null if disabled
        pollingInterval: config.parameters?.pollingInterval || 1, // 1 minute (from parameters settings)
        processMode: config.parameters?.processMode || 'single',
        removeBgSize: processingEnabled ? (config.processing?.removeBgSize || 'preview') : 'preview',
        runQualityCheck: config.ai?.runQualityCheck || false,
        runMetadataGen: config.ai?.runMetadataGen || false,
        // Image enhancement settings
        imageEnhancement: processingEnabled ? (config.processing?.imageEnhancement || false) : false,
        sharpening: processingEnabled ? (config.processing?.sharpening || 0) : 0,
        saturation: processingEnabled ? (config.processing?.saturation || 1) : 1,
        jpgBackground: processingEnabled ? (config.processing?.jpgBackground || 'white') : 'white',
        jpgQuality: processingEnabled ? (config.processing?.jpgQuality || 90) : 90,
        pngQuality: processingEnabled ? (config.processing?.pngQuality || 100) : 100,
        // Paths (QC-first): generator writes to temp first; later we move to outputDirectory
        outputDirectory: config.filePaths?.tempDirectory || './pictures/generated',
        tempDirectory: config.filePaths?.tempDirectory || './pictures/generated',
        variations: effectiveVariations
      };
      if (abortSignal) {
        moduleConfig.abortSignal = abortSignal;
      }
      
      console.log(` JobRunner: DEBUG - moduleConfig (initial write path):`, {
        outputDirectory: moduleConfig.outputDirectory,
        tempDirectory: moduleConfig.tempDirectory
      });
      
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
      
      // Create settings object that includes full configuration so downstream module
      // can read parameters (e.g., runwareAdvancedEnabled) and processing controls.
      // Sanitize advanced params at execution time: if toggle is not explicitly ON,
      // do not pass any advanced parameters downstream.
      const sanitizedParameters = { ...(config.parameters || {}) };
      if (sanitizedParameters.runwareAdvancedEnabled !== true) {
        // Preserve LoRA (not an advanced-only control) by lifting it to top-level before clearing
        const adv = sanitizedParameters.runwareAdvanced || {};
        if (!Array.isArray(sanitizedParameters.lora) && Array.isArray(adv.lora) && adv.lora.length > 0) {
          sanitizedParameters.lora = adv.lora;
        }
        // Ensure downstream sees toggle as false and advanced payload cleared
        sanitizedParameters.runwareAdvancedEnabled = false;
        if (sanitizedParameters.runwareAdvanced) {
          sanitizedParameters.runwareAdvanced = {};
        }
      }
      const settings = {
        ...config,
        parameters: sanitizedParameters,
        prompt: parameters.prompt,
        promptContext: parameters.promptContext
      };
      try {
        console.log('JobRunner: settings gate before module call:', {
          enabledFlag: settings?.parameters?.runwareAdvancedEnabled,
          advancedKeys: settings?.parameters?.runwareAdvanced ? Object.keys(settings.parameters.runwareAdvanced) : []
        });
      } catch {}
      
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
      
      
      const result = await producePictureModule.producePictureModule(
        settings, // Pass settings with API keys as first parameter
        imgNameBase,
        (config.ai && config.ai.metadataPrompt) ? config.ai.metadataPrompt : null, // custom metadata prompt from file if provided
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
      
      console.log(' Images generated by module:', result);
      console.log(' Result type:', typeof result);
      console.log(' Result is array:', Array.isArray(result));
      console.log(' Result length:', Array.isArray(result) ? result.length : 'N/A');
      // console.log(' Result structure:', JSON.stringify(result, null, 2));
      console.log(' Result structure keys:', Object.keys(result));
      console.log(' Result success status:', result.success);
      
      // The module returns an array of image objects, each with outputPath
      if (result && Array.isArray(result)) {
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'process_array',
          message: `Processing ${result.length} images from array result`,
          metadata: { imageCount: result.length }
        });
        
        
        // Update job state with image counts
        this.jobState.totalImages = result.length;
        this.jobState.generatedImages = result.length; // All images are generated initially
        this.jobState.failedImages = 0;
        
        // Create separate image objects for each result
        const processedImages = result.map((item, index) => {
          // Update to image_processing step for individual image handling
          this._logStructured({
            level: 'info',
            stepName: 'ai_operations',
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
          

          
          // Extract metadata from producePictureModule result
          const extractedMetadata = {
            prompt: parameters.prompt,
            // Include AI-generated metadata if available
            ...(item.settings?.title?.title && { title: item.settings.title.title }),
            ...(item.settings?.title?.description && { description: item.settings.title.description }),
            ...(item.settings?.uploadTags && { uploadTags: item.settings.uploadTags })
          };

          // Debug log the metadata extraction
          // console.log(` Image ${index + 1} - item.settings:`, JSON.stringify(item.settings, null, 2));
          // console.log(` Image ${index + 1} - extractedMetadata:`, JSON.stringify(extractedMetadata, null, 2));
          console.log(` Image ${index + 1} - item.settings keys:`, Object.keys(item.settings));
          console.log(` Image ${index + 1} - extractedMetadata keys:`, Object.keys(extractedMetadata));
          
          this._logStructured({
            level: 'debug',
            stepName: 'image_generation',
            subStep: 'metadata_extraction',
            imageIndex: index,
            message: `Extracted metadata for image ${index + 1}`,
            metadata: { 
              extractedMetadata,
              itemSettings: item.settings,
              hasTitle: !!item.settings?.title?.title,
              hasDescription: !!item.settings?.title?.description,
              hasUploadTags: !!item.settings?.uploadTags
            }
          });

          const imageObject = {
            path: imagePath,  // This should be a string path
            aspectRatio: aspectRatio,
            status: 'generated',
            metadata: extractedMetadata,
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
            generatedImages: processedImages.length,
            failedImages: 0,
            allMappingIds: processedImages.map(img => img.mappingId)
          }
        });
        
              return processedImages;  // Return array of image objects
      } else if (result && typeof result === 'object' && Array.isArray(result.processedImages)) {
        // Structured result: { processedImages, failedItems }
        const items = result.processedImages;
        const processedImages = items.map((item) => {
          const imagePath = item.outputPath || item.path || item;
          const aspectRatio = parameters.aspectRatios?.[0] || '1:1';
          
          const imageObject = {
            path: imagePath,
            aspectRatio,
            status: 'generated',
            metadata: {
              prompt: parameters.prompt,
              ...(item.settings?.title?.title && { title: item.settings.title.title }),
              ...(item.settings?.title?.description && { description: item.settings.title.description }),
              ...(item.settings?.uploadTags && { uploadTags: item.settings.uploadTags })
            },
            mappingId: item.mappingId || `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
          };
          
          // Update job state counts
          this.jobState.totalImages = (this.jobState.totalImages || 0) + 1;
          this.jobState.generatedImages = (this.jobState.generatedImages || 0) + 1;
          
          return imageObject;
        });
        
        const duration = Date.now() - startTime;
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'complete',
          message: `Image generation completed successfully: ${processedImages.length} images`,
          durationMs: duration,
          updateProgress: true,
          metadata: { 
            totalImages: processedImages.length,
            generatedImages: processedImages.length,
            failedImages: 0,
            allMappingIds: processedImages.map(img => img.mappingId)
          }
        });
        
        return processedImages;
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
        this.jobState.generatedImages = 1;
        this.jobState.failedImages = 0;
        
        return [{
          path: result,
          aspectRatio: parameters.aspectRatios?.[0] || '1:1',
          status: 'generated',
          metadata: { prompt: parameters.prompt }
          // Note: Single string results don't have AI metadata since they bypass producePictureModule
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
      
      console.error(' Error generating images:', error);
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
      console.error(' Error during background removal:', error);
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
      
      if (!this.backendAdapter || !executionId) {
        console.warn('️ Cannot get saved images: missing backendAdapter or executionId');
        return [];
      }
      
      console.log(` Getting saved images for execution ${executionId}...`);
      const result = await this.backendAdapter.getAllGeneratedImages();
      
      // Handle both response formats: direct array or {success, images} object
      let images = result;
      if (result && typeof result === 'object' && result.success !== undefined) {
        // Response is wrapped in {success, images} format
        images = result.images;
      } else {
        // Response is direct array
      }
      
      if (Array.isArray(images)) {
        // Filter images for this specific execution
        const executionImages = images.filter(img => img.executionId === executionId);
        console.log(` Found ${executionImages.length} saved images for execution ${executionId}`);
        return executionImages;
      } else {
        console.warn('️ Failed to get saved images - not an array:', images);
        return [];
      }
    } catch (error) {
      console.error(' Error getting saved images:', error);
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
        stepName: 'ai_operations',
        subStep: 'quality_check_start',
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
          stepName: 'ai_operations',
          subStep: 'quality_check_image',
          imageIndex: images.indexOf(image),
          message: `Running quality check on image ${images.indexOf(image) + 1}/${images.length}`,
          metadata: { 
            imagePath: (image.finalImagePath || image.tempImagePath || image.final_image_path || image.temp_image_path || image.path),
            imageMappingId: (image.imageMappingId || image.image_mapping_id || image.mappingId || image.id),
            imageId: image.id
          }
        });
        

        
        let result;
        try {
          const qcInputPath = image.finalImagePath || image.tempImagePath || image.final_image_path || image.temp_image_path || image.path;
          if (!qcInputPath) {
            throw new Error('QC input path is missing');
          }
          result = await aiVision.runQualityCheck(
            qcInputPath, // Use finalImagePath when available, otherwise tempImagePath
            config.parameters?.openaiModel || "gpt-4o",
            config.ai?.qualityCheckPrompt || null
          );
        } catch (aiError) {
          throw aiError;
        }
        
        if (result) {
          this._logStructured({
            level: 'info',
            stepName: 'ai_operations',
            subStep: 'quality_check_result',
            imageIndex: images.indexOf(image),
            message: `Quality check completed: ${result.passed ? 'PASSED' : 'FAILED'}`,
            metadata: { 
              passed: result.passed,
              reason: result.reason,
              imagePath: (image.finalImagePath || image.tempImagePath || image.final_image_path || image.temp_image_path || image.path)
            }
          });
          
          image.qualityDetails = result;
          
          // Update QC status in database based on quality check result
          const mappingKey = image.imageMappingId || image.image_mapping_id || image.mappingId || image.id;
          if (this.backendAdapter && mappingKey) {
            try {
              const qcStatus = result.passed ? "approved" : "qc_failed";
              const qcReason = result.reason || (result.passed ? "Quality check passed" : "Quality check failed");
              
              this._logStructured({
                level: 'info',
                stepName: 'ai_operations',
                subStep: 'quality_check_db_update',
                imageIndex: images.indexOf(image),
                message: `Updating QC status in database: ${qcStatus}`,
                metadata: { 
                  qcStatus,
                  qcReason,
                  imageMappingId: mappingKey
                }
              });
              
              await this.backendAdapter.updateQCStatusByMappingId(mappingKey, qcStatus, qcReason);
              
              // Also update the local image object
              image.qcStatus = qcStatus;
              image.qcReason = qcReason;
            } catch (dbError) {
              this._logStructured({
                level: 'error',
                stepName: 'ai_operations',
                subStep: 'quality_check_db_error',
                imageIndex: images.indexOf(image),
                message: `Failed to update QC status in database: ${dbError.message}`,
                errorCode: 'QC_DB_UPDATE_ERROR',
                metadata: { 
                  error: dbError.message,
                  imageMappingId: mappingKey
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
                imageMappingId: (image.imageMappingId || image.image_mapping_id || image.mappingId || image.id)
              }
            });
            

          }
        } else {
          this._logStructured({
            level: 'warn',
            stepName: 'ai_operations',
            subStep: 'quality_check_no_result',
            imageIndex: images.indexOf(image),
            message: 'Quality check returned no result',
            metadata: { imagePath: (image.finalImagePath || image.tempImagePath || image.final_image_path || image.temp_image_path || image.path) }
          });
          
          image.qualityDetails = { error: "Quality check failed" };
          
          // Update QC status to failed in database
          const mappingKey2 = image.imageMappingId || image.image_mapping_id || image.mappingId || image.id;
          if (this.backendAdapter && mappingKey2) {
            try {
              this._logStructured({
                level: 'info',
                stepName: 'ai_operations',
                subStep: 'quality_check_db_update_failed',
                imageIndex: images.indexOf(image),
                message: 'Updating QC status to failed in database',
                metadata: { imageMappingId: mappingKey2 }
              });
              
              await this.backendAdapter.updateQCStatusByMappingId(mappingKey2, "qc_failed", "Quality check failed");
              
              // Also update the local image object
              image.qcStatus = "qc_failed";
              image.qcReason = "Quality check failed";
            } catch (dbError) {
              this._logStructured({
                level: 'error',
                stepName: 'ai_operations',
                subStep: 'quality_check_db_error_failed',
                imageIndex: images.indexOf(image),
                message: `Failed to update QC status to failed in database: ${dbError.message}`,
                errorCode: 'QC_DB_UPDATE_FAILED_ERROR',
                metadata: { 
                  error: dbError.message,
                  imageMappingId: mappingKey2
                }
              });
              

            }
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'info',
        stepName: 'ai_operations',
        subStep: 'quality_check_complete',
        message: `Quality checks completed for all ${images.length} images`,
        durationMs: duration,
        updateProgress: true, // Update progress for step completion
        metadata: { 
          totalImages: images.length,
          successfulChecks: images.filter(img => img.qcStatus === 'approved').length,
          failedChecks: images.filter(img => img.qcStatus === 'qc_failed').length
        }
      });
      
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'ai_operations',
        subStep: 'quality_check_error',
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
   * Wait until QC transitions finish for an execution (no images in transient QC states)
   * Transient states considered: 'processing', 'retry_pending'
   * @param {number} executionId
   * @param {number} timeoutMs
   * @param {number} intervalMs
   */
  async waitForQCToSettle(executionId, timeoutMs = 30000, intervalMs = 500) {
    if (!this.backendAdapter || !executionId) {
      throw new Error('Missing backendAdapter or executionId for QC finalize');
    }
    const start = Date.now();
    const normalize = (resp) => {
      if (resp && typeof resp === 'object' && Object.prototype.hasOwnProperty.call(resp, 'success')) {
        return resp.images || [];
      }
      return Array.isArray(resp) ? resp : [];
    };
    while (Date.now() - start < timeoutMs) {
      let images;
      try {
        const resp = await this.backendAdapter.getGeneratedImagesByExecution(executionId);
        images = normalize(resp);
      } catch (_e) {
        images = [];
      }
      const unsettled = images.some((img) => {
        const status = String(img.qcStatus || '').toLowerCase();
        return status === 'processing' || status === 'retry_pending';
      });
      if (!unsettled) {
        return true;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('QC finalize timeout reached');
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
        stepName: 'image_generation',
        subStep: 'metadata_start',
        message: `Starting metadata generation for ${images.length} images`,
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          imageCount: images.length,
          openaiModel: config.parameters?.openaiModel || 'gpt-4o',
          hasMetadataPrompt: !!config.ai?.metadataPrompt
        }
      });
      
      // Apply a timeout per-image to avoid hangs on network loss
      const pollingTimeoutMinutes = Number(config?.parameters?.pollingTimeout);
      const metadataTimeoutMs = (config?.parameters?.enablePollingTimeout === true)
        ? (Number.isFinite(pollingTimeoutMinutes) ? pollingTimeoutMinutes * 60 * 1000 : 30_000)
        : 30_000;
      let hadFailures = false;

      for (const image of images) {
        if (this.isStopping) return;
        let result = null;
        try {
          // Resolve a usable local path for the saved image
          const localPath = image.finalImagePath || image.tempImagePath || image.path;
          // Call the real metadata generation from aiVision with timeout
          result = await this.withTimeout(
            aiVision.generateMetadata(
              localPath,
              image.metadata?.prompt || 'default image',
              config.ai?.metadataPrompt || null,
              config.parameters?.openaiModel || 'gpt-4o'
            ),
            metadataTimeoutMs,
            'Metadata generation timed out'
          );
        } catch (metaErr) {
          hadFailures = true;
          // Classify per-image failure and persist qc_failed (even if QC is OFF)
          const mappingId = image.imageMappingId || image.mappingId;
          if (this.backendAdapter && mappingId) {
            try {
              await this.backendAdapter.updateQCStatusByMappingId(mappingId, 'qc_failed', 'processing_failed:metadata');
              // Merge failure details into metadata
              const failureDetails = {
                failure: {
                  stage: 'metadata',
                  vendor: 'openai',
                  message: String(metaErr && metaErr.message || metaErr),
                }
              };
              await this.backendAdapter.updateGeneratedImageByMappingId(mappingId, {
                metadata: {
                  ...(image.metadata || {}),
                  ...(failureDetails)
                }
              });
            } catch (_e) {}
          }
          continue;
        }
        
        if (result) {
          this._logStructured({
            level: 'debug',
            stepName: 'image_generation',
            subStep: 'metadata_ai_result',
            message: `AI metadata generation result for image ${image.id}`,
            metadata: { 
              imageId: image.id,
              aiResult: result,
              aiResultKeys: Object.keys(result),
              hasTitle: !!result.new_title,
              hasDescription: !!result.new_description,
              hasTags: !!result.uploadTags,
              titleValue: result.new_title,
              descriptionValue: result.new_description,
              tagsValue: result.uploadTags,
              tagsType: typeof result.uploadTags
            }
          });
          
          // Check for different possible tag field names
          const tags = result.uploadTags || result.tags || result.upload_tags || null;
          
          this._logStructured({
            level: 'debug',
            stepName: 'image_generation',
            subStep: 'metadata_tags_processing',
            message: `Processing tags for image ${image.id}`,
            metadata: { 
              imageId: image.id,
              uploadTags: result.uploadTags,
              tags: result.tags,
              upload_tags: result.upload_tags,
              selectedTags: tags,
              tagsType: typeof tags
            }
          });
          
          image.metadata = {
            ...image.metadata,
            title: result.new_title,
            description: result.new_description,
            tags: tags
          };
          
          this._logStructured({
            level: 'debug',
            stepName: 'image_generation',
            subStep: 'metadata_image_updated',
            message: `Image metadata object updated for image ${image.id}`,
            metadata: { 
              imageId: image.id,
              finalMetadata: image.metadata,
              metadataKeys: Object.keys(image.metadata)
            }
          });
          
          // Update the image in the database with new metadata using mappingId
          if (this.backendAdapter && image.mappingId) {
            try {
              // Find the database record by mappingId and update it
              const updateResult = await this.backendAdapter.updateGeneratedImageByMappingId(image.mappingId, image);
              this._logStructured({
                level: 'debug',
                stepName: 'image_generation',
                subStep: 'metadata_db_update',
                message: `Updated metadata in database for image with mappingId ${image.mappingId}`,
                metadata: { 
                  mappingId: image.mappingId, 
                  title: result.new_title, 
                  description: result.new_description,
                  tags: result.uploadTags,
                  fullMetadata: image.metadata,
                  updateResult 
                }
              });
            } catch (dbError) {
              this._logStructured({
                level: 'warn',
                stepName: 'image_generation',
                subStep: 'metadata_db_update_warning',
                message: `Warning: Could not update metadata in database for image with mappingId ${image.mappingId}`,
                metadata: { mappingId: image.mappingId, error: dbError.message }
              });
            }
          } else {
            this._logStructured({
              level: 'warn',
              stepName: 'image_generation',
              subStep: 'metadata_missing_mapping_id',
              message: `Cannot update metadata - missing mappingId for image`,
              metadata: { image: { mappingId: image.mappingId, id: image.id } }
            });
          }
        } else {
          this._logStructured({
            level: 'warn',
            stepName: 'image_generation',
            subStep: 'metadata_no_result',
            message: `No metadata result returned for image ${image.id}`,
            metadata: { imageId: image.id }
          });
          
          image.metadata = {
            ...image.metadata,
            error: 'Metadata generation failed'
          };
        }
      }
      
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'metadata_complete',
        message: `Metadata generation completed for all ${images.length} images`,
        durationMs: duration,
        updateProgress: true, // Update progress for step completion
        metadata: { 
          totalImages: images.length,
          successfulMetadata: images.filter(img => !img.metadata?.error).length,
          failedMetadata: images.filter(img => img.metadata?.error).length
        }
      });

      if (hadFailures) {
        throw new Error('One or more images failed metadata generation');
      }
      
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'image_generation',
        subStep: 'metadata_error',
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
    // Ensure PROGRESS_STEPS is up-to-date with current job configuration
    if (this.jobConfiguration) {
      PROGRESS_STEPS = this._getEnabledProgressSteps(this.jobConfiguration);
    }
    
    const currentStepConfig = PROGRESS_STEPS.find(s => s.name === this.jobState.currentStep);
    const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.name === this.jobState.currentStep);
    
    // Debug logging to help troubleshoot progress step issues
    console.log(' getJobStatus debug:', {
      PROGRESS_STEPS_length: PROGRESS_STEPS.length,
      PROGRESS_STEPS_names: PROGRESS_STEPS.map(s => s.name),
      currentStep: this.jobState.currentStep,
      currentStepIndex,
      jobState_status: this.jobState.status,
      hasJobConfig: !!this.jobConfiguration
    });
    
    return {
      state: this.jobState.status,
      currentJob: this.currentJob ? {
        id: this.jobState.id,
        status: this.jobState.status,
        label: this.persistedLabel || null,
        startTime: this.jobState.startTime,
        progress: this.jobState.progress,
        currentStep: currentStepIndex + 1,
        totalSteps: PROGRESS_STEPS.length,
        configurationId: this.configurationId || null,
        executionId: this.databaseExecutionId || null,
        gensDone: this.jobState.gensDone || 0,
        totalGenerations: this.jobState.totalGenerations || Math.max(1, Number(this.jobConfiguration?.parameters?.count || 1))
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
          generatedImages: this.jobState.generatedImages,
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

  /**
   * Process a single image with all configured processing options
   * @param {string} tempImagePath - Path to the temporary image
   * @param {Object} config - Job configuration
   * @returns {Promise<string|null>} Path to processed image or null if failed
   */
  async processSingleImage(tempImagePath, config) {
    try {
      console.log(` Processing image: ${tempImagePath}`);
      
      // For now, return the same path (no processing applied)
      // TODO: Implement actual image processing based on config
      console.log(`️ Image processing not yet implemented, returning original path: ${tempImagePath}`);
      return tempImagePath;
    } catch (error) {
      console.error(` Error processing image ${tempImagePath}:`, error);
      return null;
    }
  }

  /**
   * Move a processed image to its final location
   * @param {string} processedImagePath - Path to the processed image
   * @param {string} imageMappingId - Unique identifier for the image
   * @returns {Promise<string|null>} Final image path or null if failed
   */
  async moveImageToFinalLocation(processedImagePath, imageMappingId) {
    try {
      const fs = require('fs').promises;
      const fsSync = require('fs');
      const path = require('path');
      // Structured log: move start
      try {
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'move_start',
          message: 'Starting move to final location',
          metadata: { imageMappingId, sourcePath: processedImagePath }
        });
      } catch {}
      
      // Resolve and lock final output directory once per job
      if (!this.finalOutputDirectory) {
        let lockedDir = this.jobConfiguration?.filePaths?.outputDirectory;
        console.log(` JobRunner: DEBUG - filePaths:`, JSON.stringify(this.jobConfiguration?.filePaths, null, 2));
        console.log(` JobRunner: DEBUG - original outputDirectory: ${lockedDir || 'not set'}`);
        if (!lockedDir || (typeof lockedDir === 'string' && lockedDir.trim() === '')) {
          try {
            const { app } = require('electron');
            const desktopPath = app.getPath('desktop');
            lockedDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
            console.log(` JobRunner: DEBUG - Using fallback Desktop path: ${lockedDir}`);
          } catch (error) {
            const os = require('os');
            const homeDir = os.homedir();
            lockedDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'toupload');
            console.log(` JobRunner: DEBUG - Using fallback Documents path: ${lockedDir}`);
          }
        } else {
          console.log(` JobRunner: DEBUG - Using custom path: ${lockedDir}`);
        }
        await fs.mkdir(lockedDir, { recursive: true });
        this.finalOutputDirectory = lockedDir;
        try {
          this._logStructured({
            level: 'info',
            stepName: 'image_generation',
            subStep: 'final_output_dir_locked',
            message: 'Locked final output directory for this job',
            metadata: { finalOutputDirectory: lockedDir }
          });
        } catch {}
      }
      const finalDirectory = this.finalOutputDirectory;
      try {
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'move_target_resolved',
          message: 'Resolved final output directory',
          metadata: { imageMappingId, finalDirectory }
        });
      } catch {}
      
      // Generate final filename
      const originalFilename = path.basename(processedImagePath);
      const finalFilename = `${imageMappingId}_${originalFilename}`;
      const finalImagePath = path.join(finalDirectory, finalFilename);
      
      // Move the file (not copy) using fs.rename, with fallback to copy+unlink
      let moved = false;
      try {
        await fs.rename(processedImagePath, finalImagePath);
        moved = true;
      } catch (err) {
        console.warn(`️ rename failed (${err?.code || 'unknown'}). Falling back to copy+unlink`);
        try {
          await fs.copyFile(processedImagePath, finalImagePath);
          await fs.unlink(processedImagePath);
          moved = true;
        } catch (copyErr) {
          console.error(' copy+unlink fallback failed:', copyErr?.message || copyErr);
          moved = false;
        }
      }

      // Verify final existence and original absence
      const finalExists = (() => { try { fsSync.accessSync(finalImagePath); return true; } catch { return false; } })();
      const originalExists = (() => { try { fsSync.accessSync(processedImagePath); return true; } catch { return false; } })();
      console.log(` Move verification for ${imageMappingId}: finalExists=${finalExists}, originalExists=${originalExists}, dest=${finalImagePath}`);
      try {
        this._logStructured({
          level: moved && finalExists ? 'info' : 'warn',
          stepName: 'image_generation',
          subStep: 'move_verification',
          message: 'Move verification completed',
          metadata: { imageMappingId, finalExists, originalExists, finalImagePath }
        });
      } catch {}
      if (!moved || !finalExists) {
        throw new Error('Final image not present after move operation');
      }

      console.log(` Image moved from ${processedImagePath} to ${finalImagePath}`);
      try {
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'move_complete',
          message: 'Image moved to final location',
          metadata: { imageMappingId, finalImagePath }
        });
      } catch {}
      return finalImagePath;
    } catch (error) {
      console.error(` Error moving image to final location:`, error);
      try {
        this._logStructured({
          level: 'error',
          stepName: 'image_generation',
          subStep: 'move_failed',
          message: 'Failed to move image to final location',
          metadata: { error: String(error && error.message || error) }
        });
      } catch {}
      return null;
    }
  }

  /**
   * Update image paths in database after processing
   * @param {string} imageMappingId - Unique identifier for the image
   * @param {string|null} tempImagePath - New temp image path (null to clear)
   * @param {string|null} finalImagePath - New final image path (null to clear)
   * @returns {Promise<boolean>} Success status
   */
  async updateImagePaths(imageMappingId, tempImagePath, finalImagePath) {
    try {
      if (this.backendAdapter) {
        // Update the database with new paths
        await this.backendAdapter.updateImagePathsByMappingId(imageMappingId, tempImagePath, finalImagePath);
        console.log(` Updated image paths for ${imageMappingId}: temp=${tempImagePath}, final=${finalImagePath}`);
        return true;
      } else {
        console.warn('️ No backendAdapter available for updating image paths');
        return false;
      }
    } catch (error) {
      console.error(` Error updating image paths for ${imageMappingId}:`, error);
      return false;
    }
  }
}

module.exports = { JobRunner };