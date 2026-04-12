/**
 * ImagePipelineService - Modular image generation + post-processing pipeline.
 *
 * Replaces producePictureModule.js (Story 5.3, ADR-008).
 * Delegates to:
 *   - ImageGeneratorService   (Runware API generation + download)
 *   - ImageRemoverService     (remove.bg background removal)
 *   - ImageProcessorService   (Sharp-based trim / enhance / convert / save)
 *
 * ADR-001: < 400 lines.  ADR-003: constructor injection only.
 */

const fs = require('fs').promises;
const path = require('path');
const { logDebug } = require(path.join(__dirname, '../utils/logDebug'));

class ImagePipelineService {
  /**
   * @param {Object} deps
   * @param {Object} deps.imageGeneratorService  - ImageGeneratorService instance
   * @param {Object} deps.imageRemoverService    - ImageRemoverService instance (or null)
   * @param {Object} deps.imageProcessorService  - ImageProcessorService instance
   */
  constructor(deps = {}) {
    if (!deps.imageGeneratorService) throw new Error('ImagePipelineService requires imageGeneratorService');
    if (!deps.imageProcessorService) throw new Error('ImagePipelineService requires imageProcessorService');

    this.generator = deps.imageGeneratorService;
    this.remover = deps.imageRemoverService || null;
    this.processor = deps.imageProcessorService;
  }

  /**
   * Full pipeline: generate images via Runware → post-process each one.
   * Drop-in replacement for producePictureModule.producePictureModule().
   *
   * @param {Object} settings   - Job settings (prompt, parameters, etc.)
   * @param {string} imgNameBase
   * @param {string|null} _customMetadataPrompt  - unused, kept for signature compat
   * @param {Object} config     - Runtime config (apiKeys, file paths, processing flags)
   * @returns {Promise<{processedImages: Array, failedItems: Array}>}
   */
  async producePictures(settings, imgNameBase, _customMetadataPrompt = null, config = {}) {
    const { successfulDownloads, failedItems } = await this.generator.generateImages(
      settings,
      imgNameBase,
      config
    );

    const processedImages = [];
    for (const item of successfulDownloads) {
      try {
        if (config.skipLocalImageProcessing) {
          processedImages.push({
            outputPath: item.inputImagePath,
            settings: { ...settings },
            mappingId: item.mappingId
          });
          continue;
        }

        config._softFailures = [];

        const outputPath = await this.processImage(item.inputImagePath, imgNameBase + item.imageSuffix, config);

        processedImages.push({
          outputPath,
          settings: { ...settings },
          mappingId: item.mappingId,
          ...(Array.isArray(config._softFailures) && config._softFailures.length > 0
            ? { softFailures: [...config._softFailures] }
            : {})
        });
      } catch (error) {
        failedItems.push({
          mappingId: item.mappingId,
          stage: (error && error.stage) ? String(error.stage) : 'processing',
          vendor: 'local',
          message: String((error && error.message) || error)
        });
        try { await fs.unlink(item.inputImagePath); } catch (_) { /* ignore */ }
      }
    }

    if (processedImages.length === 0 && failedItems.length === 0) {
      throw new Error('No images were successfully generated.');
    }

    return { processedImages, failedItems };
  }

  /**
   * Post-process a single image: remove background → processor (trim, enhance, convert, save).
   * Drop-in replacement for producePictureModule.processImage().
   *
   * @param {string} inputImagePath
   * @param {string} imgName
   * @param {Object} config
   * @returns {Promise<string>} Final output path
   */
  async processImage(inputImagePath, imgName, config = {}) {
    const fsInstance = config.fs || fs;

    logDebug(`ImagePipelineService.processImage: ${inputImagePath}`);

    let imageBuffer;
    try {
      imageBuffer = await fsInstance.readFile(inputImagePath);
    } catch (error) {
      console.error(`Error reading image file ${inputImagePath}:`, error);
      throw error;
    }

    // 1. Background removal (optional)
    if (config.removeBg) {
      imageBuffer = await this._removeBackground(imageBuffer, inputImagePath, config, fsInstance);
    }

    // 2. Process (trim, enhance, convert, save) via ImageProcessorService
    const outputPath = await this.processor.process(imageBuffer, imgName, {
      ...config,
      inputImagePath
    });

    logDebug(`ImagePipelineService.processImage: Completed → ${outputPath}`);
    return outputPath;
  }

