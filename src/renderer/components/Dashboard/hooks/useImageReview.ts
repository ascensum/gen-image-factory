/**
 * Story 3.4 Phase 3: Review operations (approve/reject/retry) and bulk actions.
 * Extracted from FailedImagesReviewPanel.tsx (frozen).
 */
import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { GeneratedImage } from '../../../../types/generatedImage';
import type { ProcessingSettings } from '../../../../types/processing';

export interface UseImageReviewOptions {
  /** When background is true, refresh without showing full-page loading (no blink). */
  loadAllImageStatuses: (background?: boolean) => Promise<void>;
  loadRetryQueueStatus: () => Promise<void>;
  setError: (err: string | null) => void;
  getCurrentTabImages: () => GeneratedImage[];
  getFilteredAndSortedImages: () => GeneratedImage[];
  /** Called after one or more images are approved so Dashboard can refresh its gallery when shown. */
  onApprovedImages?: () => void;
}

const defaultProcessingSettings: ProcessingSettings = {
  imageEnhancement: false,
  sharpening: 0,
  saturation: 1,
  imageConvert: false,
  convertToJpg: true,
  jpgQuality: 90,
  pngQuality: 100,
  removeBg: false,
  removeBgSize: 'auto',
  trimTransparentBackground: false,
  jpgBackground: '#FFFFFF',
};

