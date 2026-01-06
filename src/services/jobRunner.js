const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

// Import existing CLI modules
const producePictureModule = require(path.join(__dirname, '../producePictureModule'));
const paramsGeneratorModule = require(path.join(__dirname, '../paramsGeneratorModule'));
const aiVision = require(path.join(__dirname, '../aiVision'));

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
  async _generateImagesPerGeneration(_config, parameters, generations) {
    const startTime = Date.now();
    try {
      // Compute expected variations per generation dynamically; no fixed "4 per gen" legacy
      const allProcessed = [];
      let expectedTotalAcrossGens = 0;
      // Derive per-call timeout: enabled -> minutes to ms, else default 30s
      const enableTimeoutFlag = _config?.parameters?.enablePollingTimeout === true;
      const timeoutMinutesRaw = Number(_config?.parameters?.pollingTimeout);
      const perCallTimeoutMs = enableTimeoutFlag && Number.isFinite(timeoutMinutesRaw)
        ? Math.max(1000, timeoutMinutesRaw * 60 * 1000)
        : 30_000;

      for (let genIndex = 0; genIndex < generations; genIndex += 1) {
        // Determine expected variations for this generation (clamped)
        const requestedVariationsCfg = Math.max(1, Number((_config.parameters && _config.parameters.variations) || 1));
        const maxVariationsAllowed = Math.max(1, Math.min(20, Math.floor(10000 / Math.max(1, generations))));
        const effectiveVariationsForGen = Math.min(requestedVariationsCfg, maxVariationsAllowed);
        expectedTotalAcrossGens += effectiveVariationsForGen;

        // Re-generate parameters per generation to rotate keywords/prompts
        let genParameters;
        try {
          const cfgForGen = { ..._config, __forceSequentialIndex: genIndex, __perGen: true };
          // Enforce timeout on per-generation parameter generation to avoid orphaned runs on network loss
          genParameters = await this.withTimeout(
            this.generateParameters(cfgForGen),
            perCallTimeoutMs,
            `Parameter generation (gen ${genIndex + 1}) timed out`
          );
          this._logStructured({
            level: 'info',
            stepName: 'initialization',
            subStep: 'parameter_generation_per_gen',
            message: `Parameters generated for generation ${genIndex + 1}/${generations}`,
            metadata: { generationIndex: genIndex, hasPrompt: !!genParameters?.prompt }
          });
        } catch (_paramErr) {
          this._logStructured({
            level: 'error',
            stepName: 'initialization',
            subStep: 'parameter_generation_per_gen_error',
            message: `Parameter generation failed for generation ${genIndex + 1}: ${_paramErr.message}`,
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
          apiKeys: _config.apiKeys,
          // Pass through full parameters so provider-specific fields are available
          parameters: { ...(_config.parameters || {}) }
        };

        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'call_module',
          message: `Calling producePictureModule (generation ${genIndex + 1}/${generations})`,
          metadata: { imgNameBase, prompt: parameters.prompt, hasApiKeys: !!_config.apiKeys }
        });

        let result;
        const maxRetries = Math.max(0, Number(_config.parameters?.generationRetryAttempts ?? 1));
        const backoffMs = Math.max(0, Number(_config.parameters?.generationRetryBackoffMs ?? 0));
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
            const cfgForGen = { ..._config, __forceSequentialIndex: genIndex, __perGen: true };
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
              runwareDimensionsCsv: (_config.parameters && _config.parameters.runwareDimensionsCsv) || ''
            };

            result = await producePictureModule.producePictureModule(
              settings,
              imgNameBase,
              (_config.ai && _config.ai.metadataPrompt) ? _config.ai.metadataPrompt : null,
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
              // Count the entire generation as failed for the expected variations of this gen
              this.jobState.failedImages = (this.jobState.failedImages || 0) + effectiveVariationsForGen;
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
              const effectiveProc = (this.jobConfiguration && this.jobConfiguration.processing) ? this.jobConfiguration.processing : (_config.processing || {});
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
          } catch (_error) {
            const duration = Date.now() - startTime;
            this._logStructured({ level: 'error', stepName: 'image_generation', subStep: 'error', message: `Image generation failed: ${_error.message}`, durationMs: duration, errorCode: 'IMAGE_GEN_ERROR' });
            throw new Error(`Failed to generate images: ${_error.message}`);
          }
        }
    
        _buildModuleConfig(_config, parameters) {    const processingEnabled = !(_config.ai?.runQualityCheck === true);
    return {
      removeBg: processingEnabled ? (_config.processing?.removeBg || false) : false,
      imageConvert: processingEnabled ? (_config.processing?.imageConvert || false) : false,
      convertToJpg: processingEnabled ? (_config.processing?.convertToJpg || false) : false,
      convertToWebp: processingEnabled ? (_config.processing?.convertToWebp || false) : false,
      trimTransparentBackground: processingEnabled ? (_config.processing?.trimTransparentBackground || false) : false,
      aspectRatios: Array.isArray(parameters.aspectRatios) ? parameters.aspectRatios : (Array.isArray(_config.parameters?.aspectRatios) ? _config.parameters.aspectRatios : (typeof _config.parameters?.aspectRatios === 'string' ? [_config.parameters.aspectRatios] : ['1:1'])),
      pollingTimeout: _config.parameters?.enablePollingTimeout ? (_config.parameters?.pollingTimeout || 15) : null,
      pollingInterval: _config.parameters?.pollingInterval || 1,
      processMode: _config.parameters?.processMode || 'single',
      removeBgSize: processingEnabled ? (_config.processing?.removeBgSize || 'preview') : 'preview',
      runQualityCheck: _config.ai?.runQualityCheck || false,
      // Always handle metadata in JobRunner after images are persisted
      runMetadataGen: false,
      imageEnhancement: processingEnabled ? (_config.processing?.imageEnhancement || false) : false,
      sharpening: processingEnabled ? (_config.processing?.sharpening || 0) : 0,
      saturation: processingEnabled ? (_config.processing?.saturation || 1) : 1,
      jpgBackground: processingEnabled ? (_config.processing?.jpgBackground || 'white') : 'white',
      jpgQuality: processingEnabled ? (_config.processing?.jpgQuality || 85) : 85,
      pngQuality: processingEnabled ? (_config.processing?.pngQuality || 100) : 100,
      webpQuality: processingEnabled ? (_config.processing?.webpQuality || 85) : 85,
      outputDirectory: _config.filePaths?.tempDirectory || './pictures/generated',
      tempDirectory: _config.filePaths?.tempDirectory || './pictures/generated'
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

    const obj = {
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
    try {
      const soft = Array.isArray(item.softFailures) ? item.softFailures : [];
      if (soft.length > 0) {
        obj.metadata = { ...(obj.metadata || {}), failure: soft[0] };
      }
    } catch {}
    return obj;
  }
    /**
   * Get enabled progress steps - simplified for 2-step structure
   * @param {Object} config - Job configuration (not used in simplified version)
   * @returns {Array} Always returns the 2 base progress steps
   */
  _getEnabledProgressSteps(_config) {
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
  async startJob(_config) {
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
      const validationResult = this.validateConfiguration(_config);
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
        if (_config && _config.processing) {
          const { normalizeProcessingSettings } = require('../utils/processing');
          _config.processing = normalizeProcessingSettings(_config.processing);
        }
      } catch (_e) {
        // Continue without fatal error
      }

      // Load custom QC and Metadata prompt templates from files for regular jobs/reruns
      try {
        // Ensure ai object exists
        _config.ai = _config.ai || {};
        if (_config.filePaths?.qualityCheckPromptFile) {
          try {
            const qcText = await fs.readFile(_config.filePaths.qualityCheckPromptFile, 'utf8');
            if (qcText && qcText.trim() !== '') {
              _config.ai.qualityCheckPrompt = qcText;
            }
          } catch (_err) {
            console.warn('JobRunner: Failed to load qualityCheckPromptFile:', _err.message);
          }
        }
        if (_config.filePaths?.metadataPromptFile) {
          try {
            const mdText = await fs.readFile(_config.filePaths.metadataPromptFile, 'utf8');
            if (mdText && mdText.trim() !== '') {
              _config.ai.metadataPrompt = mdText;
            }
          } catch (_err) {
            console.warn('JobRunner: Failed to load metadataPromptFile:', _err.message);
          }
        }
      } catch (_e) {
        console.warn('JobRunner: prompt template load skipped:', _e.message);
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
        totalGenerations: Math.max(1, Number(_config?.parameters?.count || 1))
      };
      this.completedSteps = [];
      this.isStopping = false;
      
      // RESTORE the configurationId after resetting jobState
      this.configurationId = preservedConfigurationId;
      console.log(' RESTORED configurationId:', this.configurationId);
      
      // If previous job was completed, log it for debugging
      if (wasCompleted) {
        console.log(' Previous job was completed - resetting for new run');
      }

      console.log(' Job state initialized:', this.jobState);

      // Emit progress update
      this.emitProgress('initialization', 0, 'Initializing job configuration...');

      // Set environment variables from _config
      try {
        this.setEnvironmentFromConfig(_config);
      } catch (_e) {
        console.error(' Error in setEnvironmentFromConfig:', _e);
        console.error(' Error stack:', _e.stack);
        throw _e; // Re-throw to prevent silent failure
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
      } catch (_error) {
        console.error(' MODULE LOAD: Could not initialize backend adapter for database integration:', _error);
        console.error(' MODULE LOAD: Error stack:', _error.stack);
        console.warn(' MODULE LOAD: Job executions will not be saved to database');
        console.warn(' MODULE LOAD: Frontend will continue to show no data');
      }

      // Store the job configuration for progress step filtering
      this.jobConfiguration = _config;
      
      
      // Update progress steps based on job configuration
      PROGRESS_STEPS = this._getEnabledProgressSteps(_config);
      
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

      this.currentJob = this.executeJob(_config, jobId);
      // Save job execution to database if backendAdapter is available
      // BUT NOT during reruns (reruns are handled by the backend rerun handler)
      if (this.backendAdapter && !this.isRerun) {
        try {
          console.log(" Saving job execution to database...");
          // Compute a persisted fallback label if none provided
          const providedLabel = (_config && _config.parameters && typeof _config.parameters.label === 'string')
            ? _config.parameters.label.trim()
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
                const { apiKeys, ...sanitized } = (_config || {});
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
                // Ensure processing.removeBgFailureMode is persisted in execution snapshot
                try {
                  if (!sanitized.processing) sanitized.processing = {};
                  const modeFromConfig = (_config && _config.processing && _config.processing.removeBgFailureMode) ? String(_config.processing.removeBgFailureMode) : undefined;
                  const existing = (sanitized.processing && sanitized.processing.removeBgFailureMode) ? String(sanitized.processing.removeBgFailureMode) : undefined;
                  const mode = modeFromConfig || existing;
                  sanitized.processing.removeBgFailureMode = (mode === 'mark_failed' || mode === 'approve') ? mode : (mode ? mode : 'approve');
                } catch (_e) {}
                return sanitized || null;
              } catch (_e) {
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
        } catch (_error) {
          console.error(" Failed to save job execution to database:", _error);
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

    } catch (_error) {
      console.error(' Error starting job in JobRunner:', _error);
      this.jobState.status = 'error';
      this.jobState.error = _error.message;
      
      return {
        success: false,
        error: _error.message,
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
  validateConfiguration(_config) {
    console.log(' validateConfiguration called');
    // Never log raw API keys
    // do not log apiKeys presence explicitly
    console.log(' _config.filePaths:', _config.filePaths);
    console.log(' _config.parameters:', _config.parameters);
    
    // Check required API keys
    if (!_config.apiKeys || !_config.apiKeys.openai) {
      console.log(' Required credential missing: openai');
      return { valid: false, error: 'OpenAI API key is required' };
    }
    if (!_config.apiKeys.runware) {
      console.log(' Required credential missing: runware');
      return { valid: false, error: 'Runware API key is required' };
    }

    // Check file paths
    if (!_config.filePaths || !_config.filePaths.outputDirectory) {
      console.log(' Output directory missing');
      return { valid: false, error: 'Output directory is required' };
    }

    // Check parameters
    if (!_config.parameters || !_config.parameters.processMode) {
      console.log(' Process mode missing');
      return { valid: false, error: 'Process mode is required' };
    }

    console.log(' Configuration validation passed');
    return { valid: true };
  }

  /**
   * Set environment variables from configuration
   * @param {Object} _config - Job configuration
   */
  setEnvironmentFromConfig(_config) {
    // Never log raw API keys or even variable presence details
    console.log(' Credentials checked');
    
    // Set API keys
    if (_config.apiKeys.openai) {
      process.env.OPENAI_API_KEY = _config.apiKeys.openai;
      console.log(' Provider initialized: openai');
    }
    if (_config.apiKeys.runware) {
      process.env.RUNWARE_API_KEY = _config.apiKeys.runware;
      console.log(' Provider initialized: runware');
    }
    if (_config.apiKeys.removeBg) {
      process.env.REMOVE_BG_API_KEY = _config.apiKeys.removeBg;
      console.log(' Provider initialized: remove.bg');
    }

    // Set other environment variables as needed
    if (_config.advanced && _config.advanced.debugMode) {
      process.env.DEBUG_MODE = 'true';
      console.log(' Debug mode enabled');
    }
    
    console.log(' Environment credentials finalized');
  }

  async _verifyQCStatus(dbImg, expectedStatus, expectedReason) {
    if (!this.backendAdapter || !dbImg || !dbImg.id) return;
    try {
      const check = await this.backendAdapter.getGeneratedImage(dbImg.id);
      if (check && check.success && check.image) {
        if (check.image.qcStatus !== expectedStatus) {
          this._logStructured({
            level: 'error',
            stepName: 'image_generation',
            subStep: 'qc_status_mismatch',
            message: `QC status verification failed! Expected ${expectedStatus}, got ${check.image.qcStatus}`,
            metadata: { 
              id: dbImg.id, 
              mappingKey: dbImg.imageMappingId,
              dbStatus: check.image.qcStatus,
              dbReason: check.image.qcReason
            }
          });
          // Force update by ID
          await this.backendAdapter.updateQCStatus(dbImg.id, expectedStatus, expectedReason);
          this._logStructured({
            level: 'info',
            stepName: 'image_generation',
            subStep: 'qc_status_correction',
            message: `Forced QC status update by ID ${dbImg.id}`,
            metadata: { id: dbImg.id, status: expectedStatus }
          });
        } else {
           this._logStructured({
            level: 'info',
            stepName: 'image_generation',
            subStep: 'qc_status_verified',
            message: `QC status verified: ${expectedStatus}`,
            metadata: { id: dbImg.id }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to verify QC status:', e);
    }
  }

  /**
   * Execute the job with the given configuration
   * @param {Object} config - Job configuration
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async executeJob(_config, jobId) {
    try {
      console.log(' Starting job execution with clean 2-step workflow...');
      
      // Create AbortController to support immediate abort on force stop
      try {
        const AC = global.AbortController || (function() {
          try {
            return require('abort-controller');
          } catch (_e) {
            return null;
          }
        })();
        
        if (AC) {
          this.abortController = new AC();
        } else {
          console.warn('AbortController not available - force stop might not be immediate');
        }
      } catch (_e) {
        console.warn('Failed to initialize AbortController:', _e.message);
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
      const pollingTimeoutMinutes = Number(_config?.parameters?.pollingTimeout);
      const initTimeoutMs = (_config?.parameters?.enablePollingTimeout === true)
        ? (Number.isFinite(pollingTimeoutMinutes) ? pollingTimeoutMinutes * 60 * 1000 : 30_000)
        : 30_000;
      const parameters = await this.withTimeout(
        this.generateParameters({ ..._config, __abortSignal: this.abortController?.signal }),
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
        images = await this.generateImages({ ..._config, __abortSignal: this.abortController?.signal }, parameters);
        this._logStructured({
          level: 'info',
          stepName: 'image_generation',
          subStep: 'complete',
          message: ` Generated ${images?.length || 0} images successfully`
        });
      } catch (_error) {
        this._logStructured({
          level: 'error',
          stepName: 'image_generation',
          subStep: 'error',
          message: ` Image generation failed: ${_error.message}`
        });
        throw _error;
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
                const effectiveProc = (this.jobConfiguration && this.jobConfiguration.processing) ? this.jobConfiguration.processing : (_config.processing || {});
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
                    removeBgFailureMode: (typeof effectiveProc.removeBgFailureMode === 'string' ? effectiveProc.removeBgFailureMode : 'approve'),
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
            } catch (_immediateMoveErr) {
              console.error(' Immediate move (QC disabled) failed:', _immediateMoveErr);
              try {
                this._logStructured({
                  level: 'error',
                  stepName: 'image_generation',
                  subStep: 'immediate_move_exception',
                  message: 'QC disabled: exception during immediate move',
                  metadata: { error: String(_immediateMoveErr && _immediateMoveErr.message || _immediateMoveErr) }
                });
              } catch {}
            }
          }
        } catch (_error) {
          console.error(" Failed to save generated images to database:", _error);
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
              // Declare at a higher scope so they are available for the move/reconcile logic below
              let processingConfig = {};
              let removeBgProcessingThrew = false;
              let skipFinalDueToMarkFailed = false;

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
                  const paramsCfg = this.jobConfiguration?.parameters || {};
                  const enableTimeoutCfg = paramsCfg?.enablePollingTimeout === true;
                  const timeoutMinutesCfg = enableTimeoutCfg && Number.isFinite(Number(paramsCfg?.pollingTimeout))
                    ? Number(paramsCfg.pollingTimeout)
                    : undefined;
                  // Prefer per-image snapshot for processing settings when available
                  let perImageProcessing = undefined;
                  try {
                    if (dbImg && typeof dbImg.processingSettings === 'string' && dbImg.processingSettings.trim().startsWith('{')) {
                      perImageProcessing = JSON.parse(dbImg.processingSettings);
                    }
                  } catch {}
                  const effectiveRemoveBgFailureMode = (perImageProcessing && perImageProcessing.removeBgFailureMode)
                    ? perImageProcessing.removeBgFailureMode
                    : (proc.removeBgFailureMode || 'approve');
                  
                  processingConfig = {
                    tempDirectory: tempProcessingDir,
                    outputDirectory: tempProcessingDir,
                    _softFailures: [],
                    removeBg: !!(perImageProcessing?.removeBg ?? proc.removeBg),
                    imageConvert: !!(perImageProcessing?.imageConvert ?? proc.imageConvert),
                    convertToJpg: !!(perImageProcessing?.convertToJpg ?? proc.convertToJpg),
                    convertToWebp: !!(perImageProcessing?.convertToWebp ?? proc.convertToWebp),
                    trimTransparentBackground: !!(perImageProcessing?.trimTransparentBackground ?? proc.trimTransparentBackground),
                    imageEnhancement: !!(perImageProcessing?.imageEnhancement ?? proc.imageEnhancement),
                    sharpening: (perImageProcessing && typeof perImageProcessing.sharpening !== 'undefined') ? perImageProcessing.sharpening : (proc.sharpening ?? 0),
                    saturation: (perImageProcessing && typeof perImageProcessing.saturation !== 'undefined') ? perImageProcessing.saturation : (proc.saturation ?? 1),
                    jpgBackground: (perImageProcessing && perImageProcessing.jpgBackground) ? perImageProcessing.jpgBackground : (proc.jpgBackground || 'white'),
                    removeBgSize: (perImageProcessing && perImageProcessing.removeBgSize) ? perImageProcessing.removeBgSize : (proc.removeBgSize || 'preview'),
                    removeBgFailureMode: effectiveRemoveBgFailureMode,
                    jpgQuality: (perImageProcessing && typeof perImageProcessing.jpgQuality !== 'undefined') ? perImageProcessing.jpgQuality : (proc.jpgQuality ?? 85),
                    pngQuality: (perImageProcessing && typeof perImageProcessing.pngQuality !== 'undefined') ? perImageProcessing.pngQuality : (proc.pngQuality ?? 100),
                    webpQuality: (perImageProcessing && typeof perImageProcessing.webpQuality !== 'undefined') ? perImageProcessing.webpQuality : (proc.webpQuality ?? 85)
                  };
                  if (Number.isFinite(timeoutMinutesCfg)) {
                    processingConfig.pollingTimeout = timeoutMinutesCfg;
                  }
                  // Guard flag: in Mark Failed mode with remove.bg enabled, do not move to final unless remove.bg applied successfully
                  skipFinalDueToMarkFailed = false;
                  // Track if processing threw, for a consolidated override later
                  removeBgProcessingThrew = false;
                  try {
                    if (processingConfig.removeBg === true && String(processingConfig.removeBgFailureMode || 'approve') === 'mark_failed') {
                      skipFinalDueToMarkFailed = true;
                    }
                  } catch {}
                  // Explicit guard: if Mark Failed selected and remove.bg key is missing, fail immediately
                  try {
                    const missingKey = !process.env.REMOVE_BG_API_KEY || String(process.env.REMOVE_BG_API_KEY).trim() === '';
                    if (processingConfig.removeBg === true && processingConfig.removeBgFailureMode === 'mark_failed' && missingKey && this.backendAdapter) {
                      const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                      this._logStructured({
                        level: 'warn',
                        stepName: 'image_generation',
                        subStep: 'qc_pass_processing_missing_key_mark_failed',
                        message: 'REMOVE_BG_API_KEY missing while Mark Failed is selected; marking image qc_failed',
                        metadata: { imageMappingId: mappingKey }
                      });
                      // Update by mappingId with fallback to numeric id if needed
                      try {
                        const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                        if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                          try {
                            await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                          } catch {}
                        }
                        
                        // Use try-catch to prevent verification logic from failing the entire block
                        try {
                          await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                        } catch {}
                      } catch {}
                      try {
                        this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                        this._markFailedMappingIds.add(mappingKey);
                      } catch {}
                      try {
                        dbImg.qcStatus = "qc_failed";
                        dbImg.qcReason = "processing_failed:remove_bg";
                      } catch {}
                      continue;
                    }
                  } catch {}
                  const sourceFileName = pathMod.basename(sourcePath);
                  const processedImagePath = await producePictureModule.processImage(sourcePath, sourceFileName, processingConfig);
                  if (processedImagePath) {
                    // If Mark Failed is selected and remove.bg did NOT actually apply, force fail
                    try {
                      const applied = !!processingConfig._removeBgApplied;
                      if (processingConfig.removeBg === true && processingConfig.removeBgFailureMode === 'mark_failed' && applied === false && this.backendAdapter) {
                        const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                        this._logStructured({
                          level: 'warn',
                          stepName: 'image_generation',
                          subStep: 'qc_pass_processing_not_applied_mark_failed',
                          message: 'remove.bg did not apply while Mark Failed is selected; marking image qc_failed',
                          metadata: { imageMappingId: mappingKey }
                        });
                      // Update by mappingId with fallback to numeric id if needed
                      try {
                        const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                        if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                          try {
                            await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                          } catch {}
                        }
                        
                        // Use try-catch to prevent verification logic from failing the entire block
                        try {
                          await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                        } catch {}
                      } catch {}
                        try {
                          this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                          this._markFailedMappingIds.add(mappingKey);
                        } catch {}
                        try {
                          dbImg.qcStatus = "qc_failed";
                          dbImg.qcReason = "processing_failed:remove_bg";
                        } catch {}
                        continue;
                      }
                      // remove.bg applied successfully, allow move to final
                      try {
                        if (processingConfig.removeBg === true && String(processingConfig.removeBgFailureMode || 'approve') === 'mark_failed' && applied === true) {
                          skipFinalDueToMarkFailed = false;
                        }
                      } catch {}
                    } catch {}
                    pathForFinal = processedImagePath;
                  }
                  // If remove.bg produced a soft-failure but mode requires mark_failed, enforce fail here
                  try {
                    const hadSoftRemoveBg = Array.isArray(processingConfig._softFailures) && processingConfig._softFailures.some(f => f && f.stage === 'remove_bg');
                    if (processingConfig.removeBgFailureMode === 'mark_failed' && hadSoftRemoveBg && this.backendAdapter) {
                      const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                      this._logStructured({
                        level: 'warn',
                        stepName: 'image_generation',
                        subStep: 'qc_pass_processing_soft_removebg_mark_failed',
                        message: 'Detected soft remove.bg failure with Mark Failed mode; marking image qc_failed',
                        metadata: { imageMappingId: mappingKey }
                      });
                      // Update by mappingId with fallback to numeric id if needed
                      try {
                        const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                        if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                          try {
                            await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                          } catch {}
                        }
                        
                        // Use try-catch to prevent verification logic from failing the entire block
                        try {
                          await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                        } catch {}
                      } catch {}
                      // Skip moving to final when marked failed
                      try {
                        this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                        this._markFailedMappingIds.add(mappingKey);
                      } catch {}
                      try {
                        dbImg.qcStatus = "qc_failed";
                        dbImg.qcReason = "processing_failed:remove_bg";
                      } catch {}
                      continue;
                    }
                  } catch {}
                } catch (procErr) {
                  try {
                    this._logStructured({
                      level: 'warn',
                      stepName: 'image_generation',
                      subStep: 'qc_pass_processing_catch',
                      message: 'QC-pass processing threw; evaluating failure mode',
                      metadata: {
                        imageMappingId: dbImg.imageMappingId || dbImg.mappingId || dbImg.id,
                        error: String(procErr && procErr.message || procErr),
                        stage: procErr && procErr.stage ? procErr.stage : undefined,
                        removeBgFailureMode: processingConfig.removeBgFailureMode
                      }
                    });
                  } catch {}
                  // Remember that processing threw for consolidated override
                  try { removeBgProcessingThrew = true; } catch {}
                  // Honor the effective mode we actually used for QC-pass processing
                  if (processingConfig.removeBgFailureMode === 'mark_failed' && this.backendAdapter) {
                    try {
                      const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                      this._logStructured({
                        level: 'warn',
                        stepName: 'image_generation',
                        subStep: 'qc_pass_processing_mark_failed',
                        message: 'QC-pass processing failed at remove.bg with Mark Failed mode; marking image qc_failed',
                        metadata: {
                          imageMappingId: mappingKey,
                          error: String(procErr && procErr.message || procErr)
                        }
                      });
                      // Update by mappingId with fallback to numeric id if needed
                      try {
                        const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                        if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                          try {
                            await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                          } catch {}
                        }
                        
                        // Use try-catch to prevent verification logic from failing the entire block
                        try {
                          await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                        } catch {}
                      } catch {}
                      try {
                        this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                        this._markFailedMappingIds.add(mappingKey);
                      } catch {}
                      try {
                        dbImg.qcStatus = "qc_failed";
                        dbImg.qcReason = "processing_failed:remove_bg";
                      } catch {}
                      try {
                        this._logStructured({
                          level: 'info',
                          stepName: 'image_generation',
                          subStep: 'qc_pass_processing_skip_move',
                          message: 'Skipping move to final due to mark_failed handling',
                          metadata: { imageMappingId: mappingKey }
                        });
                      } catch {}
                      // Skip moving to final when marked failed
                      continue;
                    } catch (_e) {}
                  }
                  console.warn('QC-pass processing failed, using original temp image for move:', procErr?.message || procErr);
                  // Hard guard: if Mark Failed mode was active, do not move to final even if we reached here
                  try {
                    if (skipFinalDueToMarkFailed === true) {
                      const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                      // Force QC status to failed as a last-resort correction when in Mark Failed mode
                      try {
                        if (this.backendAdapter) {
                          const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                          if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                            try {
                              await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                            } catch {}
                          }
                          await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                          try {
                            this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                            this._markFailedMappingIds.add(mappingKey);
                          } catch {}
                          try {
                            dbImg.qcStatus = "qc_failed";
                            dbImg.qcReason = "processing_failed:remove_bg";
                          } catch {}
                        }
                      } catch {}
                      this._logStructured({
                        level: 'info',
                        stepName: 'image_generation',
                        subStep: 'qc_pass_processing_skip_move_guard',
                        message: 'Guard active: Mark Failed mode; skipping move to final',
                        metadata: { imageMappingId: mappingKey }
                      });
                      continue;
                    }
                  } catch {}
                }
              }

              // Consolidated override: if in Mark Failed mode and remove.bg threw or did not apply or soft-failed, force qc_failed and skip move
              try {
                const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                const hadSoftRemoveBg = Array.isArray(processingConfig._softFailures) && processingConfig._softFailures.some(f => f && f.stage === 'remove_bg');
                const applied = !!processingConfig._removeBgApplied;
                const markFailedMode = (processingConfig.removeBg === true && String(processingConfig.removeBgFailureMode || 'approve') === 'mark_failed');
                if (markFailedMode && (removeBgProcessingThrew === true || hadSoftRemoveBg || applied === false)) {
                  try {
                    this._logStructured({
                      level: 'warn',
                      stepName: 'image_generation',
                      subStep: 'qc_pass_processing_consolidated_override',
                      message: 'Consolidated override: Forcing qc_failed due to Mark Failed remove.bg failure',
                      metadata: { imageMappingId: mappingKey }
                    });
                  } catch {}
                  if (this.backendAdapter) {
                    try {
                      const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                      if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                        try {
                          await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                        } catch {}
                      }
                      await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                    } catch {}
                  }
                  try {
                    this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                    this._markFailedMappingIds.add(mappingKey);
                    dbImg.qcStatus = "qc_failed";
                    dbImg.qcReason = "processing_failed:remove_bg";
                  } catch {}
                  // Skip moving to final
                  continue;
                }
              } catch {}

              // Extra guard immediately before attempting to move to final
              try {
                if (skipFinalDueToMarkFailed === true) {
                  const mappingKey = dbImg.imageMappingId || dbImg.mappingId || dbImg.id;
                  // Force QC status to failed as a last-resort correction when in Mark Failed mode
                  try {
                    if (this.backendAdapter) {
                      const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", "processing_failed:remove_bg");
                      if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                        try {
                          await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", "processing_failed:remove_bg");
                        } catch {}
                      }
                      await this._verifyQCStatus(dbImg, "qc_failed", "processing_failed:remove_bg");
                      try {
                        this._markFailedMappingIds = this._markFailedMappingIds || new Set();
                        this._markFailedMappingIds.add(mappingKey);
                      } catch {}
                      try {
                        dbImg.qcStatus = "qc_failed";
                        dbImg.qcReason = "processing_failed:remove_bg";
                      } catch {}
                    }
                  } catch {}
                  this._logStructured({
                    level: 'info',
                    stepName: 'image_generation',
                    subStep: 'qc_pass_processing_skip_move_guard_post',
                    message: 'Guard active (post-QC): Mark Failed mode; skipping move to final',
                    metadata: { imageMappingId: mappingKey }
                  });
                  continue;
                }
              } catch {}
              try {
                this._logStructured({
                  level: 'info',
                  stepName: 'image_generation',
                  subStep: 'move_to_final_start',
                  message: 'Moving image to final location',
                  metadata: { imageMappingId: dbImg.imageMappingId || dbImg.mappingId || dbImg.id, pathForFinal }
                });
              } catch {}
              const movedFinal = await this.moveImageToFinalLocation(pathForFinal, dbImg.imageMappingId || dbImg.mappingId || dbImg.id);
              if (movedFinal) {
                await this.updateImagePaths(dbImg.imageMappingId || dbImg.mappingId || dbImg.id, null, movedFinal);
                try {
                  this._logStructured({
                    level: 'info',
                    stepName: 'image_generation',
                    subStep: 'move_to_final_done',
                    message: 'Image moved and DB updated with final path',
                    metadata: { imageMappingId: dbImg.imageMappingId || dbImg.mappingId || dbImg.id, finalPath: movedFinal }
                  });
                } catch {}
              } else {
                // Fallback: if the processed path already points to a valid file, persist it as final
                try {
                  const fsSync = require('fs');
                  if (pathForFinal && typeof pathForFinal === 'string' && fsSync.existsSync(pathForFinal)) {
                    await this.updateImagePaths(dbImg.imageMappingId || dbImg.mappingId || dbImg.id, null, pathForFinal);
                    try {
                      this._logStructured({
                        level: 'info',
                        stepName: 'image_generation',
                        subStep: 'move_to_final_fallback_db_update',
                        message: 'Move to final returned empty; persisted existing processed path as final',
                        metadata: { imageMappingId: dbImg.imageMappingId || dbImg.mappingId || dbImg.id, finalPath: pathForFinal }
                      });
                    } catch {}
                  } else {
                    try {
                      this._logStructured({
                        level: 'warn',
                        stepName: 'image_generation',
                        subStep: 'move_to_final_failed',
                        message: 'Move to final failed and no valid processed path available; final path remains unset',
                        metadata: { imageMappingId: dbImg.imageMappingId || dbImg.mappingId || dbImg.id }
                      });
                    } catch {}
                  }
                } catch {}
              }
            }
          }
        }
      } catch (qcErr) {
        console.error(' QC/move phase error:', qcErr);
      }
      
      // Safety reconcile: ensure approved images have a final path persisted
      try {
        if (this.backendAdapter && this.databaseExecutionId) {
          const saved = await this.getSavedImagesForExecution(this.databaseExecutionId);
          if (Array.isArray(saved)) {
            for (const img of saved) {
              const mappingKey = img.imageMappingId || img.mappingId || img.id;
              const hasFinal = !!(img.finalImagePath || img.final_image_path);
              const approved = String(img.qcStatus || img.qc_status) === 'approved';
              const candidatePath = img.finalImagePath || img.final_image_path || img.tempImagePath || img.temp_image_path || img.path;
              // If this image was locally marked failed during QC-pass processing, skip reconciliation
              try {
                if (this._markFailedMappingIds && this._markFailedMappingIds.has(mappingKey)) {
                  continue;
                }
              } catch {}
              // Global guard: if job is configured with Mark Failed for remove.bg, never reconcile approved images into final
              try {
                const proc = this.jobConfiguration?.processing || {};
                // Only apply this guard if the image does NOT already have a final path
                // If it has a final path (hasFinal is true), it was successfully processed and moved, so we should NOT fail it.
                if (!hasFinal && proc && proc.removeBg === true && String(proc.removeBgFailureMode || 'approve') === 'mark_failed') {
                  this._logStructured({
                    level: 'warn',
                    stepName: 'image_generation',
                    subStep: 'approved_no_final_move_skip_mark_failed',
                    message: 'Skipping approved reconcile due to Mark Failed mode',
                    metadata: { imageMappingId: mappingKey }
                  });
                  
                  // CRITICAL FIX: Also force qc_failed status here because if we are skipping reconcile,
                  // the image is effectively failed but might be marked approved by runQualityChecks.
                  try {
                    if (this.backendAdapter) {
                      const failureReason = "processing_failed:remove_bg";
                      const res = await this.backendAdapter.updateQCStatusByMappingId(mappingKey, "qc_failed", failureReason);
                      if (!(res && res.success && res.changes > 0) && /^(\d+)$/.test(String(mappingKey))) {
                        try {
                          await this.backendAdapter.updateQCStatus(Number(mappingKey), "qc_failed", failureReason);
                        } catch {}
                      }
                      try {
                        // await this._verifyQCStatus(img, "qc_failed", failureReason);
                      } catch {}
                    }
                  } catch {}
                  
                  continue;
                }
              } catch {}
              if (approved && !hasFinal && candidatePath && typeof candidatePath === 'string') {
                try {
                  this._logStructured({
                    level: 'info',
                    stepName: 'image_generation',
                    subStep: 'approved_no_final_move_start',
                    message: 'Approved image missing final path; attempting move',
                    metadata: { imageMappingId: mappingKey, candidatePath }
                  });
                } catch {}
                const moved = await this.moveImageToFinalLocation(candidatePath, mappingKey);
                if (moved) {
                  await this.updateImagePaths(mappingKey, null, moved);
                  try {
                    this._logStructured({
                      level: 'info',
                      stepName: 'image_generation',
                      subStep: 'approved_no_final_move_done',
                      message: 'Approved image final path reconciled',
                      metadata: { imageMappingId: mappingKey, finalPath: moved }
                    });
                  } catch {}
                } else {
                  try {
                    this._logStructured({
                      level: 'warn',
                      stepName: 'image_generation',
                      subStep: 'approved_no_final_move_failed',
                      message: 'Failed to reconcile final path for approved image',
                      metadata: { imageMappingId: mappingKey }
                    });
                  } catch {}
                }
              }
            }
          }
        }
      } catch (_reconcileErr) {
        console.warn('️ Approved-image final path reconcile skipped:', _reconcileErr?.message || _reconcileErr);
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
                  } catch (_error) {
                    console.error(" Failed to update job execution in database:", _error);
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
                  } catch (_error) {
                    console.error(' Error processing next bulk rerun job:', _error);
                  }
                }
            
              } catch (_error) {
                console.error(' Job execution error:', _error);
                this.jobState.status = 'error';
                this.jobState.error = _error.message;
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
                      errorMessage: _error.message,
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
                  error: _error.message,
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
  async generateParameters(_config) {
    const startTime = Date.now();
    try {
      const abortSignal = _config?.__abortSignal;
      this._logStructured({
        level: 'info',
        stepName: 'initialization',
        subStep: 'parameter_generation',
        message: 'Starting parameter generation',
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          configKeys: Object.keys(_config || {}).filter(key => key !== 'apiKeys'),
          hasApiKeys: !!_config?.apiKeys,
          hasParameters: !!_config?.parameters,
          hasProcessing: !!_config?.processing,
          hasAI: !!_config?.ai,
          hasFilePaths: !!_config?.filePaths
        }
      });

      // Read keywords from file
      let keywords = 'default image';
      let systemPrompt = null;
      
      try {
        // Read keywords file
        if (_config.filePaths?.keywordsFile) {
          const fs = require('fs').promises;
          const keywordsContent = await fs.readFile(_config.filePaths.keywordsFile, 'utf8');
          
          // Check if this is a CSV file (contains commas and quotes)
          if (keywordsContent.includes(',') && keywordsContent.includes('"')) {
            // Parse CSV format
            const lines = keywordsContent.trim().split('\n').filter(line => line.trim());
            if (lines.length > 1) { // Need at least header + one data row
              const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
              // Choose data row based on keywordRandom toggle
              const keywordRandom = !!(_config.parameters && _config.parameters.keywordRandom);
              const dataStartIndex = 1;
              const dataEndIndex = lines.length - 1;
              let chosenIndex;
              if (keywordRandom) {
                chosenIndex = dataStartIndex + Math.floor(Math.random() * (dataEndIndex - dataStartIndex + 1));
              } else if (_config.__perGen && Number.isInteger(_config.__forceSequentialIndex)) {
                const span = (dataEndIndex - dataStartIndex + 1);
                chosenIndex = dataStartIndex + (_config.__forceSequentialIndex % span);
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
                metadata: { keywordsFile: _config.filePaths.keywordsFile, csvRow, headers }
              });
            }
          } else {
            // Parse as TXT format (one keyword per line)
            const keywordsList = keywordsContent.trim().split('\n').filter(line => line.trim());
            
            if (keywordsList.length > 0) {
              const keywordRandom = !!(_config.parameters && _config.parameters.keywordRandom);
              const seqIndex = (_config.__perGen && Number.isInteger(_config.__forceSequentialIndex))
                ? (_config.__forceSequentialIndex % keywordsList.length)
                : 0;
              const index = keywordRandom ? Math.floor(Math.random() * keywordsList.length) : seqIndex;
              keywords = keywordsList[index].trim();
              this._logStructured({
                level: 'debug',
                stepName: 'initialization',
                subStep: 'txt_parsed',
                message: `Read TXT keywords: ${keywords}`,
                metadata: { keywordsFile: _config.filePaths.keywordsFile, selectedKeyword: keywords, keywordRandom, seqIndex }
              });
            }
          }
        }
        
        // Read system prompt template
        if (_config.filePaths?.systemPromptFile) {
          const fs = require('fs').promises;
          systemPrompt = await fs.readFile(_config.filePaths.systemPromptFile, 'utf8');
          this._logStructured({
            level: 'debug',
            stepName: 'initialization',
            subStep: 'system_prompt_read',
            message: `Read system prompt template from file`,
            metadata: { systemPromptFile: _config.filePaths.systemPromptFile, systemPromptLength: systemPrompt.length }
          });
        }
      } catch (fileError) {
        this._logStructured({
          level: 'warn',
          stepName: 'initialization',
          subStep: 'file_read_warning',
          message: `Warning: Could not read keywords or system prompt files, using defaults`,
          metadata: { error: fileError.message, keywordsFile: _config.filePaths?.keywordsFile, systemPromptFile: _config.filePaths?.systemPromptFile }
        });
      }
      
      // Ensure aspectRatios is always an array; support comma-separated input like "16:9,1:1,9:16"
      let aspectRatios = _config.parameters?.aspectRatios || ['1:1'];
      if (typeof aspectRatios === 'string') {
        const raw = aspectRatios;
        aspectRatios = raw.includes(',')
          ? raw.split(',').map(r => r.trim()).filter(Boolean)
          : [raw.trim()];
      } else if (!Array.isArray(aspectRatios)) {
        aspectRatios = ['1:1'];
      }
      
      const mjVersion = _config.parameters?.mjVersion || '6';
      
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
          hasSystemPrompt: !!_config.parameters?.systemPrompt,
          systemPromptLength: _config.parameters?.systemPrompt?.length || 0,
          openaiModel: _config.parameters?.openaiModel 
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
          openaiModel: _config.parameters?.openaiModel || 'gpt-4o',
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
      
    } catch (_error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'initialization',
        subStep: 'parameter_generation_error',
        message: `Parameter generation failed: ${_error.message}`,
        durationMs: duration,
        errorCode: 'PARAM_GEN_ERROR',
        metadata: { error: _error.message, stack: _error.stack }
      });
      
      console.error(' Error generating parameters:', _error);
      throw new Error(`Failed to generate parameters: ${_error.message}`);
    }
  }

  /**
   * Generate images using the existing producePictureModule
   * @param {Object} config - Job configuration
   * @param {Object} parameters - Generated parameters
   * @returns {Promise<Array>} Generated images
   */
  async generateImages(_config, parameters) {
    const startTime = Date.now();
    try {
      const abortSignal = _config?.__abortSignal;
      // If multiple generations requested, run per-generation orchestration to allow partial success
      const __genCount = Math.max(1, Number(_config?.parameters?.count || 1));
      if (__genCount > 1) {
        return await this._generateImagesPerGeneration(_config, parameters, __genCount);
      }
      this._logStructured({
        level: 'info',
        stepName: 'image_generation',
        subStep: 'start',
        message: 'Starting image generation',
        updateProgress: true, // Update progress state for major step transition
        metadata: { 
          totalImages: _config.parameters?.processMode === 'single' ? 1 : 4,
          aspectRatios: parameters.aspectRatios,
          processMode: _config.parameters?.processMode
        }
      });


      
      // Prepare the configuration for producePictureModule
      console.log(` JobRunner: DEBUG - _config.filePaths:`, JSON.stringify(_config.filePaths, null, 2));
      // Clarify directory mapping in logs: temp is where generator writes first; final move goes to outputDirectory
      console.log(` JobRunner: DEBUG - OUTPUT directory (final):`, _config.filePaths?.outputDirectory);
      console.log(` JobRunner: DEBUG - TEMP directory (initial writes):`, _config.filePaths?.tempDirectory);
      
      // When QC is enabled, defer processing until retry flows (QC-first design)
      const processingEnabled = !(_config.ai?.runQualityCheck === true);
      const requestedVariations = Math.max(1, Math.min(20, Number(_config.parameters?.variations || 1)));
      const effectiveVariations = Math.min(requestedVariations, 20);
      const moduleConfig = {
        removeBg: processingEnabled ? (_config.processing?.removeBg || false) : false,
        removeBgFailureMode: processingEnabled ? ((_config.processing && (_config.processing).removeBgFailureMode) || 'soft') : 'soft',
        imageConvert: processingEnabled ? (_config.processing?.imageConvert || false) : false,
        convertToJpg: processingEnabled ? (_config.processing?.convertToJpg || false) : false,
        trimTransparentBackground: processingEnabled ? (_config.processing?.trimTransparentBackground || false) : false,
        aspectRatios: Array.isArray(parameters.aspectRatios)
          ? parameters.aspectRatios
          : (Array.isArray(_config.parameters?.aspectRatios)
              ? _config.parameters.aspectRatios
              : (typeof _config.parameters?.aspectRatios === 'string'
                  ? (_config.parameters.aspectRatios.includes(',')
                      ? _config.parameters.aspectRatios.split(',').map(r => r.trim()).filter(Boolean)
                      : [_config.parameters.aspectRatios.trim()])
                  : ['1:1'])),
        pollingTimeout: _config.parameters?.enablePollingTimeout ? (_config.parameters?.pollingTimeout || 15) : null, // 15 minutes if enabled, null if disabled
        pollingInterval: _config.parameters?.pollingInterval || 1, // 1 minute (from parameters settings)
        processMode: _config.parameters?.processMode || 'single',
        removeBgSize: processingEnabled ? (_config.processing?.removeBgSize || 'preview') : 'preview',
        runQualityCheck: _config.ai?.runQualityCheck || false,
        runMetadataGen: _config.ai?.runMetadataGen || false,
        // Image enhancement settings
        imageEnhancement: processingEnabled ? (_config.processing?.imageEnhancement || false) : false,
        sharpening: processingEnabled ? (_config.processing?.sharpening || 0) : 0,
        saturation: processingEnabled ? (_config.processing?.saturation || 1) : 1,
        jpgBackground: processingEnabled ? (_config.processing?.jpgBackground || 'white') : 'white',
        jpgQuality: processingEnabled ? (_config.processing?.jpgQuality || 90) : 90,
        pngQuality: processingEnabled ? (_config.processing?.pngQuality || 100) : 100,
        // Paths (QC-first): generator writes to temp first; later we move to outputDirectory
        outputDirectory: _config.filePaths?.outputDirectory || './pictures/generated',
        tempDirectory: _config.filePaths?.tempDirectory || './pictures/generated',
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
      const sanitizedParameters = { ...(_config.parameters || {}) };
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
        ..._config,
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
          hasApiKeys: !!_config.apiKeys
        }
      });
      
      
      const result = await producePictureModule.producePictureModule(
        settings, // Pass settings with API keys as first parameter
        imgNameBase,
        (_config.ai && _config.ai.metadataPrompt) ? _config.ai.metadataPrompt : null, // custom metadata prompt from file if provided
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
      
    } catch (_e) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'image_generation',
        subStep: 'error',
        message: `Image generation failed: ${_e.message}`,
        durationMs: duration,
        errorCode: 'IMAGE_GEN_ERROR',
        metadata: { error: _e.message, stack: _e.stack }
      });
      
      console.error(' Error generating images:', _e);
      throw new Error(`Failed to generate images: ${_e.message}`);
    }
  }

  /**
   * Remove backgrounds from images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
  async removeBackgrounds(_images, _config) {
    // Placeholder for future implementation
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
    } catch (_error) {
      console.error(' Error getting saved images:', _error);
      return [];
    }
  }

  /**
   * Run quality checks on images
   * @param {Array} images - List of image paths
   * @param {Object} config - Job configuration
   * @returns {Promise<void>}
   */
      async runQualityChecks(images, _config) {
        const startTime = Date.now();
        
        this._logStructured({
          level: 'info',
          stepName: 'ai_operations',
          subStep: 'quality_check_start',
          message: `Starting quality checks for ${images.length} images`,
          updateProgress: true, // Update progress state for major step transition
          metadata: { 
            imageCount: images.length,
            openaiModel: this.jobConfiguration?.parameters?.openaiModel || "gpt-4o",
            hasQualityCheckPrompt: !!this.jobConfiguration?.ai?.qualityCheckPrompt
          }
        });
          
        try {
          // Derive a per-image QC timeout: use Generation Timeout when enabled, otherwise default 30s
          const pollingTimeoutMinutesQC = Number(this.jobConfiguration?.parameters?.pollingTimeout);
          const qcTimeoutMs = (this.jobConfiguration?.parameters?.enablePollingTimeout === true)
            ? (Number.isFinite(pollingTimeoutMinutesQC) ? pollingTimeoutMinutesQC * 60 * 1000 : 30_000)
            : 30_000;
          
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
            const qcInputPath = image.finalImagePath || image.tempImagePath || image.final_image_path || image.temp_image_path || image.path;
            if (!qcInputPath) {
              throw new Error('QC input path is missing');
            }
            // Wrap QC call with timeout so network/DNS issues don't stall the entire job for too long
            result = await this.withTimeout(
              aiVision.runQualityCheck(
                qcInputPath, // Use finalImagePath when available, otherwise tempImagePath
                this.jobConfiguration?.parameters?.openaiModel || "gpt-4o",
                this.jobConfiguration?.ai?.qualityCheckPrompt || null
              ),
              qcTimeoutMs,
              'Quality check timed out'
            );
            
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
                } catch (_dbError) {
                  this._logStructured({
                    level: 'error',
                    stepName: 'ai_operations',
                    subStep: 'quality_check_db_error',
                    imageIndex: images.indexOf(image),
                    message: `Failed to update QC status in database: ${_dbError.message}`,
                    errorCode: 'QC_DB_UPDATE_ERROR',
                    metadata: { 
                      error: _dbError.message,
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
                } catch (_dbError) {
                  this._logStructured({
                    level: 'error',
                    stepName: 'ai_operations',
                    subStep: 'quality_check_db_error_failed',
                    imageIndex: images.indexOf(image),
                    message: `Failed to update QC status to failed in database: ${_dbError.message}`,
                    errorCode: 'QC_DB_UPDATE_FAILED_ERROR',
                    metadata: { 
                      error: _dbError.message,
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
        } catch (_e) {
          const duration = Date.now() - startTime;
          this._logStructured({
            level: 'error',
            stepName: 'ai_operations',
            subStep: 'quality_check_error',
            message: `Quality checks failed: ${_e.message}`,
            durationMs: duration,
            errorCode: 'QC_SYSTEM_ERROR',
            metadata: { 
              error: _e.message,
              stack: _e.stack,
              imageCount: images.length
            }
          });
          
          throw new Error(`Quality checks failed: ${_e.message}`);
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
  async generateMetadata(images, _config) {
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
          openaiModel: _config.parameters?.openaiModel || 'gpt-4o',
          hasMetadataPrompt: !!_config.ai?.metadataPrompt
        }
      });
      
      // Apply a timeout per-image to avoid hangs on network loss
      const pollingTimeoutMinutes = Number(_config?.parameters?.pollingTimeout);
      const metadataTimeoutMs = (_config?.parameters?.enablePollingTimeout === true)
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
              _config.ai?.metadataPrompt || null,
          _config.parameters?.openaiModel || 'gpt-4o'
            ),
            metadataTimeoutMs,
            'Metadata generation timed out'
          );
        } catch (_metaErr) {
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
                  message: String(_metaErr && _metaErr.message || _metaErr),
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
          // ARCHITECT NOTE (v1.1.5): Universal ID Bridge. mappingId (Runtime) || imageMappingId (Persisted).
          // This allows metadata generation to work across Initial Runs, Retries, and Reruns with Custom Settings.
          const mId = image.mappingId || image.imageMappingId;

          // Invariant Check: mappingId must be present
          if (!mId) {
            throw new Error(`Invariant failed: Cannot update metadata - missing mappingId for image ${image.id}`);
          }

          try {
            // Update database with new metadata using backendAdapter (safe, handles merging)
            // Note: generationPrompt update is skipped as updateGeneratedImageByMappingId only targets metadata
            const updateResult = await this.backendAdapter.updateGeneratedImageByMappingId(
              mId,
              { 
                metadata: image.metadata
              }
            );
            
            this._logStructured({
              level: 'debug',
              stepName: 'image_generation',
              subStep: 'metadata_db_updated',
              message: `Image metadata object updated for image ${image.id}`,
              metadata: { 
                imageId: image.id, 
                mappingId: mId,
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
              message: `Warning: Could not update metadata in database for image with mappingId ${mId}`,
              metadata: { mappingId: mId, error: dbError.message }
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
      
      
    } catch (_error) {
      const duration = Date.now() - startTime;
      this._logStructured({
        level: 'error',
        stepName: 'image_generation',
        subStep: 'metadata_error',
        message: `Metadata generation failed: ${_error.message}`,
        durationMs: duration,
        errorCode: 'METADATA_GEN_ERROR',
        metadata: { 
          error: _error.message,
          stack: _error.stack,
          imageCount: images.length
        }
      });
      
      throw new Error(`Metadata generation failed: ${_error.message}`);
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
    const currentStepIndex = PROGRESS_STEPS.findIndex(s => s.name === this.jobState.currentStep);
    const currentStepConfig = PROGRESS_STEPS[currentStepIndex];
    
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
  async processSingleImage(tempImagePath, _config) {
    try {
      console.log(` Processing image: ${tempImagePath}`);
      
      // For now, return the same path (no processing applied)
      // TODO: Implement actual image processing based on config
      console.log(`️ Image processing not yet implemented, returning original path: ${tempImagePath}`);
      return tempImagePath;
    } catch (_error) {
      console.error(` Error processing image ${tempImagePath}:`, _error);
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
          } catch (_error) {
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
      } catch (_err) {
        console.warn(`️ rename failed (${_err?.code || 'unknown'}). Falling back to copy+unlink`);
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
    } catch (_error) {
      console.error(` Error moving image to final location:`, _error);
      try {
        this._logStructured({
          level: 'error',
          stepName: 'image_generation',
          subStep: 'move_failed',
          message: 'Failed to move image to final location',
          metadata: { error: String(_error && _error.message || _error) }
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
    } catch (_error) {
      console.error(` Error updating image paths for ${imageMappingId}:`, _error);
      return false;
    }
  }
}

module.exports = { JobRunner };