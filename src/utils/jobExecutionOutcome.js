/**
 * Job execution outcome helpers (legacy parity): "successful generation" means a usable
 * image asset exists or failed only after generation (metadata / remove.bg / QC), so the
 * slot is retryable — not the same as vision-QC "approved".
 *
 * Renderer (Vite): mirror in `src/renderer/utils/jobExecutionOutcome.ts` — keep in sync.
 */

'use strict';

function hasRenderableFile(img) {
  if (!img || typeof img !== 'object') return false;
  const fp = img.finalImagePath && String(img.finalImagePath).trim();
  const tp = img.tempImagePath && String(img.tempImagePath).trim();
  return !!(fp || tp);
}

function qcReasonImpliesPostGenerationFailure(img) {
  const r = String(img?.qcReason || '').toLowerCase();
  if (!r) return false;
  /** CDN / Runware download failure with no file is not post-gen salvage (legacy UX). */
  if (r.startsWith('processing_failed:download')) return false;
  if (r.startsWith('processing_failed:')) return true;
  if (r.startsWith('metadata failed')) return true;
  return false;
}

/**
 * True when the slot produced a recoverable image (pixel file) or failed only in post-gen.
 * False for pure generation failures (e.g. invalid_result_format with no paths).
 */
function imageHadSuccessfulGeneration(img) {
  if (!img || typeof img !== 'object') return false;
  if (hasRenderableFile(img)) return true;
  const s = String(img.qcStatus || '').toLowerCase();
  if (s === 'qc_failed' || s === 'retry_failed') {
    return qcReasonImpliesPostGenerationFailure(img);
  }
  return false;
}

function countImagesGeneratedSuccessfully(images) {
  if (!Array.isArray(images)) return 0;
  let n = 0;
  for (const img of images) {
    if (imageHadSuccessfulGeneration(img)) n++;
  }
  return n;
}

module.exports = {
  hasRenderableFile,
  imageHadSuccessfulGeneration,
  countImagesGeneratedSuccessfully,
};
