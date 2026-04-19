/**
 * Resolve whether AI **metadata generation** was enabled for a job execution, for
 * retry-with-original-settings. Checks multiple snapshot shapes and coerces legacy values.
 *
 * Does **not** consider vision QC (`runQualityCheck`) — retry flow never runs QC
 * (see `RetryPostProcessingService`).
 */

const { isTruthyAiFlag } = require('./jobConfigAiFlags');

function readFromAiBlock(ai) {
  if (!ai || typeof ai !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(ai, 'runMetadataGen')) return null;
  return isTruthyAiFlag(ai.runMetadataGen);
}

function readRunMetadataGenForRetry(executionSnapshot, jobConfiguration) {
  const fromSnapshotTop = readFromAiBlock(executionSnapshot?.ai);
  if (fromSnapshotTop !== null) return fromSnapshotTop;

  const fromSnapshotNested = readFromAiBlock(executionSnapshot?.settings?.ai);
  if (fromSnapshotNested !== null) return fromSnapshotNested;

  const fromJobSettings = readFromAiBlock(jobConfiguration?.settings?.ai);
  if (fromJobSettings !== null) return fromJobSettings;

  const fromJobTop = readFromAiBlock(jobConfiguration?.ai);
  if (fromJobTop !== null) return fromJobTop;

  return false;
}

module.exports = {
  readRunMetadataGenForRetry,
  /** @deprecated Prefer `isTruthyAiFlag` from `jobConfigAiFlags` — kept for existing tests. */
  isRunMetadataGenTruthy: isTruthyAiFlag,
};
