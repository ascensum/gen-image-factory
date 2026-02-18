export function formatQcLabel(status?: string | null, reason?: string | null): string | undefined {
  const s = String(status || '').toLowerCase();
  const r = String(reason || '').toLowerCase();
  if (s !== 'qc_failed' && s !== 'retry_failed') return undefined;
  if (!r) return 'QC Failed';
  if (r.startsWith('processing_failed:download')) return 'Download failed';
  if (r.startsWith('processing_failed:remove_bg')) return 'Background removal failed';
  if (r.startsWith('processing_failed:trim')) return 'Trim failed';
  if (r.startsWith('processing_failed:enhancement')) return 'Enhancement failed';
  if (r.startsWith('processing_failed:convert')) return 'Conversion failed';
  if (r.startsWith('processing_failed:save_final')) return 'Save failed';
  if (r.startsWith('processing_failed:metadata')) return 'Metadata failed';
  /** QC step failed to run/respond — not "image failed QC"; we have no content reason. */
  if (r.startsWith('processing_failed:qc')) return 'QC analysis failed';
  return 'QC Failed';
}

/** Options for Failed Images Review label filter. Failed (All) resets filter; others match pill labels from formatQcLabel. */
export const FAILED_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Failed (All)' },
  { value: 'QC Failed', label: 'QC Failed' },
  { value: 'QC analysis failed', label: 'QC analysis failed' },
  { value: 'Download failed', label: 'Download failed' },
  { value: 'Background removal failed', label: 'Background removal failed' },
  { value: 'Trim failed', label: 'Trim failed' },
  { value: 'Enhancement failed', label: 'Enhancement failed' },
  { value: 'Conversion failed', label: 'Conversion failed' },
  { value: 'Save failed', label: 'Save failed' },
  { value: 'Metadata failed', label: 'Metadata failed' },
];

export function formatQcFailureReason(status?: string | null, reason?: string | null): string | undefined {
  const s = String(status || '').toLowerCase();
  const r = String(reason || '').toLowerCase();
  if ((s !== 'qc_failed' && s !== 'retry_failed') || !r) return undefined;
  if (r.startsWith('processing_failed:download')) return 'The system failed to download the image from the API.';
  if (r.startsWith('processing_failed:remove_bg')) return 'The system failed to remove the background for this image.';
  if (r.startsWith('processing_failed:trim')) return 'The system couldn’t trim transparent edges. The image was kept untrimmed.';
  if (r.startsWith('processing_failed:enhancement')) return 'The system failed to perform image enhancement operations.';
  if (r.startsWith('processing_failed:convert')) return 'The system couldn’t encode to the target format (JPG/WEBP/PNG). When possible, the image was saved in its original format.';
  if (r.startsWith('processing_failed:save_final')) return 'The system failed to save the final image output.';
  if (r.startsWith('processing_failed:metadata')) return 'The system failed to generate the metadata for this image.';
  if (r.startsWith('processing_failed:qc')) return 'The system failed to receive QC analysis response for this image.';
  // For genuine QC failures with a model-provided explanation, return undefined
  // so callers can display the original qcReason from the model.
  return undefined;
}

/**
 * Maps a raw retry error (e.g. from job-error / retry-error IPC) to a user-visible message.
 * Used for the retry toast and any other place we show "Retry error: ..." to the user.
 */
export function formatRetryErrorForUser(rawError: string | undefined): string {
  const r = String(rawError || '').trim();
  if (!r) return 'Retry failed. Please try again.';
  const lower = r.toLowerCase();
  // Known processing_failed:* codes (formatQcFailureReason uses startsWith, so suffixes are ignored)
  const friendly = formatQcFailureReason('retry_failed', lower);
  if (friendly) return `Retry error: ${friendly}`;
  // Unknown or technical message — show generic so we never expose internal codes
  return 'Retry failed. Please try again or check the image.';
}

