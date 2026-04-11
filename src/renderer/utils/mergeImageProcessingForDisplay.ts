/**
 * Merge execution snapshot vs per-image processing for Dashboard modals.
 *
 * Rule (matches legacy intent / RetryPostProcessingService):
 * - `generated_images.processing_settings` is the persisted "as processed" record
 *   (RetryPostProcessingService writes canonical fields after custom retry; useOriginal keeps prior).
 * - When that record has any known processing keys, prefer it over job `configurationSnapshot.processing`
 *   so "Retry with custom settings" shows what actually ran, not the original job defaults.
 * - Otherwise fall back to execution snapshot (normal runs where the row often has no processing blob).
 */

export const PROCESSING_DISPLAY_KEYS = [
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
  'removeBgSize',
] as const;

export function toProcessingObject(val: unknown): Record<string, unknown> | null {
  if (val == null) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof val === 'object' && val !== null) return val as Record<string, unknown>;
  return null;
}

export function pickProcessingKeys(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  const out: Record<string, unknown> = {};
  PROCESSING_DISPLAY_KEYS.forEach(k => {
    if (k in obj) out[k] = obj[k];
  });
  return out;
}

function hasMeaningfulProcessingPick(picked: Record<string, unknown> | null): boolean {
  return picked != null && Object.keys(picked).length > 0;
}

/**
 * @param snapshotProcessing — `job_executions.configuration_snapshot.processing`
 * @param rawPerImage — `generated_images.processing_settings` (object or JSON string)
 */
export function mergeImageProcessingForDisplay(
  snapshotProcessing: Record<string, unknown> | null | undefined,
  rawPerImage: unknown
): Record<string, unknown> {
  const perObj = toProcessingObject(rawPerImage);
  const perPicked = pickProcessingKeys(perObj);
  if (hasMeaningfulProcessingPick(perPicked)) {
    return { ...(perObj || {}) };
  }

  const snapObj =
    snapshotProcessing && typeof snapshotProcessing === 'object' ? snapshotProcessing : null;
  const snapPicked = pickProcessingKeys(snapObj);
  if (hasMeaningfulProcessingPick(snapPicked)) {
    return { ...(snapObj || {}) };
  }

  return { ...(snapObj || {}), ...(perObj || {}) };
}
