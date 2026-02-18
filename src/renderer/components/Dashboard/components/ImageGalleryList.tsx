/**
 * Story 3.4 Phase 5c.3: List (table) view for ImageGallery.
 */
import React from 'react';
import { buildLocalFileUrl } from '../../../utils/urls';
import { parseImageGalleryMetadata } from '../hooks/useImageGalleryFilteredImages';
import type { ImageGalleryImage } from '../hooks/useImageGalleryFilteredImages';

const LIST_PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAyNEg0MFY0MEgyNFYyNFoiIGZpbGw9IiNEMUQ1REIiLz4KPC9zdmc+';

interface ImageGalleryListProps {
  images: ImageGalleryImage[];
  selectedImages: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  jobIdToLabel: Record<string, string>;
  onOpenModal: (image: ImageGalleryImage) => void;
  onImageAction: (action: string, imageId: string, data?: unknown) => void;
  formatDate: (date: Date) => string;
}

const ImageGalleryList: React.FC<ImageGalleryListProps> = ({
  images,
  selectedImages,
  onSelectionChange,
  jobIdToLabel,
  onOpenModal,
  onImageAction,
  formatDate,
}) => (
  <div className="p-4">
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
          <div className="col-span-1">
            <input
              type="checkbox"
              checked={selectedImages.size === images.length && images.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  onSelectionChange(new Set(images.map((img) => img.id)));
                } else {
                  onSelectionChange(new Set());
                }
              }}
              className="rounded border-gray-300"
            />
          </div>
          <div className="col-span-2">Image</div>
          <div className="col-span-2">Title</div>
          <div className="col-span-3">Prompt</div>
          <div className="col-span-1">Seed</div>
          <div className="col-span-1">Date</div>
          <div className="col-span-2">Actions</div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {images.map((image) => {
          const meta = parseImageGalleryMetadata(image.metadata);
          const title = (meta?.title && typeof meta.title === 'object' ? (meta.title as { en?: string }).en : meta?.title) || '';
          const safeTitle = typeof title === 'string' && title.trim() ? title : '';
          const displayTitle = safeTitle || image.generationPrompt || 'Untitled';
          const thumbAlt = typeof displayTitle === 'string' ? displayTitle : 'Generated Image';
          const jobLabel = jobIdToLabel[String(image.executionId)] || `Job ${String(image.executionId)}`;

          return (
            <div
              key={image.id}
              className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
                selectedImages.has(image.id) ? 'bg-blue-50' : ''
              }`}
            >
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedImages.has(image.id)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedImages);
                    if (e.target.checked) {
                      newSelected.add(image.id);
                    } else {
                      newSelected.delete(image.id);
                    }
                    onSelectionChange(newSelected);
                  }}
                  className="rounded border-gray-300"
                />
              </div>

              <div className="col-span-2">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={(image.finalImagePath || image.tempImagePath) ? buildLocalFileUrl(image.finalImagePath || image.tempImagePath!) : ''}
                    alt={thumbAlt}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => onOpenModal(image)}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = LIST_PLACEHOLDER_SVG;
                    }}
                  />
                </div>
              </div>

              <div className="col-span-2 flex items-center">
                <div className="text-sm font-medium text-gray-900 line-clamp-2" title={displayTitle}>
                  {displayTitle}
                </div>
              </div>

              <div className="col-span-3 flex items-center">
                <div className="text-sm text-gray-700 truncate" title={jobLabel}>
                  {jobLabel}
                </div>
              </div>

              <div className="col-span-1 flex items-center">
                <div className="text-sm font-mono text-gray-500" title={`Seed: ${image.seed}`}>
                  {image.seed}
                </div>
              </div>

              <div className="col-span-1 flex items-center">
                <div className="text-sm text-gray-500" title={image.createdAt ? formatDate(new Date(image.createdAt as string | Date)) : ''}>
                  {image.createdAt ? new Date(image.createdAt as string | Date).toLocaleDateString() : ''}
                </div>
              </div>

              <div className="col-span-2 flex items-center space-x-2">
                <button
                  onClick={() => onOpenModal(image)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="View full size"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => onImageAction('delete', image.id)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default ImageGalleryList;
