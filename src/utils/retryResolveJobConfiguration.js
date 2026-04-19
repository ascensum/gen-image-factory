/**
 * Resolve full job configuration (paths, prompts) for failed-image retry post-processing.
 * Uses the same path merge rules as RetryConfigService.getOriginalJobConfiguration.
 */

const path = require('path');
const RetryConfigService = require(path.join(__dirname, '../services/RetryConfigService'));

/**
 * @param {Object} image - Row from ImageRepository.getGeneratedImage
 * @param {Object} jobConfigModel - JobConfiguration model (getConfigurationById, getDefaultSettings)
 * @param {Object} jobRepository - JobRepository
 * @returns {Promise<Object>} Configuration shape expected by RetryPostProcessingService.run
 */
async function resolveRetryJobConfigurationForImage(image, jobConfigModel, jobRepository) {
  const exec = { jobConfig: jobConfigModel };
  try {
    if (!image?.executionId || !jobRepository || !jobConfigModel?.getConfigurationById) {
      return RetryConfigService.getFallbackConfiguration(exec);
    }
    const execRes = await jobRepository.getJobExecution(image.executionId);
    if (!execRes.success || !execRes.execution?.configurationId) {
      return RetryConfigService.getFallbackConfiguration(exec);
    }
    const cfgRes = await jobConfigModel.getConfigurationById(execRes.execution.configurationId);
    if (!cfgRes.success || !cfgRes.configuration) {
      return RetryConfigService.getFallbackConfiguration(exec);
    }
    const settings = cfgRes.configuration.settings || {};
    const filePaths = settings.filePaths || {};
    const defaultSettings = jobConfigModel.getDefaultSettings();
    const df = defaultSettings.filePaths || {};
    const correctedFilePaths = {
      outputDirectory:
        filePaths.outputDirectory && String(filePaths.outputDirectory).trim()
          ? filePaths.outputDirectory
          : df.outputDirectory,
      tempDirectory:
        filePaths.tempDirectory && String(filePaths.tempDirectory).trim()
          ? filePaths.tempDirectory
          : df.tempDirectory,
      systemPromptFile: filePaths.systemPromptFile || '',
      keywordsFile: filePaths.keywordsFile || '',
      qualityCheckPromptFile: filePaths.qualityCheckPromptFile || '',
      metadataPromptFile: filePaths.metadataPromptFile || ''
    };
    return {
      ...cfgRes.configuration,
      settings: { ...settings, filePaths: correctedFilePaths }
    };
  } catch {
    return RetryConfigService.getFallbackConfiguration(exec);
  }
}

module.exports = { resolveRetryJobConfigurationForImage };
