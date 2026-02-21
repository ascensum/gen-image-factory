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
  if (r.startsWith('processing_failed:qc')) return 'QC analysis failed';
  return 'QC Failed';
}

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

export function formatRetryErrorForUser(error?: string | null): string {
  const e = String(error || '').toLowerCase();
  if (!e) return 'Retry failed. Please try again.';
  if (e.startsWith('processing_failed:')) {
    const reason = formatQcFailureReason('qc_failed', e);
    if (reason) return `Retry error: ${reason}`;
  }
  return 'Retry failed. Please try again or check the image.';
}

export const FAILED_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
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

