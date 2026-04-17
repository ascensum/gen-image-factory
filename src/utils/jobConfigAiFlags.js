/**
 * Coercion for `ai.*` toggles on the **main** job pipeline (`prepareJobConfig` → `JobService`).
 * SQLite / legacy JSON may store "true" strings instead of booleans.
 *
 * Retry-with-original (`RetryPostProcessingService`) does **not** run vision QC — it only uses
 * metadata regeneration + image processing. QC flags here apply to `JobService` only.
 */

function isTruthyAiFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

function isRunMetadataGenEnabledForJobConfig(config) {
  return isTruthyAiFlag(config?.ai?.runMetadataGen);
}

/** Main job only — `JobService` / `PostGenerationService` vision QC. Not used by retry queue. */
function isRunQualityCheckEnabledForJobConfig(config) {
  return isTruthyAiFlag(config?.ai?.runQualityCheck);
}

module.exports = {
  isTruthyAiFlag,
  isRunMetadataGenEnabledForJobConfig,
  isRunQualityCheckEnabledForJobConfig,
};
