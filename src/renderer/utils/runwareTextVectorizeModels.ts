/**
 * Vite/ESM entry for Runware text-to-vector model list (manifest lives under `src/constants/`).
 * Main process uses `src/utils/runwareTextVectorizeModels.js` (CJS) with the same JSON — keep rules in sync.
 */
import manifest from '../../constants/runwareTextVectorize.json';

export function isRunwareTextVectorizeModel(model: string | undefined | null): boolean {
  const m = String(model ?? '').trim().toLowerCase();
  return manifest.textVectorizeModelIds.some((id) => String(id).trim().toLowerCase() === m);
}

export const RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER = String(manifest.settingsHelperText || '').trim();
