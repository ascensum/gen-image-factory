/**
 * Story 3.4 Phase 5c.3: Empty state for ImageGallery when no images match filters.
 */
import React from 'react';

interface ImageGalleryEmptyStateProps {
  onClearFilters?: () => void;
}

const ImageGalleryEmptyState: React.FC<ImageGalleryEmptyStateProps> = ({ onClearFilters }) => (
  <div className="text-center py-8 text-gray-500" aria-live="polite">
    <div>No images match the current filters.</div>
    {onClearFilters && (
      <button
        onClick={onClearFilters}
        className="mt-3 inline-flex items-center px-3 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
      >
        Clear filters
      </button>
    )}
  </div>
);

export default ImageGalleryEmptyState;
