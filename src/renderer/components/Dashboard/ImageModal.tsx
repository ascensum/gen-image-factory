/**
 * Story 3.4 Phase 5c: ImageModal – container composing hooks and extracted components.
 * Kept < 400 lines; zoom/pan in useImageModalZoomPan, processing in useImageModalProcessing,
 * header/tabs/image view in Dashboard/components.
 */
import React, { useState, useEffect } from 'react';
import './FailedImageReviewModal.css';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';
import { useImageModalZoomPan } from './hooks/useImageModalZoomPan';
import { useImageModalProcessing } from './hooks/useImageModalProcessing';
import ImageModalHeader from './components/ImageModalHeader';
import ImageModalTabsContent, { type ImageModalTabType, type ImageModalMetadataMeta } from './components/ImageModalTabsContent';
import ImageModalImageView from './components/ImageModalImageView';

interface ImageModalProps {
  image: GeneratedImage | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onDelete?: (imageId: string) => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  image,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<ImageModalTabType>('details');
  const [showHelp, setShowHelp] = useState(false);

  const zoomPan = useImageModalZoomPan({ isOpen, imageId: image?.id ?? null });
  const processingSettings = useImageModalProcessing({
    imageId: image?.id ?? null,
    imageProcessingSettings: (image as { processingSettings?: unknown })?.processingSettings,
    isOpen,
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && image) {
      setActiveTab('details');
      zoomPan.resetZoomPan();
    }
  }, [isOpen, image]);

  if (!isOpen) return null;

  if (!image) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} aria-hidden="true" />
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-semibold text-gray-900">Image Details</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors" aria-label="Close modal">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center p-10">
              <div className="flex items-center gap-3 text-gray-600">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364 6.364-2.121-2.121M8.757 8.757 6.636 6.636m10.728 0-2.121 2.121M8.757 15.243 6.636 17.364"/></svg>
                <span className="text-sm">Loading image…</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | Date) => new Date(date).toLocaleString();

  let metadata: ImageModalMetadataMeta = {};
  if (typeof image.metadata === 'string') {
    try {
      metadata = JSON.parse(image.metadata) as ImageModalMetadataMeta;
    } catch {
      metadata = {};
    }
  } else if (image.metadata) {
    metadata = image.metadata as ImageModalMetadataMeta;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          <ImageModalHeader
            qcStatus={image.qcStatus}
            onClose={onClose}
            onDelete={onDelete}
            imageId={image.id}
            showHelp={showHelp}
            onToggleHelp={() => setShowHelp(v => !v)}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onPrevious={onPrevious}
            onNext={onNext}
          />
          <div className="flex flex-row h-[calc(90vh-80px)] overflow-hidden">
            <ImageModalImageView
              imagePath={image.finalImagePath || image.tempImagePath || ''}
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
            <ImageModalTabsContent
              image={image}
              metadata={metadata}
              processingSettings={processingSettings}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              formatDate={formatDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
