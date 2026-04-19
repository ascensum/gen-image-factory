/**
 * Story 3.4 Phase 5b: Single job images tab state and derived data.
 * Extracted from SingleJobView.tsx.
 */
import { useState, useCallback, useMemo } from 'react';
import { formatQcLabel } from '../../../utils/qc';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../../types/generatedImage';
import { countImagesGeneratedSuccessfully } from '../../../utils/jobExecutionOutcome';

function parseImageMetadata(raw: any): any {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function hasRenderableFile(img: any): boolean {
  return (
    !!(img?.finalImagePath && String(img.finalImagePath).trim()) ||
    !!(img?.tempImagePath && String(img.tempImagePath).trim())
  );
}

/** Post-pipeline failure even when paths are not yet synced to the row. */
function qcReasonImpliesPostPipelineProcessingFailure(img: any): boolean {
  const r = String(img?.qcReason || '').toLowerCase();
  if (!r) return false;
  if (r.startsWith('processing_failed:remove_bg')) return true;
  if (r.startsWith('processing_failed:qc')) return true;
  if (r.startsWith('metadata failed')) return true;
  return false;
}

export function useSingleJobImages(images: GeneratedImage[], job: any) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [imageFilter, setImageFilter] = useState('all');

  const getImageUiStatus = useCallback((qcStatus?: string | null): 'approved' | 'qc_failed' => {
    const s = (qcStatus || '').toLowerCase();
    return (s === 'approved' || s === 'complete' || s === 'completed') ? 'approved' : 'qc_failed';
  }, []);

  const getImageTitle = useCallback((img: any): string => {
    const meta = parseImageMetadata(img?.metadata);
    const title = typeof meta?.title === 'string' ? meta.title : (meta?.title?.en || '');
    return title && title.trim() !== '' ? title : `Image ${img?.id}`;
  }, []);

  const qcReasonFilters = useMemo(() => {
    const keyToLabel = new Map<string, string>();
    const seenLabels = new Set<string>();
    for (const img of images as any[]) {
      const s = String(img?.qcStatus || '').toLowerCase();
      if (s === 'approved' || s === 'complete' || s === 'completed' || s === 'processing') continue;
      const r = String(img?.qcReason || '').toLowerCase();
      if (!r) continue;
      const key = r.split(':').slice(0, 2).join(':');
      const label = formatQcLabel(s, r) || 'QC Failed';
      if (key && !keyToLabel.has(key) && !seenLabels.has(label)) {
        keyToLabel.set(key, label);
        seenLabels.add(label);
      }
    }
    return Array.from(keyToLabel.entries()).map(([value, label]) => ({ value, label }));
  }, [images]);

  /** Approved / passed gallery (vision QC passed or auto-approved). */
  const approvedImagesCount = useMemo(() => {
    if (!(images as any[])?.length) {
      return Number((job as any)?.approvedImages ?? 0);
    }
    let n = 0;
    for (const img of images as any[]) {
      const s = String(img?.qcStatus || '').toLowerCase();
      if (s === 'approved' || s === 'complete' || s === 'completed') n++;
    }
    return n;
  }, [images, job]);

  /**
   * Generated successfully (file exists) but failed after generation: post-processing or vision QC, or retry hard-fail.
   * Excludes pure generation failures (e.g. download) with no saved file.
   */
  const failedProcessingCount = useMemo(() => {
    if ((images as any[])?.length > 0) {
      let count = 0;
      for (const img of images as any[]) {
        const s = String(img?.qcStatus || '').toLowerCase();
        if (s !== 'qc_failed' && s !== 'retry_failed') continue;
        if (hasRenderableFile(img) || qcReasonImpliesPostPipelineProcessingFailure(img)) count++;
      }
      return count;
    }
    return Number((job as any)?.qcFailedImages || 0);
  }, [images, job]);

  /**
   * Slots with generated output (aligned with job_executions.successful_images / jobExecutionOutcome).
   * Uses max(rows, stored) so missing rows (e.g. partial fetch) do not undercount vs persisted job row.
   */
  const generatedOkCount = useMemo(() => {
    const stored = (job as any)?.successfulImages;
    const storedNum = stored != null && stored !== '' ? Number(stored) : NaN;
    const fromStored = Number.isFinite(storedNum) ? storedNum : 0;
    if (!(images as any[])?.length) {
      return fromStored;
    }
    const fromRows = countImagesGeneratedSuccessfully(images as any[]);
    return Math.max(fromRows, fromStored);
  }, [images, job]);

  /**
   * Planned slots that never produced generated output (no row / no file), plus pure gen failures.
   * Matches job_executions.failed_images when the execution row is in sync (planned − generatedOk).
   */
  const generationFailedCount = useMemo(() => {
    const planned =
      Number((job as any)?.totalImages) > 0
        ? Number((job as any).totalImages)
        : (images as any[])?.length || 0;
    const storedFailed = (job as any)?.failedImages;
    const fromStored = storedFailed != null && storedFailed !== '' ? Number(storedFailed) : NaN;
    if (!(images as any[])?.length) {
      return Number.isFinite(fromStored) ? Math.max(0, fromStored) : 0;
    }
    if (planned > 0) {
      return Math.max(0, planned - generatedOkCount);
    }
    let notApproved = 0;
    for (const img of images as any[]) {
      const s = String(img?.qcStatus || '').toLowerCase();
      if (s !== 'approved' && s !== 'complete' && s !== 'completed') notApproved++;
    }
    return Math.max(0, notApproved - failedProcessingCount);
  }, [images, job, generatedOkCount, failedProcessingCount]);

  const filteredImages = useMemo(() => {
    if (imageFilter === 'all') return images;
    if (imageFilter === 'approved') {
      return images.filter((img: any) => {
        const s = String(img?.qcStatus || '').toLowerCase();
        return s === 'approved' || s === 'complete' || s === 'completed';
      });
    }
    if (imageFilter === 'failed_all' || imageFilter === 'qc_failed') {
      return images.filter((img: any) => {
        const s = String(img?.qcStatus || '').toLowerCase();
        return s === 'qc_failed' || s === 'retry_failed';
      });
    }
    if (imageFilter === 'failed_qc') {
      return images.filter((img: any) => {
        const s = String(img?.qcStatus || '').toLowerCase();
        if (!(s === 'qc_failed' || s === 'retry_failed')) return false;
        const r = String(img?.qcReason || '').toLowerCase();
        if (!r) return true;
        if (!r.startsWith('processing_failed:')) return true;
        return r.startsWith('processing_failed:qc');
      });
    }
    if (imageFilter === 'failed_tech') {
      return images.filter((img: any) => {
        const s = String(img?.qcStatus || '').toLowerCase();
        if (!(s === 'qc_failed' || s === 'retry_failed')) return false;
        const r = String(img?.qcReason || '').toLowerCase();
        return r.startsWith('processing_failed:') && !r.startsWith('processing_failed:qc');
      });
    }
    const reasonPrefix = String(imageFilter || '');
    return images.filter((img: any) => {
      const s = String(img?.qcStatus || '').toLowerCase();
      if (s === 'approved' || s === 'complete' || s === 'completed') return false;
      const r = String(img?.qcReason || '').toLowerCase();
      return r.startsWith(reasonPrefix);
    });
  }, [images, imageFilter]);

  return {
    viewMode,
    setViewMode,
    imageFilter,
    setImageFilter,
    filteredImages,
    qcReasonFilters,
    failedProcessingCount,
    approvedImagesCount,
    generatedOkCount,
    generationFailedCount,
    getImageUiStatus,
    getImageTitle,
  };
}
