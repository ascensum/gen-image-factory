/**
 * Story 3.4 Phase 5b: Single job images tab state and derived data.
 * Extracted from SingleJobView.tsx.
 */
import { useState, useCallback, useMemo } from 'react';
import { formatQcLabel } from '../../../utils/qc';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../../types/generatedImage';

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

  const failedProcessingCount = useMemo(() => {
    if ((images as any[])?.length > 0) {
      let count = 0;
      for (const img of images as any[]) {
        const s = String(img?.qcStatus || '').toLowerCase();
        if (s === 'qc_failed' || s === 'retry_failed') count++;
      }
      return count;
    }
    return Number((job as any)?.qcFailedImages || 0);
  }, [images, job]);

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
    getImageUiStatus,
    getImageTitle,
  };
}
