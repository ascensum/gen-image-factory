/**
 * Story 3.4 Phase 5c: Execution snapshot and merged processing settings for ImageModal.
 * Extracted from ImageModal.tsx to keep modal < 400 lines.
 */
import { useState, useEffect } from 'react';

function toObject(val: unknown): Record<string, unknown> | null {
  if (!val) return null;
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

const PROCESSING_KEYS = [
  'imageEnhancement', 'sharpening', 'saturation', 'imageConvert', 'convertToJpg',
  'jpgQuality', 'pngQuality', 'removeBg', 'trimTransparentBackground', 'jpgBackground', 'removeBgSize', 'convertToWebp', 'webpQuality',
];

function pickProcessingKeys(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  const out: Record<string, unknown> = {};
  PROCESSING_KEYS.forEach(k => {
    if (k in obj) out[k] = obj[k];
  });
  return out;
}

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

  const perImageProc = pickProcessingKeys(toObject(imageProcessingSettings));
  const snapshotProc = pickProcessingKeys(snapshotProcessing);
  const isCustomRetry = !!(perImageProc && snapshotProc && JSON.stringify(perImageProc) !== JSON.stringify(snapshotProc));
  const processingSettings: Record<string, unknown> = isCustomRetry
    ? (toObject(imageProcessingSettings) || snapshotProcessing || {})
    : (snapshotProcessing || toObject(imageProcessingSettings) || {});

  return processingSettings;
}
