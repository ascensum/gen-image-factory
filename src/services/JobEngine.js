/**
 * JobEngine - Pure Orchestration Layer
 * Extracted from: src/services/jobRunner.js
 * Pipeline: Init → ParamGen → ImageGen → QC → Metadata
 * Feature Toggle: FEATURE_MODULAR_JOB_ENGINE
 * Related ADRs: ADR-001, ADR-002, ADR-003, ADR-006
 */

const { EventEmitter } = require('events');
const path = require('path');

// Import existing pipeline modules
const producePictureModule = require(path.join(__dirname, '../producePictureModule'));
const paramsGeneratorModule = require(path.join(__dirname, '../paramsGeneratorModule'));

/**
 * JobEngine
 * 
 * Pure orchestration of image generation pipeline.
 * Returns Result Objects instead of persisting directly.
 * 
 * @NOTE: This is a SIMPLIFIED version for Phase 4.
 * Full extraction requires JobRepository (Story 3.2 Phase 1).
 */
class JobEngine extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.producePictureModule - Image generation module (DI)
   * @param {Object} options.paramsGeneratorModule - Parameter generation module (DI)
   */
  constructor(options = {}) {
    super();
    
    // Dependency Injection (ADR-003)
    this.producePictureModule = options.producePictureModule || producePictureModule;
    this.paramsGeneratorModule = options.paramsGeneratorModule || paramsGeneratorModule;
    
    // Internal state (no database dependencies)
    this.isStopping = false;
    this.abortController = null;
  }

  /**
   * Execute job orchestration pipeline
   * 
   * Pipeline Steps:
   * 1. Initialization - Validate config, setup parameters
   * 2. Parameter Generation - Generate prompts/keywords per generation
   * 3. Image Generation - Call producePictureModule for each generation
   * 4. Quality Control - Process QC status for generated images
   * 5. Metadata - Attach metadata to images
   * 
   * @param {Object} config - Job configuration
   * @param {AbortSignal} abortSignal - Optional abort signal for cancellation
   * @returns {Promise<JobResult>} Result object with generated images
   */
  async executeJob(config, abortSignal = null) {
    // Create internal abort controller if not provided
    this.abortController = abortSignal ? { signal: abortSignal } : new AbortController();
    this.isStopping = false;

    try {
      // Step 1: Initialization
      this.emit('progress', { step: 'initialization', progress: 0 });
      const validatedConfig = this._validateConfig(config);
      
      // Step 2: Calculate generations
      const generations = Math.max(1, Number(validatedConfig.parameters?.count || 1));
      const variations = Math.max(1, Number(validatedConfig.parameters?.variations || 1));
      
      this.emit('progress', { 
        step: 'initialization', 
        progress: 20,
        metadata: { generations, variations }
      });

      // Step 3: Execute per-generation pipeline
      const allImages = [];
      let successfulImages = 0;
      let failedImages = 0;

      for (let genIndex = 0; genIndex < generations; genIndex++) {
        // Check abort signal
        if (this._shouldAbort()) {
          this.emit('progress', { step: 'aborted', progress: 100 });
          return this._buildResult({
            status: 'aborted',
            images: allImages,
            successfulImages,
            failedImages,
            message: 'Job aborted by user'
          });
        }

        // Generate parameters for this generation
        let genParameters;
        try {
          genParameters = await this._generateParameters(validatedConfig, genIndex);
          this.emit('progress', {
            step: 'parameter_generation',
            progress: 20 + (genIndex / generations) * 10,
            metadata: { generationIndex: genIndex, hasPrompt: !!genParameters?.prompt }
          });
        } catch (paramErr) {
          this.emit('error', {
            step: 'parameter_generation',
            error: paramErr.message,
            generationIndex: genIndex
          });
          failedImages += variations;
          continue;
        }

        // Generate images for this generation
        try {
          const result = await this._generateImages(validatedConfig, genParameters, genIndex);
          
          // Process result
          const processedImages = this._processGenerationResult(result, genParameters, genIndex);
          allImages.push(...processedImages);
          successfulImages += processedImages.filter(img => img.qcStatus === 'approved').length;
          failedImages += processedImages.filter(img => img.qcStatus !== 'approved').length;

          this.emit('progress', {
            step: 'image_generation',
            progress: 30 + ((genIndex + 1) / generations) * 60,
            metadata: { 
              generationIndex: genIndex,
              generatedCount: processedImages.length,
              totalImages: allImages.length
            }
          });
        } catch (genErr) {
          this.emit('error', {
            step: 'image_generation',
            error: genErr.message,
            generationIndex: genIndex
          });
          failedImages += variations;
          continue;
        }
      }

      // Step 4: Finalize
      this.emit('progress', { step: 'finalization', progress: 95 });
      
      const finalResult = this._buildResult({
        status: 'completed',
        images: allImages,
        successfulImages,
        failedImages,
        message: `Job completed: ${successfulImages} successful, ${failedImages} failed`
      });

      this.emit('progress', { step: 'completed', progress: 100 });
      
      return finalResult;

    } catch (error) {
      this.emit('error', { step: 'execution', error: error.message });
      return this._buildResult({
        status: 'failed',
        images: [],
        successfulImages: 0,
        failedImages: 0,
        error: error.message
      });
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Request job abortion
   * Sets internal flag to stop processing
   */
  async abort() {
    this.isStopping = true;
    if (this.abortController && this.abortController.abort) {
      this.abortController.abort();
    }
    this.emit('progress', { step: 'aborting', progress: 100 });
  }

  /**
   * Check if job should abort
   * @private
   */
  _shouldAbort() {
    return this.isStopping || 
           (this.abortController?.signal?.aborted === true);
  }

  /**
   * Validate job configuration
   * @private
   */
  _validateConfig(config) {
    if (!config) {
      throw new Error('Job configuration is required');
    }

    if (!config.parameters) {
      throw new Error('Job parameters are required');
    }

    // Return validated config (could add more validation here)
    return config;
  }

  /**
   * Generate parameters for a specific generation
   * @private
   */
  async _generateParameters(config, genIndex) {
    const cfgForGen = { 
      ...config, 
      __forceSequentialIndex: genIndex, 
      __perGen: true 
    };

    // Call parameter generation module
    const parameters = await this.paramsGeneratorModule.generateParameters(cfgForGen);
    
    if (!parameters || !parameters.prompt) {
      throw new Error('Parameter generation failed: no prompt generated');
    }

    return parameters;
  }

  /**
   * Generate images for a specific generation
   * @private
   */
  async _generateImages(config, genParameters, genIndex) {
    const imgNameBase = `job_${Date.now()}_${genIndex}`;
    
    const settings = {
      prompt: genParameters.prompt,
      promptContext: genParameters.promptContext,
      apiKeys: config.apiKeys,
      parameters: { ...(config.parameters || {}) }
    };

    const moduleConfig = this._buildModuleConfig(config, genParameters, genIndex);

    // Call image generation module
    const result = await this.producePictureModule.producePictureModule(
      settings,
      imgNameBase,
      (config.ai && config.ai.metadataPrompt) ? config.ai.metadataPrompt : null,
      moduleConfig
    );

    return result;
  }

  /**
   * Build module configuration for image generation
   * @private
   */
  _buildModuleConfig(config, genParameters, genIndex) {
    const requestedVariations = Math.max(1, Number(config.parameters?.variations || 1));
    const generations = Math.max(1, Number(config.parameters?.count || 1));
    const maxAllowed = Math.max(1, Math.min(20, Math.floor(10000 / Math.max(1, generations))));
    const effectiveVariations = Math.min(requestedVariations, maxAllowed);

    return {
      generationIndex: genIndex,
      variations: effectiveVariations,
      runwareDimensionsCsv: (config.parameters && config.parameters.runwareDimensionsCsv) || '',
      processing: config.processing || {},
      ai: config.ai || {}
    };
  }

  /**
   * Process generation result into standardized image objects
   * @private
   */
  _processGenerationResult(result, genParameters, genIndex) {
    const images = [];

    if (Array.isArray(result)) {
      // Array of image paths
      result.forEach((item, index) => {
        images.push(this._buildImageObject(item, genParameters, index, genIndex, result.length));
      });
    } else if (typeof result === 'string') {
      // Single image path
      images.push(this._buildImageObject(result, genParameters, 0, genIndex, 1));
    } else if (result && typeof result === 'object' && Array.isArray(result.processedImages)) {
      // Structured result: { processedImages, failedItems }
      result.processedImages.forEach((item, index) => {
        images.push(this._buildImageObject(item, genParameters, index, genIndex, result.processedImages.length));
      });
      
      // Handle failed items
      if (Array.isArray(result.failedItems)) {
        result.failedItems.forEach((failedItem) => {
          images.push({
            imageMappingId: failedItem.mappingId || `failed_${genIndex}_${Date.now()}`,
            generationPrompt: genParameters.prompt || 'Generated image',
            seed: null,
            qcStatus: 'qc_failed',
            qcReason: `processing_failed:${failedItem.stage || 'processing'}`,
            tempImagePath: null,
            finalImagePath: null,
            metadata: {
              failure: {
                stage: failedItem.stage,
                vendor: failedItem.vendor,
                message: failedItem.message
              }
            }
          });
        });
      }
    }

    return images;
  }

  /**
   * Build standardized image object
   * @private
   */
  _buildImageObject(item, genParameters, index, genIndex, totalInGen) {
    const imageMappingId = `gen_${genIndex}_img_${index}_${Date.now()}`;
    
    if (typeof item === 'string') {
      // Simple path string
      return {
        imageMappingId,
        generationPrompt: genParameters.prompt || 'Generated image',
        seed: null,
        qcStatus: 'approved',
        qcReason: null,
        tempImagePath: item,
        finalImagePath: item,
        metadata: {
          prompt: genParameters.prompt,
          generationIndex: genIndex,
          imageIndex: index
        }
      };
    } else if (item && typeof item === 'object') {
      // Structured object
      return {
        imageMappingId: item.imageMappingId || imageMappingId,
        generationPrompt: item.generationPrompt || genParameters.prompt || 'Generated image',
        seed: item.seed || null,
        qcStatus: item.qcStatus || 'approved',
        qcReason: item.qcReason || null,
        tempImagePath: item.tempImagePath || item.path || null,
        finalImagePath: item.finalImagePath || item.path || null,
        metadata: item.metadata || {
          prompt: genParameters.prompt,
          generationIndex: genIndex,
          imageIndex: index
        }
      };
    }

    // Fallback
    return {
      imageMappingId,
      generationPrompt: genParameters.prompt || 'Generated image',
      seed: null,
      qcStatus: 'qc_failed',
      qcReason: 'invalid_result_format',
      tempImagePath: null,
      finalImagePath: null,
      metadata: {}
    };
  }

  /**
   * Build final result object
   * @private
   */
  _buildResult({ status, images, successfulImages, failedImages, message, error }) {
    return {
      status,
      images,
      successfulImages,
      failedImages,
      totalImages: images.length,
      message: message || null,
      error: error || null,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { JobEngine };
