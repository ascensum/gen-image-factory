import React from 'react';
import { GeneratedImage } from './DashboardPanel';
import StatusBadge from '../common/StatusBadge';

interface FailedImageCardProps {
  image: GeneratedImage;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: string, imageId: string) => void;
}

const FailedImageCard: React.FC<FailedImageCardProps> = ({
  image,
  isSelected,
  onSelect,
  onAction
}) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = () => (
    <div className="absolute top-2 left-2">
      <StatusBadge 
        variant="qc" 
        status={image.qcStatus}
        labelOverride={
          image.qcStatus === 'qc_failed' ? 'QC Failed' :
          image.qcStatus === 'retry_pending' ? 'Pending Retry' :
          image.qcStatus === 'processing' ? 'Processing Retry' :
          image.qcStatus === 'approved' ? 'Approved' :
          image.qcStatus === 'failed_retry' ? 'Failed Retry' :
          (image.qcStatus || '')
        }
      />
    </div>
  );

  return (
    <div 
      data-testid={`failed-image-card-${image.id}`}
      className="relative bg-white border rounded-lg overflow-hidden transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50"
    >
      {/* Selection Checkbox */}
      <div className="absolute top-2 right-2 z-10">
        <input
          data-testid={`select-${image.id}`}
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Image */}
      <div className="relative aspect-square">
        {(image.finalImagePath || image.tempImagePath) ? (
          <img 
            src={`local-file://${image.finalImagePath || image.tempImagePath || ''}`} 
            alt={`Failed image ${image.id}`}
            className="w-full h-32 object-cover rounded"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02NCAzMkM3Ny4yNTQ4IDMyIDg4IDQyLjc0NTIgODggNTZDODggNjkuMjU0OCA3Ny4yNTQ4IDgwIDY0IDgwQzUwLjc0NTIgODAgNDAgNjkuMjU0OCA0MCA1NkM0MCA0Mi43NDUyIDUwLjc0NTIgMzIgNjQgMzJaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0yNCA4OEgxMDRDMTEwLjYyNyA4OCAxMTYgOTMuMzcyNiAxMTYgMTAwVjExMkMxMTYgMTE4LjYyNyAxMTAuNjI3IDEyNCAxMDQgMTI0SDI0QzE3LjM3MjYgMTI0IDEyIDExOC42MjcgMTIgMTEyVjEwMEMxMiA5My4zNzI2IDE3LjM3MjYgODggMjQgODhaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Status Badge */}
        {getStatusBadge()}
      </div>

      {/* Image Info */}
      <div className="p-3">
        {/* Generation Prompt */}
        <div className="text-xs text-gray-600 truncate mb-2" title={image.generationPrompt}>
          {image.generationPrompt}
        </div>

        {/* Failure Reason */}
        {image.qcReason && (
          <div className="text-xs text-red-600 mb-2 p-2 bg-red-50 rounded border border-red-200">
            <strong>Failure:</strong> {image.qcReason}
          </div>
        )}

        {/* Seed and Creation Date */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <div className="flex items-center space-x-2">
            {image.seed && (
              <span className="font-mono" title={`Seed: ${image.seed}`}>
                🎲 {image.seed}
              </span>
            )}
          </div>
          <div title={formatDate(image.createdAt)}>
            {formatDate(image.createdAt)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAction('approve', image.id)}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            title="Approve image (move to success)"
          >
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </span>
          </button>
          <button
            onClick={() => onAction('retry', image.id)}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Add to retry selection bucket"
          >
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Add To Retry
            </span>
          </button>
          <button
            onClick={() => onAction('view', image.id)}
            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title="View full image details"
          >
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </span>
          </button>
          <button
            onClick={() => onAction('delete', image.id)}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            title="Delete image permanently"
          >
            <span className="inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FailedImageCard;
