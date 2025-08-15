import React from 'react';
import { GeneratedImage } from './DashboardPanel';

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

  const getFailureIndicator = () => {
    if (image.qcReason) {
      return (
        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
          ⚠️ Failed
        </div>
      );
    }
    return null;
  };

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
        {image.finalImagePath ? (
          <img
            src={`file://${image.finalImagePath}`}
            alt={image.generationPrompt}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback for broken images
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo=';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Failure Indicator */}
        {getFailureIndicator()}
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
            title="Add to retry pool"
          >
            🔄 Retry
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
