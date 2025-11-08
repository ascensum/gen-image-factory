import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import FailedImageReviewModal from './FailedImageReviewModal';
import type { GeneratedImage } from '../../../types/generatedImage';

interface FailedImageModalContainerProps {
  selectedImage: GeneratedImage | null;
  allImages: GeneratedImage[];
  onClose: () => void;
  onAction: (action: string, imageId: string) => Promise<void>;
  onApprove: (imageId: string) => Promise<void>;
  onRetry: (imageId: string) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
  onPreviousImage: (currentImage: GeneratedImage) => void;
  onNextImage: (currentImage: GeneratedImage) => void;
  hasPrevious: (currentImage: GeneratedImage) => boolean;
  hasNext: (currentImage: GeneratedImage) => boolean;
}

/**
 * Container component for FailedImageReviewModal
 * Uses React Portal to render modal outside parent component tree
 * This prevents modal from unmounting when parent re-renders
 */
const FailedImageModalContainer: React.FC<FailedImageModalContainerProps> = ({
  selectedImage,
  allImages,
  onClose,
  onAction,
  onApprove,
  onRetry,
  onDelete,
  onPreviousImage,
  onNextImage,
  hasPrevious,
  hasNext,
}) => {
  const [modalImageCache, setModalImageCache] = useState<GeneratedImage | null>(null);
  const deletingImageRef = useRef<boolean>(false);
  const modalLockedRef = useRef<boolean>(false);

  // Use cached image or find in current list (type-safe comparison)
  const modalImage = selectedImage 
    ? (modalImageCache || allImages.find(img => String(img.id) === String(selectedImage.id)))
    : null;

  // If no image found and not deleting, close modal
  if (!modalImage && !deletingImageRef.current && selectedImage) {
    setTimeout(() => {
      if (!deletingImageRef.current) {
        onClose();
      }
    }, 0);
  }

  const handleClose = () => {
    // Don't allow closing during delete operation
    if (deletingImageRef.current || modalLockedRef.current) {
      return;
    }
    onClose();
  };

  const handleApprove = async (imageId: string) => {
    deletingImageRef.current = true;
    modalLockedRef.current = true;

    try {
      // Call parent's approve handler which manages navigation
      await onApprove(imageId);
      
      // Clear cache after approve to pick up fresh data
      setTimeout(() => {
        setModalImageCache(null);
      }, 200);
    } finally {
      deletingImageRef.current = false;
      modalLockedRef.current = false;
    }
  };

  const handleRetry = async (imageId: string) => {
    deletingImageRef.current = true;
    modalLockedRef.current = true;

    try {
      // Call parent's retry handler which manages navigation
      await onRetry(imageId);
      
      // Clear cache after retry to pick up fresh data
      setTimeout(() => {
        setModalImageCache(null);
      }, 200);
    } finally {
      deletingImageRef.current = false;
      modalLockedRef.current = false;
    }
  };

  const handleDelete = async (imageId: string) => {
    deletingImageRef.current = true;
    modalLockedRef.current = true;

    try {
      // Call parent's delete handler which manages navigation and refresh
      await onDelete(imageId);
      
      // Clear cache after delete to pick up fresh data
      setTimeout(() => {
        setModalImageCache(null);
      }, 200);
    } finally {
      deletingImageRef.current = false;
      modalLockedRef.current = false;
    }
  };

  const handlePrevious = selectedImage && hasPrevious(selectedImage) ? () => {
    setModalImageCache(null);
    onPreviousImage(selectedImage);
  } : undefined;

  const handleNext = selectedImage && hasNext(selectedImage) ? () => {
    setModalImageCache(null);
    onNextImage(selectedImage);
  } : undefined;

  // Always render modal to keep it mounted, control visibility with isOpen
  const displayImage = (modalImage || selectedImage || { id: '', filePath: '', prompt: '', qcStatus: 'qc_failed' as const }) as GeneratedImage;
  const isOpen = !!selectedImage;

  // Render modal using portal to keep it outside parent's tree
  // This ensures it survives parent unmount/remount cycles
  return ReactDOM.createPortal(
    <FailedImageReviewModal
      image={displayImage}
      isOpen={isOpen}
      onClose={handleClose}
      onAction={onAction}
      onApprove={handleApprove}
      onRetry={handleRetry}
      onPrevious={handlePrevious}
      onNext={handleNext}
      hasPrevious={selectedImage ? hasPrevious(selectedImage) : false}
      hasNext={selectedImage ? hasNext(selectedImage) : false}
      onDelete={handleDelete}
    />,
    document.body
  );
};

FailedImageModalContainer.displayName = 'FailedImageModalContainer';

export default FailedImageModalContainer;

