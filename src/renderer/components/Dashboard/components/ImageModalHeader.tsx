/**
 * Story 3.4 Phase 5c: ImageModal header (title, badge, delete, help, prev/next, close).
 * Extracted from ImageModal.tsx.
 */
import React from 'react';
import StatusBadge from '../../Common/StatusBadge';

export interface ImageModalHeaderProps {
  qcStatus?: string | null;
  onClose: () => void;
  onDelete?: (imageId: string) => void;
  imageId?: string;
  showHelp: boolean;
  onToggleHelp: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

const ImageModalHeader: React.FC<ImageModalHeaderProps> = ({
  qcStatus,
  onClose,
  onDelete,
  imageId,
  showHelp,
  onToggleHelp,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}) => (
  <>
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      <div className="flex items-center space-x-3">
        <h2 className="text-xl font-semibold text-gray-900">Image Details</h2>
        <StatusBadge variant="qc" status={qcStatus || 'approved'} />
      </div>
      <div className="flex items-center space-x-2">
        {imageId && onDelete && (
          <button
            type="button"
            onClick={async () => await onDelete(imageId)}
            className="review-modal-button bg-red-600 text-white hover:bg-red-700"
            aria-label="Delete image permanently"
            title="Delete image permanently"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onToggleHelp}
          className="px-2 py-1 text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded"
          aria-label="Image Control Info"
          title="Image Control Info"
        >
          Image Control Info
        </button>
        {(hasPrevious || hasNext) && (
          <div className="flex items-center space-x-1">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className={`p-2 rounded-md transition-colors ${hasPrevious ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
              aria-label="Previous image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className={`p-2 rounded-md transition-colors ${hasNext ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
              aria-label="Next image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    {showHelp && (
      <div className="absolute top-14 right-4 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs text-gray-700 z-20">
        <div className="flex items-start justify-between mb-2">
          <div className="font-medium text-gray-900">Image viewer controls</div>
          <button type="button" className="p-1 text-gray-500 hover:text-gray-700" onClick={onToggleHelp} aria-label="Close help">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <ul className="space-y-1 list-disc pl-4">
          <li><span className="font-medium">Pan</span>: Click and drag on the image</li>
          <li><span className="font-medium">Zoom</span>: Ctrl (Windows/Linux) or ⌘ Cmd (macOS) + mouse wheel</li>
          <li><span className="font-medium">Fit</span>: Double‑click image</li>
          <li><span className="font-medium">Toolbar (bottom‑right)</span>: Zoom out (−), Zoom in (+), Reset, Fit to screen</li>
        </ul>
      </div>
    )}
  </>
);

export default ImageModalHeader;
