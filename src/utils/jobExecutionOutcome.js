/**
 * Job execution outcome helpers (legacy parity): "successful generation" means a usable
 * image asset exists or failed only after generation (metadata / remove.bg / QC), so the
 * slot is retryable — not the same as vision-QC "approved".
 *
 * **SVG-only:** `processing_failed:download` with a `.svg` path is treated as failed generation
 * (no local repair); raster rows keep legacy behavior (path + download may still count as gen ok).
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

/** True when paths point at SVG output (Runware vector). Used only for outcome rules below. */
function imagePathEndsWithSvg(img) {
  const fp = String(img?.finalImagePath || '').trim().toLowerCase();
  const tp = String(img?.tempImagePath || '').trim().toLowerCase();
  return fp.endsWith('.svg') || tp.endsWith('.svg');
}

/**
 * SVG skips local repair; Runware records download + mkdir/writeFile failures as `processing_failed:download`.
 * If a path still exists (e.g. partial write), do not count as "successful generation" for metrics — raster paths unchanged.
 */
function isSvgRunwareGenerationLogisticsFailure(img) {
  if (!imagePathEndsWithSvg(img)) return false;
  const s = String(img?.qcStatus || '').toLowerCase();
  if (s !== 'qc_failed' && s !== 'retry_failed') return false;
  const r = String(img?.qcReason || '').toLowerCase();
  return r.startsWith('processing_failed:download');
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
  if (hasRenderableFile(img)) {
    if (isSvgRunwareGenerationLogisticsFailure(img)) return false;
    return true;
  }
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
