import React from 'react';
import StatusBadge from '../common/StatusBadge';
import { GeneratedImage } from './DashboardPanel';

interface FailedImageReviewModalProps {
  image: GeneratedImage;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, imageId: string) => void;
}

const FailedImageReviewModal: React.FC<FailedImageReviewModalProps> = ({
  image,
  isOpen,
  onClose,
  onAction
}) => {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const handleAction = (action: string) => {
    onAction(action, image.id);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Focus management
  React.useEffect(() => {
    if (isOpen) {
      const closeButton = document.querySelector('[aria-label="Close modal"]') as HTMLButtonElement;
      if (closeButton) {
        closeButton.focus();
      }
    }
  }, [isOpen]);

  return (
    <div 
      data-testid="failed-image-review-modal"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div 
          data-testid="modal-header"
          className="flex items-center justify-between p-6 border-b border-gray-200"
        >
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Failed Image Review</h2>
            <p className="text-sm text-gray-600">Review and manage failed image</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div 
          data-testid="modal-content"
          className="flex flex-col lg:flex-row h-full overflow-hidden"
        >
          {/* Left Panel - Image Display */}
          <div className="lg:w-2/3 p-6 bg-gray-50">
            <div 
              data-testid="image-container"
              className="relative"
            >
              {(image.finalImagePath || image.tempImagePath) ? (
                <img 
                  src={`local-file://${image.finalImagePath || image.tempImagePath || ''}`} 
                  alt="Failed image"
                  className="w-full h-auto max-h-96 object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo=';
                  }}
                />
              ) : (
              <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                <span className="sr-only">No Image Available</span>
                </div>
              )}

              {/* Failure Overlay */}
              <div className="absolute top-4 left-4">
                <StatusBadge variant="qc" status="qc_failed" />
              </div>
            </div>
          </div>

          {/* Right Panel - Details and Actions */}
          <div className="lg:w-1/3 p-6 overflow-y-auto">
            {/* Failure Analysis */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Failure Analysis</h3>
              {image.qcReason ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Failure Reason</h4>
                      <p className="text-sm text-red-700 mt-1">{image.qcReason}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">No Specific Reason</h4>
                      <p className="text-sm text-yellow-700 mt-1">Image failed quality check but no specific reason provided.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generation Details */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Generation Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Prompt</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">
                    {image.generationPrompt}
                  </p>
                </div>
                
                {image.seed && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Seed</label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border mt-1">
                      {image.seed}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">
                    {formatDate(image.createdAt)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Job ID</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">
                    {image.executionId}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Metadata */}
            {image.metadata && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Generated Metadata</h3>
                <div className="space-y-3">
                  {image.metadata.title && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Title</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">
                        {image.metadata.title}
                      </p>
                    </div>
                  )}
                  
                  {image.metadata.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Description</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border mt-1">
                        {image.metadata.description}
                      </p>
                    </div>
                  )}
                  
                  {image.metadata.tags && image.metadata.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tags</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {image.metadata.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Processing Settings */}
            {image.processingSettings && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Settings</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded border">
                    <span className="font-medium">Enhancement:</span> {image.processingSettings.imageEnhancement ? 'Yes' : 'No'}
                  </div>
                  <div className="bg-gray-50 p-2 rounded border">
                    <span className="font-medium">Sharpening:</span> {image.processingSettings.sharpening || 0}
                  </div>
                  <div className="bg-gray-50 p-2 rounded border">
                    <span className="font-medium">Saturation:</span> {image.processingSettings.saturation || 1}
                  </div>
                  <div className="bg-gray-50 p-2 rounded border">
                    <span className="font-medium">Remove BG:</span> {image.processingSettings.removeBg ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div 
              data-testid="modal-footer"
              className="flex justify-between items-center gap-4"
            >
              <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleAction('approve')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium inline-flex items-center gap-2"
                  title="Approve image (move to success)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Image
                </button>
                
                <button
                  onClick={() => handleAction('retry')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
                  title="Add image to retry pool"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Add to Retry Pool
                </button>
                
                <button
                  onClick={() => handleAction('delete')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium inline-flex items-center gap-2"
                  title="Delete image permanently"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Image
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FailedImageReviewModal;
