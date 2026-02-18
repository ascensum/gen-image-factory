/**
 * Story 3.4 Phase 5c.4: Header and help popover for FailedImageReviewModal.
 */
import React from 'react';
import StatusBadge from '../../Common/StatusBadge';
import { formatQcLabel } from '../../../utils/qc';
import type { GeneratedImage } from '../../../../types/generatedImage';

interface FailedImageReviewModalHeaderProps {
  image: GeneratedImage;
  showHelp: boolean;
  onToggleHelp: () => void;
  onApprove: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

const FailedImageReviewModalHeader: React.FC<FailedImageReviewModalHeaderProps> = ({
  image,
  showHelp,
  onToggleHelp,
  onApprove,
  onRetry,
  onDelete,
  onPrevious,
  onNext,
  onClose,
}) => {
  const qcStatus = String((image as { qcStatus?: string })?.qcStatus ?? '').toLowerCase();
  const status = (qcStatus === 'approved' || qcStatus === 'complete' || qcStatus === 'completed')
    ? 'approved'
    : qcStatus === 'processing'
      ? 'processing'
      : 'qc_failed';
  const labelOverride = formatQcLabel(
    (image as { qcStatus?: string })?.qcStatus,
    (image as { qcReason?: string })?.qcReason
  );

  return (
    <>
      <div data-testid="modal-header" className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Image Details</h2>
          <div className="inline-flex items-center">
            <StatusBadge variant="qc" status={status} labelOverride={labelOverride} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onApprove}
            className="review-modal-button bg-green-600 text-white hover:bg-green-700"
            title="Approve image (move to success)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Approve
          </button>
          <button
            onClick={onRetry}
            className="review-modal-button bg-blue-600 text-white hover:bg-blue-700"
            title="Add image to retry pool"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" />
            </svg>
            Add to Retry
          </button>
          <button
            onClick={onDelete}
            className="review-modal-button bg-red-600 text-white hover:bg-red-700"
            title="Delete image permanently"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
          <button
            type="button"
            onClick={onToggleHelp}
            className="px-2 py-1 text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded"
            aria-label="Image Control Info"
            title="Image Control Info"
          >
            Image Control Info
          </button>
          <div className="flex items-center space-x-1">
            <button onClick={onPrevious} className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100" aria-label="Previous image">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={onNext} className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100" aria-label="Next image">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Close modal">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="absolute top-14 right-4 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs text-gray-700 z-20">
          <div className="flex items-start justify-between mb-2">
            <div className="font-medium text-gray-900">Image viewer controls</div>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-700"
              onClick={onToggleHelp}
              aria-label="Close help"
            >
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
};

export default FailedImageReviewModalHeader;
