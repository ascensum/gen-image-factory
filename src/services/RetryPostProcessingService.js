/**
 * RetryPostProcessingService - Run post-processing pipeline for retry (Story 3.5, same pattern as 3.1).
 * Logic copied from retryExecutor.runPostProcessing; used via Shadow Bridge when FEATURE_MODULAR_RETRY_POST_PROCESSING === 'true'.
 * No "Legacy" in name; legacy remains in retryExecutor.js.
 */

const path = require('path');
const fs = require('fs').promises;
const { processImage } = require(path.join(__dirname, '../producePictureModule'));
const aiVision = require(path.join(__dirname, '../aiVision'));

/**
 * Run post-processing on an image (processImage, metadata, move, DB update).
 * @param {Object} executor - RetryExecutor instance (outputDirectory, tempDirectory, currentImageId, generatedImage)
 * @param {string} sourcePath
 * @param {Object} settings
 * @param {boolean} includeMetadata
 * @param {Object} jobConfiguration
 * @param {boolean} useOriginalSettings
 * @param {Object} failOptions
 * @returns {Promise<Object>}
 */
async function run(executor, sourcePath, settings, includeMetadata, jobConfiguration, useOriginalSettings, failOptions) {
  try {
    try {
      await fs.access(sourcePath);
    } catch (error) {
      throw new Error(`Source file not accessible: ${sourcePath}`);
    }

    const sourceFileName = path.basename(sourcePath, path.extname(sourcePath));
    let tempProcessingDir;
    try {
      const { app } = require('electron');
      tempProcessingDir = path.join(app.getPath('desktop'), 'gen-image-factory', 'pictures', 'temp_processing');
    } catch (error) {
      const os = require('os');
      tempProcessingDir = path.join(os.homedir(), 'Documents', 'gen-image-factory', 'pictures', 'temp_processing');
    }
    try {
      await fs.mkdir(tempProcessingDir, { recursive: true });
    } catch (error) {
      console.warn(` RetryExecutor: Temp directory creation failed:`, error.message);
    }

    const { apiKeys, ...sanitizedSettings } = settings;
    const processOutputDir = tempProcessingDir;
    const processingConfig = {
      tempDirectory: tempProcessingDir,
      outputDirectory: processOutputDir,
      ...sanitizedSettings,
      preserveInput: true,
      failRetryEnabled: !!(failOptions && failOptions.enabled),
      failOnSteps: Array.isArray(failOptions?.steps) ? failOptions.steps : []
    };
    try {
      const { normalizeProcessingSettings } = require('../utils/processing');
      Object.assign(processingConfig, normalizeProcessingSettings(processingConfig));
    } catch (e) {}

    let processedImagePath;
    try {
      processedImagePath = await processImage(sourcePath, sourceFileName, processingConfig);
    } catch (procErr) {
      const stage = String((procErr && procErr.stage) || '').toLowerCase();
      const enabled = !!(failOptions && failOptions.enabled);
      const steps = Array.isArray(failOptions?.steps) ? failOptions.steps.map(s => String(s).toLowerCase()) : [];
      if (stage === 'convert') {
        if (enabled && steps.includes('convert')) throw procErr;
        processedImagePath = sourcePath;
      } else if (stage === 'trim') {
        if (enabled && steps.includes('trim')) throw procErr;
        processedImagePath = sourcePath;
      } else if (stage === 'enhancement') {
        if (enabled && steps.includes('enhancement')) throw procErr;
        processedImagePath = sourcePath;
      } else {
        throw procErr;
      }
    }

    let outputDirectory;
    if (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths) {
      outputDirectory = jobConfiguration.settings.filePaths.outputDirectory;
    } else {
      outputDirectory = executor.outputDirectory;
    }

    let finalOutputPath;
    let finalExtension;
    if (settings.imageConvert && (settings.convertToWebp === true)) {
      finalExtension = '.webp';
      finalOutputPath = path.join(outputDirectory, `${sourceFileName}.webp`);
    } else if (settings.convertToJpg && settings.imageConvert) {
      finalExtension = '.jpg';
      finalOutputPath = path.join(outputDirectory, `${sourceFileName}.jpg`);
    } else {
      finalExtension = path.extname(processedImagePath);
      finalOutputPath = path.join(outputDirectory, `${sourceFileName}${finalExtension}`);
    }
    try {
      await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
    } catch (error) {
      console.warn(` RetryExecutor: Final output directory creation failed:`, error.message);
    }

    let metadataResult = null;
    if (includeMetadata) {
      try {
        const imageData = await executor.generatedImage.getGeneratedImage(executor.currentImageId);
        let originalPrompt = 'Generated image';
        if (imageData.success && imageData.image.generationPrompt) {
          originalPrompt = imageData.image.generationPrompt;
        }
        let metadataPrompt = null;
        try {
          const filePaths = (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths) ? jobConfiguration.settings.filePaths : (settings && settings.filePaths ? settings.filePaths : {});
          if (filePaths && filePaths.metadataPromptFile) {
            try {
              const fsProm = require('fs').promises;
              metadataPrompt = await fsProm.readFile(filePaths.metadataPromptFile, 'utf8');
            } catch (e) {
              console.warn('RetryExecutor: Failed to read metadataPromptFile, using default prompt');
            }
          }
        } catch (e) {}
        metadataResult = await aiVision.generateMetadata(
          processedImagePath,
          originalPrompt,
          (metadataPrompt && metadataPrompt.trim() !== '') ? metadataPrompt : null,
          'gpt-4o-mini'
        );
      } catch (metadataError) {
        const enabled = !!(failOptions && failOptions.enabled);
        const steps = Array.isArray(failOptions?.steps) ? failOptions.steps.map(s => String(s).toLowerCase()) : [];
        if (enabled && steps.includes('metadata')) {
          const err = new Error(`Metadata generation failed: ${metadataError?.message || metadataError}`);
          err.stage = 'metadata';
          err.name = 'MetadataError';
          throw err;
        }
        console.warn(` RetryExecutor: Metadata generation failed, continuing without metadata:`, metadataError);
      }
    }

    try {
      await fs.copyFile(processedImagePath, finalOutputPath);
      try {
        await fs.unlink(processedImagePath);
      } catch (cleanupTempErr) {
        console.warn(` RetryExecutor: Failed to cleanup temp processed file:`, cleanupTempErr.message);
      }
    } catch (moveError) {
      const enabled = !!(failOptions && failOptions.enabled);
      const steps = Array.isArray(failOptions?.steps) ? failOptions.steps.map(s => String(s).toLowerCase()) : [];
      if (enabled && steps.includes('convert')) {
        const err = new Error(`processing_failed:save_final: ${moveError?.message || moveError}`);
        err.stage = 'save_final';
        throw err;
      }
      console.warn(` RetryExecutor: Move to final output failed. Falling back to source: ${sourcePath}`);
      finalOutputPath = sourcePath;
    }

    try {
      const resolvedSource = path.resolve(sourcePath);
      const resolvedFinal = path.resolve(finalOutputPath);
      const tempDirForGuard =
        (jobConfiguration && jobConfiguration.settings && jobConfiguration.settings.filePaths && jobConfiguration.settings.filePaths.tempDirectory)
          ? jobConfiguration.settings.filePaths.tempDirectory
          : executor.tempDirectory;
      const resolvedTempRoot = path.resolve(tempDirForGuard || '');
      const isInsideTemp =
        resolvedTempRoot &&
        (resolvedSource === resolvedTempRoot || resolvedSource.startsWith(resolvedTempRoot + path.sep));
      if (resolvedSource !== resolvedFinal && isInsideTemp) {
        await fs.unlink(resolvedSource);
      }
    } catch (cleanupError) {
      console.warn(` RetryExecutor: Failed to delete original source file:`, cleanupError.message);
    }

    if (executor.currentImageId) {
      try {
        const existingImageData = await executor.generatedImage.getGeneratedImage(executor.currentImageId);
        if (!existingImageData.success || !existingImageData.image) {
          throw new Error(`Failed to get existing image data for update`);
        }
        const existingImage = existingImageData.image;
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
        const updateData = {
          executionId: existingImage.executionId,
          generationPrompt: existingImage.generationPrompt,
          seed: existingImage.seed,
          qcStatus: 'approved',
          qcReason: 'Retry processing successful',
          finalImagePath: finalOutputPath,
          metadata: (() => {
            if (!metadataResult) return existingImage.metadata;
            const tags = metadataResult.uploadTags || metadataResult.tags || metadataResult.upload_tags || null;
            return {
              ...(existingImage.metadata || {}),
              title: metadataResult.new_title || (existingImage.metadata ? existingImage.metadata.title : undefined),
              description: metadataResult.new_description || (existingImage.metadata ? existingImage.metadata.description : undefined),
              tags: tags || (existingImage.metadata ? existingImage.metadata.tags : undefined)
            };
          })(),
          processingSettings: useOriginalSettings ? (existingImage.processingSettings || null) : processingSnapshot
        };
        await executor.generatedImage.updateGeneratedImage(executor.currentImageId, updateData);
        if (metadataResult) {
          try {
            const tags = metadataResult.uploadTags || metadataResult.tags || metadataResult.upload_tags || null;
            await executor.generatedImage.updateMetadataById(executor.currentImageId, {
              title: metadataResult.new_title,
              description: metadataResult.new_description,
              tags
            });
          } catch (e) {
            console.warn(' RetryExecutor: Metadata persistence (byId) failed:', e.message);
          }
        }
      } catch (dbError) {
        console.error(` RetryExecutor: Failed to update database with new path:`, dbError);
        throw new Error(`Database update failed: ${dbError.message}`);
      }
    }

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
      if (qcReason === 'processing_failed:qc') {
        if (name === 'metadataerror' || /metadata generation failed/i.test(message)) {
          qcReason = 'processing_failed:metadata';
        }
      }
      return { success: false, error: error.message, qcReason };
    } catch {
      return {
        success: false,
        error: String(error && error.message || error) || 'processing_failed:qc',
        qcReason: 'processing_failed:qc'
      };
    }
  }
}

module.exports = { run };
