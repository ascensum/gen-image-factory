import React, { useState, useEffect } from 'react';
import { GeneratedImage } from './DashboardPanel';

// Modal tab configuration
type TabType = 'details' | 'metadata' | 'processing';

const TAB_CONFIG: Record<TabType, { label: string; id: TabType }> = {
  details: { label: 'Details', id: 'details' },
  metadata: { label: 'AI Metadata', id: 'metadata' },
  processing: { label: 'Processing', id: 'processing' }
};

interface ImageModalProps {
  image: GeneratedImage | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({
  image,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset to details tab when new image opens
  useEffect(() => {
    if (isOpen && image) {
      setActiveTab('details');
    }
  }, [isOpen, image]);

  if (!isOpen || !image) {
    return null;
  }

  const getQCStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  const processingSettings = image.processingSettings || {};
  const metadata = image.metadata || {};
  
  // Debug logging for metadata
  console.log('ImageModal - Full image object:', JSON.stringify(image, null, 2));
  console.log('ImageModal - Raw metadata field:', image.metadata);
  console.log('ImageModal - Metadata type:', typeof image.metadata);
  console.log('ImageModal - Metadata keys:', image.metadata ? Object.keys(image.metadata) : 'null');
  console.log('ImageModal - Processed metadata:', metadata);
  console.log('ImageModal - Title from metadata:', metadata.title);
  console.log('ImageModal - Description from metadata:', metadata.description);
  console.log('ImageModal - Tags from metadata:', metadata.tags);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900">Image Details</h2>
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getQCStatusColor(image.qcStatus)}`}>
                {image.qcStatus || 'pending'}
              </div>
            </div>
            
            {/* Navigation and Close */}
            <div className="flex items-center space-x-2">
              {/* Previous/Next Navigation */}
              {(hasPrevious || hasNext) && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onPrevious}
                    disabled={!hasPrevious}
                    className={`p-2 rounded-md transition-colors ${
                      hasPrevious 
                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                    aria-label="Previous image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={onNext}
                    disabled={!hasNext}
                    className={`p-2 rounded-md transition-colors ${
                      hasNext 
                        ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                    aria-label="Next image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Close Button */}
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

          {/* Modal Content */}
          <div className="flex flex-col lg:flex-row max-h-[calc(90vh-80px)]">
            
            {/* Image Display - Left Side */}
            <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
              <div className="max-w-full max-h-full">
                <img 
                  src={`local-file://${image.finalImagePath}`} 
                  alt="Generated image"
                  className="w-full h-auto max-h-96 object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCA1MEgxNTBWNzVINzVWMTI1SDUwVjUwWiIgZmlsbD0iI0QxRDVEM0EiLz4KPHN2ZyB4PSI3NSIgeT0iODAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI0NSIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTkgM0g1QzMuOSAzIDMgMy45IDMgNVYxOUMzIDIwLjEgMy45IDIxIDUgMjFIMTlDMjAuMSAyMSAyMSAyMC4xIDIxIDE5VjVDMjEgMy45IDIwLjEgMyAxOSAzWk0xOSAxOUg1VjVIMTlWMTlaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0xNCAxM0gxMFYxN0gxNFYxM1oiIGZpbGw9IiM5QjlCQTAiLz4KPC9zdmc+Cjwvc3ZnPgo=';
                  }}
                />
              </div>
            </div>

            {/* Metadata Panel - Right Side */}
            <div className="w-full lg:w-96 border-l border-gray-200 flex flex-col">
              
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200">
                {Object.values(TAB_CONFIG).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image ID</label>
                      <p className="text-sm text-gray-900 font-mono">{image.id}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Execution</label>
                      <p className="text-sm text-gray-900 font-mono">{image.executionId}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Generation Prompt</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">{image.generationPrompt}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seed</label>
                      <p className="text-sm text-gray-900 font-mono">{image.seed || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">QC Status</label>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getQCStatusColor(image.qcStatus)}`}>
                          {image.qcStatus || 'pending'}
                        </span>
                        {image.qcReason && (
                          <span className="text-sm text-gray-600">- {image.qcReason}</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                      <p className="text-sm text-gray-900">{formatDate(image.createdAt)}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                      <p className="text-sm text-gray-900 font-mono break-all">{image.finalImagePath}</p>
                    </div>
                  </div>
                )}

                {/* AI Metadata Tab */}
                {activeTab === 'metadata' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Title</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">
                        {metadata.title || 'No title generated'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Description</label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">
                        {metadata.description || 'No description generated'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">AI-Generated Tags</label>
                      <div className="bg-gray-50 p-3 rounded-md border">
                        {Array.isArray(metadata.tags) && metadata.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {metadata.tags.map((tag: string, index: number) => (
                              <span 
                                key={index}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No tags generated</p>
                        )}
                      </div>
                    </div>
                    
                    {metadata.prompt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Metadata Prompt</label>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md border">{metadata.prompt}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Processing Settings Tab */}
                {activeTab === 'processing' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image Enhancement</label>
                        <p className="text-sm text-gray-900">{processingSettings.imageEnhancement ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sharpening</label>
                        <p className="text-sm text-gray-900">{processingSettings.sharpening || 0}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Saturation</label>
                        <p className="text-sm text-gray-900">{processingSettings.saturation || 1}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image Convert</label>
                        <p className="text-sm text-gray-900">{processingSettings.imageConvert ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Convert to JPG</label>
                        <p className="text-sm text-gray-900">{processingSettings.convertToJpg ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">JPG Quality</label>
                        <p className="text-sm text-gray-900">{processingSettings.jpgQuality || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PNG Quality</label>
                        <p className="text-sm text-gray-900">{processingSettings.pngQuality || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remove Background</label>
                        <p className="text-sm text-gray-900">{processingSettings.removeBg ? 'Yes' : 'No'}</p>
                      </div>
                      
                      {processingSettings.removeBg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Remove BG Size</label>
                          <p className="text-sm text-gray-900">{processingSettings.removeBgSize || 'N/A'}</p>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trim Transparent</label>
                        <p className="text-sm text-gray-900">{processingSettings.trimTransparentBackground ? 'Yes' : 'No'}</p>
                      </div>
                      
                      {processingSettings.convertToJpg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">JPG Background</label>
                          <p className="text-sm text-gray-900">{processingSettings.jpgBackground || 'N/A'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
