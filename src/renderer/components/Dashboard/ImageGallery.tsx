/**
 * Story 3.4 Phase 5c.3: ImageGallery container – composes useImageGalleryFilteredImages
 * and ImageGalleryEmptyState, ImageGalleryGrid, ImageGalleryList. Kept < 400 lines.
 */
import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../types/generatedImage';
import ImageModal from './ImageModal';
import { useImageGalleryFilteredImages } from './hooks/useImageGalleryFilteredImages';
import ImageGalleryEmptyState from './components/ImageGalleryEmptyState';
import ImageGalleryGrid from './components/ImageGalleryGrid';
import ImageGalleryList from './components/ImageGalleryList';

interface ImageGalleryProps {
  images: GeneratedImage[];
  onImageAction: (action: string, imageId: string, data?: unknown) => void;
  onBulkAction?: (action: string, imageIds: string[]) => void;
  isLoading: boolean;
  jobStatus?: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  jobFilter?: string;
  searchQuery?: string;
  sortBy?: 'newest' | 'oldest' | 'name';
  jobIdToLabel?: Record<string, string>;
  dateFrom?: string | null;
  dateTo?: string | null;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onClearFilters?: () => void;
  /** For virtualized grid: container size so grid can fill and scroll internally */
  containerWidth?: number;
  containerHeight?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onImageAction,
  onBulkAction: _onBulkAction,
  isLoading,
  jobStatus: _jobStatus = 'idle',
  viewMode = 'grid',
  onViewModeChange: _onViewModeChange,
  jobFilter = 'all',
  searchQuery = '',
  sortBy = 'newest',
  jobIdToLabel = {},
  dateFrom = null,
  dateTo = null,
  selectedIds,
  onSelectionChange,
  onClearFilters,
  containerWidth = 0,
  containerHeight = 0,
  onLoadMore,
  hasMore = false,
}) => {
  if (!images || !Array.isArray(images)) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          {isLoading ? 'Loading images...' : 'No images available'}
        </div>
      </div>
    );
  }

  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const selectedImages: Set<string> = selectedIds ?? internalSelected;
  const updateSelected = (next: Set<string>) => {
    if (onSelectionChange) onSelectionChange(next);
    else setInternalSelected(next);
  };

  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [modalImageCache, setModalImageCache] = useState<GeneratedImage | null>(null);
  const deletingImageRef = React.useRef<boolean>(false);
  const modalLockedRef = React.useRef<boolean>(false);

  const filteredAndSortedImages = useImageGalleryFilteredImages({
    images,
    jobFilter,
    searchQuery,
    sortBy,
    dateFrom,
    dateTo,
  });

  useEffect(() => {
    updateSelected(new Set());
  }, [jobFilter]);

  const handleImageSelect = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) newSelected.delete(imageId);
    else newSelected.add(imageId);
    updateSelected(newSelected);
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();

  const handleModalNavigation = (direction: 'next' | 'previous') => {
    if (!showImageModal) return;
    const currentIndex = filteredAndSortedImages.findIndex((img) => String(img.id) === String(showImageModal));
    if (currentIndex === -1) return;
    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex + 1 < filteredAndSortedImages.length ? currentIndex + 1 : currentIndex;
    } else {
      newIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : currentIndex;
    }
    const nextImage = filteredAndSortedImages[newIndex];
    setModalImageCache(null);
    setShowImageModal(nextImage?.id ?? null);
  };

  const getModalNavigationProps = () => {
    if (!showImageModal) return { hasPrevious: false, hasNext: false };
    const currentIndex = filteredAndSortedImages.findIndex((img) => String(img.id) === String(showImageModal));
    return {
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex < filteredAndSortedImages.length - 1,
    };
  };

  const handleOpenModal = (image: GeneratedImage) => {
    setModalImageCache(image);
    setShowImageModal(image.id);
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* No inner scroll: parent (DashboardView wrapper) is the single scroll container */}
      {filteredAndSortedImages.length === 0 ? (
        <ImageGalleryEmptyState onClearFilters={onClearFilters} />
      ) : viewMode === 'grid' ? (
        <ImageGalleryGrid
            images={filteredAndSortedImages}
            selectedImages={selectedImages}
            onImageSelect={handleImageSelect}
            jobIdToLabel={jobIdToLabel}
            onOpenModal={handleOpenModal}
            onImageAction={onImageAction}
            formatDate={formatDate}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
          />
      ) : (
        <ImageGalleryList
          images={filteredAndSortedImages}
          selectedImages={selectedImages}
          onSelectionChange={updateSelected}
          jobIdToLabel={jobIdToLabel}
          onOpenModal={handleOpenModal}
          onImageAction={onImageAction}
          formatDate={formatDate}
        />
      )}

      {showImageModal &&
        (() => {
          const modalImage =
            modalImageCache ||
            filteredAndSortedImages.find((img) => String(img.id) === String(showImageModal));

          if (!modalImage && !deletingImageRef.current) {
            setTimeout(() => {
              if (!deletingImageRef.current) {
                setShowImageModal(null);
                setModalImageCache(null);
              }
            }, 0);
            return null;
          }

          return (
            <ImageModal
              image={modalImage ?? null}
              isOpen={true}
              onClose={() => {
                if (deletingImageRef.current || modalLockedRef.current) return;
                setShowImageModal(null);
                setModalImageCache(null);
                deletingImageRef.current = false;
                modalLockedRef.current = false;
              }}
              onNext={() => handleModalNavigation('next')}
              onPrevious={() => handleModalNavigation('previous')}
              {...getModalNavigationProps()}
              onDelete={async (id) => {
                deletingImageRef.current = true;
                modalLockedRef.current = true;
                const currentIndex = filteredAndSortedImages.findIndex((img) => String(img.id) === String(id));
                let nextId: string | null = null;
                let nextImage: GeneratedImage | null = null;
                if (currentIndex >= 0) {
                  if (currentIndex < filteredAndSortedImages.length - 1) {
                    nextImage = filteredAndSortedImages[currentIndex + 1];
                    nextId = nextImage.id;
                  } else if (currentIndex > 0) {
                    nextImage = filteredAndSortedImages[currentIndex - 1];
                    nextId = nextImage.id;
                  }
                }
                if (nextId != null && nextImage != null) {
                  const next = nextImage;
                  flushSync(() => {
                    setModalImageCache(next);
                    setShowImageModal(nextId);
                  });
                  try {
                    await window.electronAPI.jobManagement.deleteGeneratedImage(id);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    setTimeout(() => onImageAction('delete', id), 50);
                  } catch (error) {
                    console.error('Failed to delete image:', error);
                  } finally {
                    deletingImageRef.current = false;
                    modalLockedRef.current = false;
                  }
                } else {
                  flushSync(() => {
                    setShowImageModal(null);
                    setModalImageCache(null);
                  });
                  try {
                    await onImageAction('delete', id);
                  } finally {
                    deletingImageRef.current = false;
                    modalLockedRef.current = false;
                  }
                }
              }}
            />
          );
        })()}
    </div>
  );
};

export default ImageGallery;
