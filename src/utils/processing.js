// Shared processing settings normalizer
// Normalizes/clamps processing settings; safe to call with partial objects

function normalizeProcessingSettings(input) {
  const allowedKeys = new Set([
    'imageEnhancement',
    'sharpening',
    'saturation',
    'imageConvert',
    'convertToJpg',
    'jpgQuality',
    'pngQuality',
    'removeBg',
    'removeBgSize',
    'trimTransparentBackground',
    'jpgBackground'
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
        if (!Number.isFinite(num)) num = 90;
        out[k] = Math.max(1, Math.min(100, Math.round(num)));
        break;
      }
      case 'pngQuality': {
        let num = Number(v);
        if (!Number.isFinite(num)) num = 100;
        out[k] = Math.max(1, Math.min(100, Math.round(num)));
        break;
      }
      case 'removeBgSize': {
        const allowed = new Set(['auto', 'full', '4k']);
        const val = String(v || 'auto').toLowerCase();
        out[k] = allowed.has(val) ? val : 'auto';
        break;
      }
      case 'jpgBackground': {
        out[k] = typeof v === 'string' ? v : '#FFFFFF';
        break;
      }
    }
  }
  // Enforce dependent flags: if imageConvert is false, convertToJpg must be false
  if (Object.prototype.hasOwnProperty.call(out, 'imageConvert') && out.imageConvert === false) {
    out.convertToJpg = false;
  }
  return out;
}

module.exports = { normalizeProcessingSettings };


