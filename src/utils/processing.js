// Shared processing settings normalizer
// Normalizes/clamps processing settings; safe to call with partial objects

/** SQLite/legacy JSON often stores booleans as strings; Boolean("false") === true in JS. */
function coerceProcessingBoolean(v) {
  if (v === true || v === false) return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === '') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  }
  return Boolean(v);
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
        out[k] = coerceProcessingBoolean(v);
        break;
      case 'convertToWebp': {
        out[k] = coerceProcessingBoolean(v);
        break;
      }
      case 'sharpening': {
        // 0–10 slider with 0.5 steps (matches Settings / retry UI); map to sharp sigma in ImageProcessorService (×0.2)
        let num = Number(v);
        if (!Number.isFinite(num)) num = 0;
        num = Math.max(0, Math.min(10, num));
        out[k] = Math.round(num * 2) / 2;
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
        if (typeof v !== 'string') {
          out[k] = 'white';
          break;
        }
        const s = v.trim().toLowerCase();
        // Legacy UI offered "transparent"; JPEG has no alpha—treat as white flatten.
        if (s === 'transparent' || s === '') {
          out[k] = 'white';
          break;
        }
        out[k] = v;
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
  // Trim transparent edges only applies after remove.bg produces alpha; ignore trim if remove.bg is off
  if (!out.removeBg) {
    out.trimTransparentBackground = false;
  }
  return out;
}

function normalizeRemoveBgFailureMode(v) {
  const val = String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (val === 'fail' || val === 'mark_failed') ? 'mark_failed' : 'approve';
}

/**
 * Build processing config for post-QC processing pass.
 * Merges global processing settings with optional per-image overrides.
 * Semantics match legacy `jobRunner.js` post-QC `processingConfig` object (pre–Story 5.3).
 */
function buildPostQCProcessingConfig(proc, perImage, tempDir, effectiveFailMode) {
  const p = perImage || {};
  return {
    tempDirectory: tempDir,
    outputDirectory: tempDir,
    _softFailures: [],
    removeBg: !!(p.removeBg ?? proc.removeBg),
    imageConvert: !!(p.imageConvert ?? proc.imageConvert),
    convertToJpg: !!(p.convertToJpg ?? proc.convertToJpg),
    convertToWebp: !!(p.convertToWebp ?? proc.convertToWebp),
    trimTransparentBackground: !!(p.trimTransparentBackground ?? proc.trimTransparentBackground),
    imageEnhancement: !!(p.imageEnhancement ?? proc.imageEnhancement),
    sharpening: (p.sharpening !== undefined) ? p.sharpening : (proc.sharpening ?? 0),
    saturation: (p.saturation !== undefined) ? p.saturation : (proc.saturation ?? 1),
    jpgBackground: p.jpgBackground || proc.jpgBackground || 'white',
    removeBgSize: p.removeBgSize || proc.removeBgSize || 'preview',
    removeBgFailureMode: normalizeRemoveBgFailureMode(effectiveFailMode || 'approve'),
    jpgQuality: (p.jpgQuality !== undefined) ? p.jpgQuality : (proc.jpgQuality ?? 85),
    pngQuality: (p.pngQuality !== undefined) ? p.pngQuality : (proc.pngQuality ?? 100),
    webpQuality: (p.webpQuality !== undefined) ? p.webpQuality : (proc.webpQuality ?? 85)
  };
}

/**
 * True when post-QC ImagePipelineService would only re-encode via Sharp with no user-requested work.
 * Used to skip processImage and move the temp file as-is to the final folder.
 */
function isPostQCPipelineNoOp(cfg) {
  if (!cfg || typeof cfg !== 'object') return true;
  if (cfg.removeBg) return false;
  if (cfg.trimTransparentBackground) return false;
  if (cfg.imageEnhancement) return false;
  if (cfg.imageConvert) return false;
  return true;
}

module.exports = {
  normalizeProcessingSettings,
  normalizeRemoveBgFailureMode,
  buildPostQCProcessingConfig,
  isPostQCPipelineNoOp,
  coerceProcessingBoolean
};
