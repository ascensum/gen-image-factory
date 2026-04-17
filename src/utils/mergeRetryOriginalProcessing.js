/**
 * Main-process mirror of mergeImageProcessingForDisplay.ts — same merge rules for retry
 * with original settings (per-image blob vs job execution configurationSnapshot.processing).
 */

const PROCESSING_KEYS = [
  'imageEnhancement',
  'sharpening',
  'saturation',
  'imageConvert',
  'convertToJpg',
  'convertToWebp',
  'jpgQuality',
  'pngQuality',
  'webpQuality',
  'removeBg',
  'trimTransparentBackground',
  'jpgBackground',
  'removeBgSize'
];

function toProcessingObject(val) {
  if (val == null) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  if (typeof val === 'object') return val;
  return null;
}

function pickProcessingKeys(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const k of PROCESSING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return Object.keys(out).length ? out : null;
}

function hasMeaningfulPick(picked) {
  return picked != null && Object.keys(picked).length > 0;
}

/**
 * `configuration_snapshot` is usually top-level `processing`; some paths store `settings.processing`.
 *
 * @param {Object|null|undefined} executionSnapshot
 * @returns {Object|null}
 */
function getExecutionSnapshotProcessing(executionSnapshot) {
  if (!executionSnapshot || typeof executionSnapshot !== 'object') return null;
  const top = executionSnapshot.processing;
  if (top != null && typeof top === 'object') return top;
  const nested = executionSnapshot.settings && executionSnapshot.settings.processing;
  if (nested != null && typeof nested === 'object') return nested;
  return null;
}

/** True when execution snapshot processing defines any pipeline toggles (not an empty object). */
function snapshotDefinesPipelineToggles(snapshotProcessing) {
  const snapObj =
    snapshotProcessing && typeof snapshotProcessing === 'object' ? snapshotProcessing : null;
  const picked = pickProcessingKeys(snapObj);
  if (!hasMeaningfulPick(picked)) return false;
  const p = picked;
  return !!(
    p.removeBg ||
    p.imageConvert ||
    p.imageEnhancement ||
    p.trimTransparentBackground ||
    (Number(p.sharpening) > 0) ||
    (Number.isFinite(Number(p.saturation)) && Math.abs(Number(p.saturation) - 1) > 1e-6)
  );
}

/**
 * Retry-with-original for images from the same execution: use one merged processing object for
 * every row. Per-image blobs are often partial (saved at different pipeline stages); they must
 * NOT replace the full job snapshot when the snapshot already defines processing.
 *
 * @param {Object|null|undefined} snapshotProcessing - configurationSnapshot.processing
 * @param {Object|null|undefined} jobCfgProcessing - saved JobConfiguration.settings.processing
 * @param {unknown} rawPerImage - generated_images.processing_settings
 */
function mergeOriginalRetryProcessingUniform(snapshotProcessing, jobCfgProcessing, rawPerImage) {
  const snapObj =
    snapshotProcessing && typeof snapshotProcessing === 'object' ? snapshotProcessing : null;
  if (snapshotDefinesPipelineToggles(snapObj)) {
    const cfg = jobCfgProcessing && typeof jobCfgProcessing === 'object' ? jobCfgProcessing : {};
    return { ...cfg, ...snapObj };
  }
  const innerMerged = mergeRetryOriginalProcessing(snapshotProcessing, rawPerImage);
  return mergeRetryOriginalProcessing(jobCfgProcessing || null, innerMerged);
}

/**
 * @param {Object|null|undefined} snapshotProcessing - configurationSnapshot.processing
 * @param {unknown} rawPerImage - generated_images.processing_settings (object or JSON string)
 */
function mergeRetryOriginalProcessing(snapshotProcessing, rawPerImage) {
  const perObj = toProcessingObject(rawPerImage);
  const perPicked = pickProcessingKeys(perObj);
  if (hasMeaningfulPick(perPicked)) {
    return { ...(perObj || {}) };
  }

  const snapObj =
    snapshotProcessing && typeof snapshotProcessing === 'object' ? snapshotProcessing : null;
  const snapPicked = pickProcessingKeys(snapObj);
  if (hasMeaningfulPick(snapPicked)) {
    return { ...(snapObj || {}) };
  }

  return { ...(snapObj || {}), ...(perObj || {}) };
}

module.exports = {
  mergeRetryOriginalProcessing,
  mergeOriginalRetryProcessingUniform,
  snapshotDefinesPipelineToggles,
  getExecutionSnapshotProcessing,
};
