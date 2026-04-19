/**
 * Main-process (CJS). Renderer imports `src/renderer/utils/runwareTextVectorizeModels.ts` instead
 * so Vite gets ESM named exports — both read `src/constants/runwareTextVectorize.json`.
 */
const path = require('path');

const manifest = require(path.join(__dirname, '../constants/runwareTextVectorize.json'));

function normalizeModelId(model) {
  return String(model ?? '').trim().toLowerCase();
}

/** Runware `vectorize` task (text-to-SVG); not `imageInference`. IDs listed in `src/constants/runwareTextVectorize.json`. */
function isRunwareTextVectorizeModel(model) {
  const m = normalizeModelId(model);
  return Array.isArray(manifest.textVectorizeModelIds)
    && manifest.textVectorizeModelIds.some((id) => String(id).trim().toLowerCase() === m);
}

const RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER = String(manifest.settingsHelperText || '').trim();

module.exports = {
  isRunwareTextVectorizeModel,
  RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER,
};
