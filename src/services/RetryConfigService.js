/**
 * RetryConfigService - Config and status helpers for retry flow (Story 3.5, same pattern as 3.1).
 * Logic copied from retryExecutor; used via Shadow Bridge when FEATURE_MODULAR_RETRY_CONFIG === 'true'.
 * No "Legacy" in name; legacy remains in retryExecutor.js.
 */

const path = require('path');

/**
 * Get original job configuration including file paths.
 * @param {Object} executor - RetryExecutor instance (jobConfig, delay)
 * @param {Object} image - Image from DB
 * @returns {Promise<Object>}
 */
async function getOriginalJobConfiguration(executor, image) {
  try {
    const { JobExecution } = require(path.join(__dirname, '../database/models/JobExecution'));
    const jobExecution = new JobExecution();
    try { await jobExecution.init(); } catch (e) { console.warn('RetryExecutor: jobExecution.init failed (continuing):', e?.message || e); }
    try { if (executor.jobConfig && executor.jobConfig.init) { await executor.jobConfig.init(); } } catch (e) { console.warn('RetryExecutor: jobConfig.init failed (continuing):', e?.message || e); }

    let executionResult = await jobExecution.getJobExecution(image.executionId);
    if (!executionResult.success) {
      try { await executor.delay(300); } catch {}
      executionResult = await jobExecution.getJobExecution(image.executionId);
    }
    if (!executionResult.success) {
      return getFallbackConfiguration(executor);
    }

    const execution = executionResult.execution;
    if (!execution.configurationId) {
      return getFallbackConfiguration(executor);
    }

    let configResult = await executor.jobConfig.getConfigurationById(execution.configurationId);
    if (!configResult.success) {
      try { await executor.delay(300); } catch {}
      configResult = await executor.jobConfig.getConfigurationById(execution.configurationId);
    }
    if (!configResult.success) {
      return getFallbackConfiguration(executor);
    }

    const originalConfig = configResult.configuration;
    const settings = originalConfig.settings || {};
    const filePaths = settings.filePaths || {};
    const hasCustomOutputDir = filePaths.outputDirectory && filePaths.outputDirectory.trim() !== '';
    const hasCustomTempDir = filePaths.tempDirectory && filePaths.tempDirectory.trim() !== '';
    const defaultSettings = executor.jobConfig.getDefaultSettings();
    const defaultFilePaths = defaultSettings.filePaths;
    const correctedFilePaths = {
      outputDirectory: hasCustomOutputDir ? filePaths.outputDirectory : defaultFilePaths.outputDirectory,
      tempDirectory: hasCustomTempDir ? filePaths.tempDirectory : defaultFilePaths.tempDirectory,
      systemPromptFile: filePaths.systemPromptFile || '',
      keywordsFile: filePaths.keywordsFile || '',
      qualityCheckPromptFile: filePaths.qualityCheckPromptFile || '',
      metadataPromptFile: filePaths.metadataPromptFile || ''
    };

    return {
      ...originalConfig,
      settings: { ...settings, filePaths: correctedFilePaths }
    };
  } catch (error) {
    console.error(` RetryExecutor: Error getting original job configuration for image ${image?.id || 'unknown'}:`, error);
    return getFallbackConfiguration(executor);
  }
}

/**
 * @param {Object} executor - RetryExecutor instance
 * @returns {Object}
 */
function getFallbackConfiguration(executor) {
  const defaultSettings = executor.jobConfig.getDefaultSettings();
  return {
    id: 'fallback',
    name: 'Fallback Configuration',
    settings: defaultSettings,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * @param {Object} executor - unused, signature consistency
 * @param {Object} image - Image from DB
 * @returns {Object}
 */
async function getOriginalProcessingSettings(executor, image) {
  try {
    if (!image) throw new Error('Image data not provided for processing settings');
    let originalSettings = {};
    if (image.processingSettings) {
      try {
        originalSettings = JSON.parse(image.processingSettings);
      } catch (parseError) {
        console.warn(` RetryExecutor: Failed to parse processing settings for image, using defaults:`, parseError);
      }
    }
    return {
      imageEnhancement: originalSettings.imageEnhancement || false,
      sharpening: originalSettings.sharpening || 0,
      saturation: originalSettings.saturation || 1.0,
      imageConvert: originalSettings.imageConvert || false,
      convertToJpg: originalSettings.convertToJpg || false,
      convertToWebp: originalSettings.convertToWebp || false,
      jpgQuality: originalSettings.jpgQuality || 100,
      pngQuality: originalSettings.pngQuality || 100,
      webpQuality: originalSettings.webpQuality || 85,
      removeBg: originalSettings.removeBg || false,
      removeBgSize: originalSettings.removeBgSize || 'auto',
      trimTransparentBackground: originalSettings.trimTransparentBackground || false,
      jpgBackground: originalSettings.jpgBackground || 'white'
    };
  } catch (error) {
    console.error(` RetryExecutor: Error getting original processing settings for image:`, error);
    return {
      imageEnhancement: false,
      sharpening: 0,
      saturation: 1.0,
      imageConvert: false,
      convertToJpg: false,
      convertToWebp: false,
      jpgQuality: 100,
      pngQuality: 100,
      webpQuality: 85,
      removeBg: false,
      removeBgSize: 'auto',
      trimTransparentBackground: false,
      jpgBackground: 'white'
    };
  }
}

/**
 * @param {Object} executor - RetryExecutor instance (generatedImage, emit)
 * @param {string} imageId
 * @param {string} status
 * @param {string} reason
 */
async function updateImageStatus(executor, imageId, status, reason = '') {
  try {
    if (executor.generatedImage && typeof executor.generatedImage.updateQCStatus === 'function') {
      await executor.generatedImage.updateQCStatus(imageId, status, reason);
      console.log(` RetryExecutor: Updated image ${imageId} status to ${status} in database`);
    } else {
      console.warn(` RetryExecutor: Cannot update database - generatedImage model not available`);
    }
  } catch (error) {
    console.error(` RetryExecutor: Failed to update database status for image ${imageId}:`, error);
  }
  executor.emit('image-status-updated', {
    imageId,
    status,
    reason,
    timestamp: new Date(),
    context: 'retry'
  });
}

module.exports = {
  getOriginalJobConfiguration,
  getFallbackConfiguration,
  getOriginalProcessingSettings,
  updateImageStatus
};
