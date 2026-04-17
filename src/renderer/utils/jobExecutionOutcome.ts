/**
 * Vite/ESM copy of `src/utils/jobExecutionOutcome.js` (main process uses CJS there).
 * Keep rules identical when changing either file.
 */

function hasRenderableFile(img: unknown): boolean {
  if (!img || typeof img !== 'object') return false;
  const o = img as Record<string, unknown>;
  const fp = o.finalImagePath && String(o.finalImagePath).trim();
  const tp = o.tempImagePath && String(o.tempImagePath).trim();
  return !!(fp || tp);
}

function qcReasonImpliesPostGenerationFailure(img: unknown): boolean {
  const o = img as Record<string, unknown>;
  const r = String(o?.qcReason || '').toLowerCase();
  if (!r) return false;
  if (r.startsWith('processing_failed:download')) return false;
  if (r.startsWith('processing_failed:')) return true;
  if (r.startsWith('metadata failed')) return true;
  return false;
}

export function imageHadSuccessfulGeneration(img: unknown): boolean {
  if (!img || typeof img !== 'object') return false;
  if (hasRenderableFile(img)) return true;
  const o = img as Record<string, unknown>;
  const s = String(o.qcStatus || '').toLowerCase();
  if (s === 'qc_failed' || s === 'retry_failed') {
    return qcReasonImpliesPostGenerationFailure(img);
  }
  return false;
}

export function countImagesGeneratedSuccessfully(images: unknown): number {
  if (!Array.isArray(images)) return 0;
  let n = 0;
  for (const img of images) {
    if (imageHadSuccessfulGeneration(img)) n++;
  }
  return n;
}

export { hasRenderableFile };
