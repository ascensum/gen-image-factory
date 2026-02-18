/**
 * Story 3.4 Phase 5c.4: FailedImageReviewModal container – composes zoom/pan hook,
 * processing hook, Header, ImageView, and TabsContent. Kept < 400 lines.
 */
import React, { useState, useEffect, useRef } from 'react';
import './FailedImageReviewModal.css';
import type { GeneratedImage } from '../../../types/generatedImage';
import { useFailedImageReviewModalZoomPan } from './hooks/useFailedImageReviewModalZoomPan';
import { useImageModalProcessing } from './hooks/useImageModalProcessing';
import FailedImageReviewModalHeader from './components/FailedImageReviewModalHeader';
import FailedImageReviewModalImageView from './components/FailedImageReviewModalImageView';
import FailedImageReviewModalTabsContent, { type FailedImageReviewTabType } from './components/FailedImageReviewModalTabsContent';

interface FailedImageReviewModalProps {
  image: GeneratedImage;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, imageId: string) => void;
  onApprove?: (imageId: string) => Promise<void>;
  onRetry?: (imageId: string) => Promise<void>;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onDelete?: (imageId: string) => Promise<void>;
}

const FailedImageReviewModal: React.FC<FailedImageReviewModalProps> = ({
  image,
  isOpen,
  onClose,
  onAction,
  onApprove,
  onRetry,
  onPrevious,
  onNext,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<FailedImageReviewTabType>('details');
  const [showHelp, setShowHelp] = useState(false);
  const previousImageIdRef = useRef<string | number | null>(null);

  const zoomPan = useFailedImageReviewModalZoomPan({
    isOpen,
    imageId: (image as { id?: string | number })?.id ?? null,
  });

  const processingSettings = useImageModalProcessing({
    imageId: image?.id != null ? String(image.id) : null,
    imageProcessingSettings: (image as { processingSettings?: unknown })?.processingSettings,
    isOpen,
  });

  const handleAction = (action: string) => {
    onAction(action, String(image.id));
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    if (isOpen && image) {
      const currentImageId = (image as { id?: string | number }).id;
      const previousImageId = previousImageIdRef.current;
      const isNewSession = previousImageId === null;
      const imageChanged = previousImageId !== null && String(previousImageId) !== String(currentImageId);
      if (isNewSession) {
        setActiveTab('details');
        previousImageIdRef.current = currentImageId ?? null;
      } else if (imageChanged) {
        previousImageIdRef.current = currentImageId ?? null;
      }
    } else if (!isOpen) {
      previousImageIdRef.current = null;
    }
  }, [isOpen, image]);

  useEffect(() => {
    if (isOpen) {
      const closeButton = document.querySelector('[aria-label="Close modal"]') as HTMLButtonElement;
      if (closeButton) closeButton.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (onApprove) await onApprove(String(image.id));
    else handleAction('approve');
  };
  const handleRetry = async () => {
    if (onRetry) await onRetry(String(image.id));
    else handleAction('retry');
  };
  const handleDelete = async () => {
    if (onDelete) await onDelete(String(image.id));
    else handleAction('delete');
  };

  return (
    <div
      data-testid="failed-image-review-modal"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <FailedImageReviewModalHeader
          image={image}
          showHelp={showHelp}
          onToggleHelp={() => setShowHelp((v) => !v)}
          onApprove={handleApprove}
          onRetry={handleRetry}
          onDelete={handleDelete}
          onPrevious={onPrevious}
          onNext={onNext}
          onClose={onClose}
        />

        <div data-testid="modal-content" className="flex flex-row h-[calc(90vh-80px)] overflow-hidden">
          <FailedImageReviewModalImageView
            image={image}
            containerRef={zoomPan.containerRef}
            imgRef={zoomPan.imgRef}
            scale={zoomPan.scale}
            translate={zoomPan.translate}
            isPanning={zoomPan.isPanning}
            fitToContainer={zoomPan.fitToContainer}
            zoomBy={zoomPan.zoomBy}
            handleWheel={zoomPan.handleWheel}
            startPan={zoomPan.startPan}
            onPanMove={zoomPan.onPanMove}
            endPan={zoomPan.endPan}
            setScale={zoomPan.setScale}
            setTranslate={zoomPan.setTranslate}
          />

          <FailedImageReviewModalTabsContent
            image={image}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            processingSettings={processingSettings}
          />
        </div>
      </div>
    </div>
  );
};

export default FailedImageReviewModal;
