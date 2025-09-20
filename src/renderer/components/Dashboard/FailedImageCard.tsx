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
      <StatusBadge variant="qc" status={image.qcStatus} />
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
            ✓ Approve
          </button>
          <button
            onClick={() => onAction('retry', image.id)}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Add to retry selection bucket"
          >
            🔄 Add To Retry
          </button>
          <button
            onClick={() => onAction('view', image.id)}
            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            title="View full image details"
          >
            👁 View
          </button>
          <button
            onClick={() => onAction('delete', image.id)}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            title="Delete image permanently"
          >
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default FailedImageCard;
