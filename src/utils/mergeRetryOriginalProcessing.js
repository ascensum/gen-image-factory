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

module.exports = { mergeRetryOriginalProcessing };
