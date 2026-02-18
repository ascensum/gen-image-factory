// Shared processing settings normalizer
// Normalizes/clamps processing settings; safe to call with partial objects

/**
 * Maps UI/settings vocabulary to backend canonical values for remove.bg failure mode.
 * Global Settings use 'soft'|'fail'; Single Job uses 'approve'|'mark_failed'. Backend expects 'approve'|'mark_failed'.
 * @param {string} value - 'soft'|'fail' (Settings) or 'approve'|'mark_failed' (Single Job)
 * @returns {'approve'|'mark_failed'}
 */
function normalizeRemoveBgFailureMode(value) {
  const v = String(value || 'approve').toLowerCase();
  if (v === 'fail' || v === 'mark_failed') return 'mark_failed';
  if (v === 'soft' || v === 'approve') return 'approve';
  return 'approve';
}

function normalizeProcessingSettings(input) {
  const allowedKeys = new Set([
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
    'removeBgSize',
    'trimTransparentBackground',
    'jpgBackground',
    'removeBgFailureMode'
  ]);
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!allowedKeys.has(k)) continue;
    switch (k) {
      case 'imageEnhancement':
      case 'imageConvert':
      case 'convertToJpg':
      case 'removeBg':
      case 'trimTransparentBackground':
        out[k] = Boolean(v);
        break;
      case 'convertToWebp': {
        out[k] = Boolean(v);
        break;
      }
      case 'sharpening': {
        let num = Number(v);
        if (!Number.isFinite(num)) num = 0;
        out[k] = Math.max(0, Math.min(100, Math.round(num)));
        break;
      }
      case 'saturation': {
        let num = Number(v);
        if (!Number.isFinite(num)) num = 1;
        out[k] = Math.max(0, Math.min(3, num));
        break;
      }
      case 'jpgQuality': {
        let num = Number(v);
        if (!Number.isFinite(num)) num = 85;
        out[k] = Math.max(1, Math.min(100, Math.round(num)));
        break;
      }
      case 'pngQuality': {
        // Deprecated: kept for backward compatibility, no longer used for PNG
        let num = Number(v);
        if (!Number.isFinite(num)) num = 100;
        out[k] = Math.max(1, Math.min(100, Math.round(num)));
        break;
      }
      case 'webpQuality': {
        let num = Number(v);
        if (!Number.isFinite(num)) num = 85;
        out[k] = Math.max(1, Math.min(100, Math.round(num)));
        break;
      }
      case 'removeBgSize': {
        const allowed = new Set(['auto', 'preview', 'full', '4k']);
        const val = String(v || 'auto').toLowerCase();
        out[k] = allowed.has(val) ? val : 'auto';
        break;
      }
      case 'jpgBackground': {
        out[k] = typeof v === 'string' ? v : '#FFFFFF';
        break;
      }
      case 'removeBgFailureMode': {
        out[k] = normalizeRemoveBgFailureMode(v);
        break;
      }
    }
  }
  // Enforce dependent flags: if imageConvert is false, convertToJpg must be false
  if (Object.prototype.hasOwnProperty.call(out, 'imageConvert') && out.imageConvert === false) {
    out.convertToJpg = false;
    out.convertToWebp = false;
  }
  // Mutually exclusive convert flags; prefer explicit WEBP over JPG when both provided
  if (out.convertToWebp) {
    out.convertToJpg = false;
  }
  return out;
}

module.exports = { normalizeProcessingSettings, normalizeRemoveBgFailureMode };