export function useImageReview(options: UseImageReviewOptions) {
  const {
    loadAllImageStatuses,
    loadRetryQueueStatus,
    setError,
    getCurrentTabImages,
    getFilteredAndSortedImages,
    onApprovedImages,
  } = options;

  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedImageForReview, setSelectedImageForReview] = useState<GeneratedImage | null>(null);
  const [deletedImageIds, setDeletedImageIds] = useState<Set<string>>(new Set());
  const [showProcessingSettingsModal, setShowProcessingSettingsModal] = useState(false);
  const [processingSettings] = useState<ProcessingSettings>(defaultProcessingSettings);

  const waitAndRefreshUntilDone = useCallback(
    async (imageIds: string[], timeoutMs = 60000, intervalMs = 2000) => {
      try {
        const normalize = (resp: any) =>
          resp && typeof resp === 'object' && resp.success !== undefined
            ? resp.images || []
            : Array.isArray(resp) ? resp : [];
        const includesTracked = (arr: any[]) =>
          arr.some((img: any) => imageIds.includes(String(img.id)));
        const startedAt = Date.now();
        await loadAllImageStatuses(true);
        await loadRetryQueueStatus();
        while (Date.now() - startedAt < timeoutMs) {
          const [pendingResp, processingResp] = await Promise.all([
            (window as any).electronAPI.generatedImages.getImagesByQCStatus('retry_pending'),
            (window as any).electronAPI.generatedImages.getImagesByQCStatus('processing'),
          ]);
          const pending = normalize(pendingResp);
          const processing = normalize(processingResp);
          await loadAllImageStatuses(true);
          await loadRetryQueueStatus();
          if (!includesTracked(pending) && !includesTracked(processing)) break;
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      } catch (_) {}
    },
    [loadAllImageStatuses, loadRetryQueueStatus]
  );

  const handleImageSelect = useCallback((imageId: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentImages = getCurrentTabImages();
    setSelectedImages((prev) => {
      if (prev.size === currentImages.length) return new Set();
      return new Set(currentImages.map((img) => String(img.id)));
    });
  }, [getCurrentTabImages]);

  const handleImageAction = useCallback(
    async (action: string, imageId: string) => {
      try {
        setError(null);
        const api = (window as any).electronAPI;
        if (action === 'approve') {
          let approveResult: any = null;
          if (api?.generatedImages?.manualApproveImage) {
            approveResult = await api.generatedImages.manualApproveImage(imageId);
          } else {
            await api.generatedImages.updateQCStatus(imageId, 'approved');
          }
          try {
            const outDir = approveResult?.outputDirectory;
            const finalPath = approveResult?.finalImagePath;
            const dirFromPath =
              finalPath && typeof finalPath === 'string'
                ? finalPath.replace(/\\[^/]*$/, '').replace(/\/[^/]*$/, '')
                : null;
            const rootToAdd = outDir || dirFromPath || null;
            if (rootToAdd && api.refreshProtocolRoots) {
              await api.refreshProtocolRoots([rootToAdd]);
            }
          } catch (_) {}
          await loadAllImageStatuses(true);
          onApprovedImages?.();
        } else if (action === 'retry') {
          setSelectedImages((prev) => new Set(prev).add(imageId));
        } else if (action === 'delete') {
          await api.generatedImages.deleteGeneratedImage(imageId);
          await loadAllImageStatuses(true);
        } else if (action === 'view') {
          const allImages = getFilteredAndSortedImages();
          const image = allImages.find((img) => String(img.id) === imageId);
          if (image) setSelectedImageForReview(image);
        }
      } catch (e) {
        setError(`Failed to ${action} image`);
        console.error(`Failed to ${action} image:`, e);
      }
    },
    [
      setError,
      loadAllImageStatuses,
      getFilteredAndSortedImages,
      onApprovedImages,
    ]
  );

  const handleBulkAction = useCallback(
    async (action: string) => {
      if (selectedImages.size === 0) return;
      try {
        setError(null);
        const api = (window as any).electronAPI;
        if (action === 'approve') {
          for (const imageId of selectedImages) {
            if (api?.generatedImages?.manualApproveImage) {
              await api.generatedImages.manualApproveImage(imageId);
            } else {
              await api.generatedImages.updateQCStatus(imageId, 'approved');
            }
          }
        } else if (action === 'retry') {
          setShowProcessingSettingsModal(true);
          return;
        } else if (action === 'delete') {
          for (const imageId of selectedImages) {
            await api.generatedImages.deleteGeneratedImage(imageId);
          }
        }
        await loadAllImageStatuses(true);
        setSelectedImages(new Set());
        if (action === 'approve') onApprovedImages?.();
      } catch (e) {
        setError(`Failed to bulk ${action} images`);
        console.error(`Failed to bulk ${action} images:`, e);
      }
    },
    [selectedImages, setError, loadAllImageStatuses, onApprovedImages]
  );

  const handleRetryWithSettings = useCallback(
    async (
      useOriginalSettings: boolean,
      modifiedSettings?: ProcessingSettings,
      includeMetadata?: boolean,
      failOptions?: { enabled: boolean; steps: string[] }
    ) => {
      if (selectedImages.size === 0) return;
      try {
        setError(null);
        const imageIds = Array.from(selectedImages);
        const result = await (window as any).electronAPI.retryFailedImagesBatch(
          imageIds,
          useOriginalSettings,
          useOriginalSettings ? null : (modifiedSettings || processingSettings),
          includeMetadata,
          failOptions || { enabled: false, steps: [] }
        );
        if (result?.success) {
          await loadAllImageStatuses(true);
          await loadRetryQueueStatus();
          setSelectedImages(new Set());
          setShowProcessingSettingsModal(false);
          waitAndRefreshUntilDone(imageIds.map(String)).catch(() => {});
        } else {
          setError(result?.error || 'Failed to process retry operations');
        }
      } catch (e) {
        setError('Failed to process retry operations');
        console.error('Failed to process retry operations:', e);
      }
    },
    [
      selectedImages,
      processingSettings,
      setError,
      loadAllImageStatuses,
      loadRetryQueueStatus,
      waitAndRefreshUntilDone,
    ]
  );

  const clearSelection = useCallback(() => setSelectedImages(new Set()), []);

  return {
    selectedImages,
    setSelectedImages,
    selectedImageForReview,
    setSelectedImageForReview,
    deletedImageIds,
    setDeletedImageIds,
    showProcessingSettingsModal,
    setShowProcessingSettingsModal,
    processingSettings,
    handleImageSelect,
    handleSelectAll,
    handleImageAction,
    handleBulkAction,
    handleRetryWithSettings,
    clearSelection,
  };
}
