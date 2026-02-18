/**
 * RetryProcessorService - Single-image retry processing (ADR-012).
 * Logic copied EXACTLY from retryExecutor.js processSingleImage (~350-525).
 * Used via Shadow Bridge when FEATURE_MODULAR_RETRY_PROCESSOR === 'true'.
 *
 * Dependencies (DI): getImage, updateImageStatus, getOriginalJobConfiguration,
 * getFallbackConfiguration, getOriginalProcessingSettings, runPostProcessing, emit
 */

const path = require('path');
const fs = require('fs').promises;

class RetryProcessorService {
  /**
   * @param {Object} deps - Dependencies
   * @param {Function} deps.getImage - async (imageId) => { success, image }
   * @param {Function} deps.updateImageStatus - async (imageId, status, reason) => void
   * @param {Function} deps.getOriginalJobConfiguration - async (image) => jobConfiguration
   * @param {Function} deps.getFallbackConfiguration - () => jobConfiguration
   * @param {Function} deps.getOriginalProcessingSettings - async (image) => settings
   * @param {Function} deps.runPostProcessing - async (sourcePath, settings, includeMetadata, jobConfig, useOriginalSettings, failOptions) => result
   * @param {Function} deps.emit - (event, payload) => void
   * @param {Function} [deps.setCurrentImageId] - (imageId) => void (optional)
   */
  constructor(deps = {}) {
    this.getImage = deps.getImage || (async () => ({ success: false }));
    this.updateImageStatus = deps.updateImageStatus || (async () => {});
    this.getOriginalJobConfiguration = deps.getOriginalJobConfiguration || (async () => ({}));
    this.getFallbackConfiguration = deps.getFallbackConfiguration || (() => ({}));
    this.getOriginalProcessingSettings = deps.getOriginalProcessingSettings || (async () => ({}));
    this.runPostProcessing = deps.runPostProcessing || (async () => ({ success: false }));
    this.emit = typeof deps.emit === 'function' ? deps.emit : () => {};
    this.setCurrentImageId = typeof deps.setCurrentImageId === 'function' ? deps.setCurrentImageId : () => {};
  }

  /**
   * Process a single retry job (exact copy of retryExecutor processSingleImage behavior).
   * @param {Object} job - { imageId, useOriginalSettings, modifiedSettings, includeMetadata, failOptions }
   * @returns {Promise<Object>} { success, error?, qcReason?, message?, ... }
   */
  async processImage(job) {
    let imageId;
    try {
      const { imageId: _imageId, useOriginalSettings, modifiedSettings, includeMetadata, failOptions } = job;
      imageId = _imageId;
      this.setCurrentImageId(imageId);

      const imageData = await this.getImage(imageId);
      if (!imageData.success) {
        throw new Error(`Failed to get image data for ID ${imageId}`);
      }

      const image = imageData.image;

      let sourcePath;
      if (image.tempImagePath) {
        sourcePath = image.tempImagePath;
      } else if (image.finalImagePath) {
        sourcePath = image.finalImagePath;
      } else {
        throw new Error(`No image path found for image ${imageId}`);
      }

      sourcePath = path.resolve(sourcePath);

      try {
        await fs.access(sourcePath);
      } catch (error) {
        throw new Error(`Source file not accessible: ${sourcePath}`);
      }

      let processingSettings;
      let jobConfiguration = null;

      try {
        jobConfiguration = await this.getOriginalJobConfiguration(image);
      } catch (error) {
        jobConfiguration = this.getFallbackConfiguration();
      }

      if (useOriginalSettings) {
        processingSettings = await this.getOriginalProcessingSettings(image);
      } else {
        processingSettings = modifiedSettings;
      }

      try {
        const rbKey = jobConfiguration?.settings?.apiKeys?.removeBg;
        if (rbKey && String(rbKey).trim() !== '') {
          process.env.REMOVE_BG_API_KEY = String(rbKey);
        }
      } catch (e) {
        // non-fatal
      }

      await this.updateImageStatus(imageId, 'processing');

      const processingResult = await this.runPostProcessing(
        sourcePath,
        processingSettings,
        includeMetadata,
        jobConfiguration,
        useOriginalSettings,
        failOptions || { enabled: false, steps: [] }
      );

      if (processingResult.success) {
        await this.updateImageStatus(imageId, 'approved', 'Retry processing successful');
        return processingResult;
      }

      const failReason = (processingResult && processingResult.qcReason)
        ? String(processingResult.qcReason)
        : String(processingResult.error || 'processing_failed:qc');
      await this.updateImageStatus(imageId, 'retry_failed', failReason);
      return processingResult;
    } catch (error) {
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
      this.setCurrentImageId(null);
    }
  }

  /**
   * Convenience: retry one image with options (builds job and calls processImage).
   * @param {string} imageId - Image ID
   * @param {Object} retryOptions - { useOriginalSettings, modifiedSettings, includeMetadata, failOptions }
   * @returns {Promise<Object>} Same as processImage result
   */
  async retryImage(imageId, retryOptions = {}) {
    const job = {
      imageId,
      useOriginalSettings: retryOptions.useOriginalSettings !== false,
      modifiedSettings: retryOptions.modifiedSettings || {},
      includeMetadata: !!retryOptions.includeMetadata,
      failOptions: retryOptions.failOptions || { enabled: false, steps: [] }
    };
    return this.processImage(job);
  }
}

module.exports = { RetryProcessorService };
