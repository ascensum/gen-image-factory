/**
 * Custom retry (`useOriginalSettings: false`): selected images may come from different executions.
 * Per-image linked job configuration must **not** drive output/temp/metadata prompt paths — use the
 * app's current global settings (`getSettings`) so the retry modal's processing + one unified path set apply.
 *
 * @param {object|null|undefined} globalSettings - `settingsComposer.getSettings().settings`
 * @param {object|null|undefined} perImageJobConfiguration - `resolveRetryJobConfigurationForImage` (fallback only)
 * @returns {object} Shape expected by `RetryPostProcessingService.run` (`settings.filePaths`, …)
 */
function buildCustomRetryJobConfiguration(globalSettings, perImageJobConfiguration) {
  const base =
    perImageJobConfiguration && typeof perImageJobConfiguration === 'object'
      ? { ...perImageJobConfiguration }
      : {};
  const baseSt = base.settings && typeof base.settings === 'object' ? { ...base.settings } : {};
  const g = globalSettings && typeof globalSettings === 'object' ? globalSettings : {};
  const gFp = g.filePaths && typeof g.filePaths === 'object' ? { ...g.filePaths } : {};
  const bFp = baseSt.filePaths && typeof baseSt.filePaths === 'object' ? { ...baseSt.filePaths } : {};
  const mergedFp = {
    ...bFp,
    ...gFp,
    outputDirectory:
      gFp.outputDirectory && String(gFp.outputDirectory).trim()
        ? gFp.outputDirectory
        : bFp.outputDirectory,
    tempDirectory:
      gFp.tempDirectory && String(gFp.tempDirectory).trim()
        ? gFp.tempDirectory
        : bFp.tempDirectory,
    systemPromptFile: gFp.systemPromptFile || bFp.systemPromptFile || '',
    keywordsFile: gFp.keywordsFile || bFp.keywordsFile || '',
    qualityCheckPromptFile: gFp.qualityCheckPromptFile || bFp.qualityCheckPromptFile || '',
    metadataPromptFile:
      gFp.metadataPromptFile != null && String(gFp.metadataPromptFile).trim() !== ''
        ? gFp.metadataPromptFile
        : bFp.metadataPromptFile || '',
  };
  return {
    ...base,
    settings: {
      ...baseSt,
      filePaths: mergedFp,
    },
  };
}

module.exports = { buildCustomRetryJobConfiguration };
