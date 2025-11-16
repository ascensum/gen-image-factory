export function formatQcLabel(status?: string | null, reason?: string | null): string | undefined {
  const s = String(status || '').toLowerCase();
  const r = String(reason || '').toLowerCase();
  if (s !== 'qc_failed') return undefined;
  if (!r) return 'QC Failed';
  if (r.startsWith('processing_failed:download')) return 'Download failed';
  if (r.startsWith('processing_failed:remove_bg')) return 'Background removal failed';
  if (r.startsWith('processing_failed:enhancement')) return 'Enhancement failed';
  if (r.startsWith('processing_failed:convert')) return 'Conversion failed';
  if (r.startsWith('processing_failed:save_final')) return 'Save failed';
  if (r.startsWith('processing_failed:metadata')) return 'Metadata failed';
  if (r.startsWith('processing_failed:qc')) return 'QC Failed';
  return 'QC Failed';
}

