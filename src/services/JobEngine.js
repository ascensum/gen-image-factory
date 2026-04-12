/**
 * JobEngine - Pure Orchestration Layer (ADR-001, ADR-003)
 * Pipeline: Init → ParamGen → ImageGen → QC → Metadata
 */
const { EventEmitter } = require('events');
const path = require('path');
const { paramsGeneratorModule: defaultParamsGenerator } = require(path.join(__dirname, '../paramsGeneratorModule'));

class JobEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.producePictureModule = options.producePictureModule || null;
    this.paramsGeneratorModule = options.paramsGeneratorModule || defaultParamsGenerator;
    this.isStopping = false;
    this.abortController = null;
  }

  async executeJob(config, abortSignal = null) {
    const fs = require('fs').promises;
    const csvParser = require('csv-parser');

    this.abortController = abortSignal ? { signal: abortSignal } : new AbortController();
    this.isStopping = false;

    try {
      this.emit('progress', { step: 'initialization', progress: 0 });
      const validatedConfig = this._validateConfig(config);

      const generations = Math.max(1, Number(validatedConfig.parameters?.count || 1));
      const variations = Math.max(1, Number(validatedConfig.parameters?.variations || 1));

      // Load keywords file + system prompt from disk (was in old jobRunner)
      const fp = validatedConfig.filePaths || {};
      let allKeywords = [];
      const keywordsFilePath = fp.keywordsFile || '';
      if (keywordsFilePath) {
        const ext = path.extname(keywordsFilePath).toLowerCase();
        if (ext === '.csv') {
          allKeywords = await new Promise((resolve, reject) => {
            const rows = [];
            require('fs').createReadStream(keywordsFilePath)
              .pipe(csvParser())
              .on('data', (r) => rows.push(r))
              .on('end', () => resolve(rows))
              .on('error', reject);
          });
        } else {
          const txt = await fs.readFile(keywordsFilePath, 'utf8');
          allKeywords = txt.split('\n').filter(l => l.trim() !== '');
        }
      }
      const systemPromptContent = fp.systemPromptFile
        ? await fs.readFile(fp.systemPromptFile, 'utf8')
        : null;

      this._loadedKeywords = allKeywords;
      this._systemPromptContent = systemPromptContent;
      this._keywordsFilePath = keywordsFilePath;

      this.emit('progress', { step: 'initialization', progress: 20, metadata: { generations, variations } });
      this._emitLog('info', 'initialization', 'config_ready', `Job initialized: ${generations} generation(s), ${variations} variation(s)`, { generations, variations });

      const allImages = [];
      let successfulImages = 0;
      let failedImages = 0;
      const startTime = Date.now();

      for (let genIndex = 0; genIndex < generations; genIndex++) {
        if (this._shouldAbort()) {
          this._emitLog('warn', 'image_generation', 'aborted', 'Job aborted by user');
          this.emit('progress', { step: 'aborted', progress: 100 });
          return this._buildResult({ status: 'aborted', images: allImages, successfulImages, failedImages, message: 'Job aborted by user' });
        }

        let genParameters;
        try {
          genParameters = await this._generateParameters(validatedConfig, genIndex);
          this.emit('progress', { step: 'parameter_generation', progress: 20 + (genIndex / generations) * 10, metadata: { generationIndex: genIndex, hasPrompt: !!genParameters?.prompt } });
          const promptPreview = (genParameters.prompt || '').substring(0, 120);
          this._emitLog('info', 'initialization', 'parameter_generation_per_gen', `Parameters generated for generation ${genIndex + 1}/${generations}`, { generationIndex: genIndex, promptPreview });
          if (genParameters.prompt) {
            this._emitLog('debug', 'initialization', 'prompt_detail', `Prompt: ${genParameters.prompt}`, { generationIndex: genIndex });
          }
        } catch (paramErr) {
          console.error(`JobEngine: parameter generation failed (gen ${genIndex}):`, paramErr);
          this._emitLog('error', 'initialization', 'parameter_generation_per_gen_error', `Parameter generation failed for generation ${genIndex + 1}: ${paramErr.message}`, { generationIndex: genIndex });
          this.emit('error', { step: 'parameter_generation', error: paramErr.message, generationIndex: genIndex });
          failedImages += variations;
          continue;
        }

        try {
          this._emitLog('info', 'image_generation', 'call_module', `Calling image pipeline (generation ${genIndex + 1}/${generations})`, { generationIndex: genIndex });
          const result = await this._generateImages(validatedConfig, genParameters, genIndex);
          const processedImages = this._processGenerationResult(result, genParameters, genIndex);
          allImages.push(...processedImages);
          successfulImages += processedImages.filter(img => img.qcStatus === 'approved').length;
          failedImages += processedImages.filter(img => img.qcStatus !== 'approved').length;

          this.emit('progress', { step: 'image_generation', progress: 30 + ((genIndex + 1) / generations) * 60, metadata: { generationIndex: genIndex, generatedCount: processedImages.length, totalImages: allImages.length } });
          this._emitLog('info', 'image_generation', 'module_result', `Generation ${genIndex + 1} completed: ${processedImages.length} image(s) (${allImages.length} total)`, { generationIndex: genIndex, generatedCount: processedImages.length, totalImages: allImages.length });
        } catch (genErr) {
          console.error(`JobEngine: image generation failed (gen ${genIndex}):`, genErr);
          this._emitLog('error', 'image_generation', 'generation_error', `Generation ${genIndex + 1} failed: ${genErr.message}`, { generationIndex: genIndex });
          this.emit('error', { step: 'image_generation', error: genErr.message, generationIndex: genIndex });
          failedImages += variations;
          continue;
        }
      }

      this.emit('progress', { step: 'finalization', progress: 95 });
      const durationMs = Date.now() - startTime;
      this._emitLog('info', 'image_generation', 'complete', `Image generation completed: ${successfulImages}/${successfulImages + failedImages} images across ${generations} generation(s)`, { totalImages: successfulImages, failedImages, durationMs });
      
      const finalResult = this._buildResult({
        status: 'completed',
        images: allImages,
        successfulImages,
        failedImages,
        message: `Job completed: ${successfulImages} successful, ${failedImages} failed`
      });

      this.emit('progress', { step: 'completed', progress: 100 });
      this.emit('job-complete', finalResult);

      return finalResult;

    } catch (error) {
      console.error('JobEngine: execution failed:', error);
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

  async abort() {
    this.isStopping = true;
    if (this.abortController && this.abortController.abort) {
      this.abortController.abort();
    }
    this.emit('progress', { step: 'aborting', progress: 100 });
  }

  _emitLog(level, stepName, subStep, message, metadata = {}) {
    this.emit('log', { level, stepName, subStep, message, source: 'job-engine', metadata });
  }

  _shouldAbort() {
    return this.isStopping || 
           (this.abortController?.signal?.aborted === true);
  }

  _validateConfig(config) {
    if (!config) throw new Error('Job configuration is required');
    if (!config.parameters) throw new Error('Job parameters are required');
    return config;
  }

  async _generateParameters(config, genIndex) {
    const allKeywords = this._loadedKeywords || [];
    const keywordRandom = config.parameters?.keywordRandom ?? false;
    const isCsv = allKeywords.length > 0 && typeof allKeywords[0] === 'object';

    let currentKeywords;
    if (isCsv) {
      currentKeywords = keywordRandom
        ? allKeywords[Math.floor(Math.random() * allKeywords.length)]
        : allKeywords[genIndex % allKeywords.length];
    } else if (allKeywords.length > 0) {
      const kw = keywordRandom
        ? allKeywords[Math.floor(Math.random() * allKeywords.length)]
        : allKeywords[genIndex % allKeywords.length];
      currentKeywords = [kw];
    } else {
      currentKeywords = ['default'];
    }

    const paramConfig = {
      keywordRandom,
      openaiModel: config.parameters?.openaiModel || config.apiKeys?.openaiModel || 'gpt-4o-mini',
      mjVersion: config.parameters?.mjVersion,
      appendMjVersion: config.parameters?.appendMjVersion ?? false,
      signal: this.abortController?.signal,
      openaiApiKey: config.apiKeys?.openai
    };

    if (paramConfig.openaiApiKey) {
      process.env.OPENAI_API_KEY = paramConfig.openaiApiKey;
    }

    const parameters = await this.paramsGeneratorModule(
      currentKeywords,
      this._systemPromptContent,
      this._keywordsFilePath || '',
      paramConfig
    );

    if (!parameters || !parameters.prompt) {
      throw new Error('Parameter generation failed: no prompt generated');
    }

    return parameters;
  }

  async _generateImages(config, genParameters, genIndex) {
    const imgNameBase = `job_${Date.now()}_${genIndex}`;
    const settings = {
      prompt: genParameters.prompt,
      promptContext: genParameters.promptContext,
      apiKeys: config.apiKeys,
      parameters: { ...(config.parameters || {}) },
      filePaths: config.filePaths || {}
    };
    const moduleConfig = this._buildModuleConfig(config, genParameters, genIndex);

    if (!this.producePictureModule) {
      throw new Error('JobEngine requires ImagePipelineService (injected as producePictureModule via constructor)');
    }

    const result = await this.producePictureModule.producePictureModule(
      settings,
      imgNameBase,
      (config.ai && config.ai.metadataPrompt) ? config.ai.metadataPrompt : null,
      moduleConfig
    );

    return result;
  }

  _buildModuleConfig(config, genParameters, genIndex) {
    const requestedVariations = Math.max(1, Number(config.parameters?.variations || 1));
    const generations = Math.max(1, Number(config.parameters?.count || 1));
    const maxAllowed = Math.max(1, Math.min(20, Math.floor(10000 / Math.max(1, generations))));
    const effectiveVariations = Math.min(requestedVariations, maxAllowed);

    const proc = config.processing || {};
    const hasQc = config.ai?.runQualityCheck === true;
    // remove.bg is expensive: when QC is on, skip local processing until QC approves (see PostGenerationService.runPostQCProcessing).
    const skipLocalImageProcessing = hasQc && !!(proc.removeBg);

    const shared = {
      generationIndex: genIndex,
      variations: effectiveVariations,
      runwareDimensionsCsv: (config.parameters && config.parameters.runwareDimensionsCsv) || '',
      removeBgFailureMode: proc.removeBgFailureMode || 'approve',
      failRetryEnabled: proc.failRetryEnabled || false,
      failOnSteps: Array.isArray(proc.failOnSteps) ? proc.failOnSteps : [],
      pollingTimeout: config.parameters?.enablePollingTimeout ? (config.parameters?.pollingTimeout || 15) : null,
      processMode: config.parameters?.processMode || 'single',
      runQualityCheck: config.ai?.runQualityCheck || false,
      runMetadataGen: false,
      apiKeys: config.apiKeys || {},
      filePaths: config.filePaths || {},
      outputDirectory: config.filePaths?.tempDirectory || './pictures/generated',
      tempDirectory: config.filePaths?.tempDirectory || './pictures/generated',
      skipLocalImageProcessing
    };

    if (skipLocalImageProcessing) {
      return {
        ...shared,
        removeBg: false,
        imageConvert: false,
        convertToJpg: false,
        convertToWebp: false,
        trimTransparentBackground: false,
        imageEnhancement: false,
        sharpening: 0,
        saturation: 1,
        jpgBackground: proc.jpgBackground || 'white',
        jpgQuality: proc.jpgQuality || 85,
        pngQuality: proc.pngQuality || 100,
        webpQuality: proc.webpQuality || 85,
        removeBgSize: proc.removeBgSize || 'preview'
      };
    }

    return {
      ...shared,
      removeBg: proc.removeBg || false,
      imageConvert: proc.imageConvert || false,
      convertToJpg: proc.convertToJpg || false,
      convertToWebp: proc.convertToWebp || false,
      trimTransparentBackground: proc.trimTransparentBackground || false,
      imageEnhancement: proc.imageEnhancement || false,
      sharpening: proc.sharpening || 0,
      saturation: proc.saturation || 1,
      jpgBackground: proc.jpgBackground || 'white',
      jpgQuality: proc.jpgQuality || 85,
      pngQuality: proc.pngQuality || 100,
      webpQuality: proc.webpQuality || 85,
      removeBgSize: proc.removeBgSize || 'preview'
    };
  }

  _processGenerationResult(result, genParameters, genIndex) {
    const images = [];
    if (Array.isArray(result)) {
      result.forEach((item, index) => {
        images.push(this._buildImageObject(item, genParameters, index, genIndex, result.length));
      });
    } else if (typeof result === 'string') {
      images.push(this._buildImageObject(result, genParameters, 0, genIndex, 1));
    } else if (result && typeof result === 'object' && Array.isArray(result.processedImages)) {
      result.processedImages.forEach((item, index) => {
        images.push(this._buildImageObject(item, genParameters, index, genIndex, result.processedImages.length));
      });
      
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

  _buildImageObject(item, genParameters, index, genIndex) {
    const fallbackId = `gen_${genIndex}_img_${index}_${Date.now()}`;
    if (typeof item === 'string') {
      return {
        imageMappingId: fallbackId,
        generationPrompt: genParameters.prompt || 'Generated image',
        seed: null, qcStatus: 'approved', qcReason: null,
        tempImagePath: item, finalImagePath: item,
        metadata: { prompt: genParameters.prompt, generationIndex: genIndex, imageIndex: index }
      };
    } else if (item && typeof item === 'object') {
      const imgPath = item.finalImagePath || item.outputPath || item.tempImagePath || item.path || null;
      return {
        imageMappingId: item.imageMappingId || item.mappingId || fallbackId,
        generationPrompt: item.generationPrompt || genParameters.prompt || 'Generated image',
        seed: item.seed || null,
        qcStatus: item.qcStatus || 'approved',
        qcReason: item.qcReason || null,
        tempImagePath: item.tempImagePath || imgPath,
        finalImagePath: imgPath,
        metadata: item.metadata || { prompt: genParameters.prompt, generationIndex: genIndex, imageIndex: index }
      };
    }

    return {
      imageMappingId: fallbackId,
      generationPrompt: genParameters.prompt || 'Generated image',
      seed: null,
      qcStatus: 'qc_failed',
      qcReason: 'invalid_result_format',
      tempImagePath: null,
      finalImagePath: null,
      metadata: {}
    };
  }

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
