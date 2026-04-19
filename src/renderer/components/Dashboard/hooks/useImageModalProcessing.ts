/**
 * Story 3.4 Phase 5c: Execution snapshot and merged processing settings for ImageModal.
 * Merge rules: see mergeImageProcessingForDisplay (per-image as-processed wins when present).
 */
import { useState, useEffect } from 'react';
import { mergeImageProcessingForDisplay } from '../../../utils/mergeImageProcessingForDisplay';

export interface UseImageModalProcessingOptions {
  imageId: string | null;
  imageProcessingSettings: unknown;
  isOpen: boolean;
}

export function useImageModalProcessing({ imageId, imageProcessingSettings, isOpen }: UseImageModalProcessingOptions): Record<string, unknown> {
  const [snapshotProcessing, setSnapshotProcessing] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchExecutionSnapshot() {
      try {
        const api = (window as { electronAPI?: { getJobExecutionByImageId?: (id: string) => Promise<{ success?: boolean; execution?: { configurationSnapshot?: { processing?: unknown } } }> } }).electronAPI;
        if (!api?.getJobExecutionByImageId || !imageId) return;
        const res = await api.getJobExecutionByImageId(String(imageId));
        const exec = res?.success && res?.execution ? res.execution : null;
        const proc = (exec?.configurationSnapshot?.processing != null)
          ? (exec.configurationSnapshot.processing as Record<string, unknown>)
          : null;
        if (!cancelled) setSnapshotProcessing(proc);
      } catch {
        // ignore
      }
    }
    if (isOpen && imageId) {
      fetchExecutionSnapshot();
    } else {
      setSnapshotProcessing(null);
    }
    return () => { cancelled = true; };
  }, [isOpen, imageId]);

  return mergeImageProcessingForDisplay(snapshotProcessing, imageProcessingSettings);
}