  /**
   * Background removal step with soft/hard failure handling.
   * Preserves normalizeRemoveBgFailureMode semantics from producePictureModule.
   */
  async _removeBackground(imageBuffer, inputImagePath, config, fsInstance) {
    if (!this.remover) {
      logDebug('ImagePipelineService: No remover injected, skipping bg removal');
      return imageBuffer;
    }

    const timeoutMinutesRaw = Number.isFinite(Number(config?.pollingTimeout))
      ? Number(config.pollingTimeout) : undefined;
    const enableTimeoutFlag = Number.isFinite(timeoutMinutesRaw);
    const removeBgTimeoutMs = enableTimeoutFlag
      ? Math.max(1000, Number(timeoutMinutesRaw) * 60 * 1000)
      : 30000;

    try {
      const result = await this.remover.retryRemoveBackground(inputImagePath, {
        removeBgSize: config.removeBgSize,
        signal: config.abortSignal,
        timeoutMs: removeBgTimeoutMs
      });
      logDebug('Background removal successful');
      config._removeBgApplied = true;
      return result;
    } catch (error) {
      return this._handleRemoveBgFailure(error, imageBuffer, inputImagePath, config, fsInstance);
    }
  }

  /**
   * Handle remove.bg failure: determine soft vs hard fail.
   * normalizeRemoveBgFailureMode:
   *   UI sends 'approve' | 'mark_failed'.
   *   - 'approve'      → soft (use original image as fallback)
   *   - 'mark_failed'  → hard (throw processing_failed:remove_bg)
   */
  _handleRemoveBgFailure(error, imageBuffer, inputImagePath, config, fsInstance) {
    const rawMode = String(config?.removeBgFailureMode || 'approve').toLowerCase();
    const failureMode = (rawMode === 'mark_failed') ? 'fail' : (rawMode === 'approve' ? 'soft' : rawMode);
    const enabled = !!config.failRetryEnabled;
    const steps = Array.isArray(config.failOnSteps)
      ? config.failOnSteps.map(s => String(s).toLowerCase())
      : [];

    let unauthorized = false;
    try {
      const status = error?.response?.status;
      const body = error?.response?.data;
      const msg = String(error && error.message || '');
      unauthorized = (!process.env.REMOVE_BG_API_KEY) || status === 401 || status === 403 ||
        /unauthorized|forbidden|x-api-key|invalid api key/i.test(msg) ||
        (typeof body === 'string' && /unauthorized|forbidden|x-api-key|invalid api key/i.test(body));
    } catch {}

    const hardFail = (enabled && steps.includes('remove_bg')) || failureMode === 'fail';

    logDebug('ImagePipelineService: remove.bg failure decision', {
      rawMode, failureMode, failRetryEnabled: enabled, hardFail, unauthorized
    });

    if (hardFail) {
      config._removeBgApplied = false;
      try {
        if (Array.isArray(config._softFailures)) {
          config._softFailures.push({ stage: 'remove_bg', vendor: 'remove.bg', message: 'Hard-fail triggered' });
        }
      } catch {}
      const err = new Error('processing_failed:remove_bg');
      err.stage = 'remove_bg';
      throw err;
    }

    // Soft fail: use original image as fallback
    logDebug('ImagePipelineService: remove.bg soft-fail, using original image');
    try {
      if (Array.isArray(config._softFailures)) {
        config._softFailures.push({
          stage: 'remove_bg',
          vendor: 'remove.bg',
          message: String(error && error.message || error)
        });
      }
    } catch {}

    return fsInstance.readFile(inputImagePath);
  }
}

module.exports = ImagePipelineService;
