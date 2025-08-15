import React, { useState, useEffect } from 'react';
import { GeneratedImage } from './DashboardPanel';
import FailedImageCard from './FailedImageCard';
import FailedImageReviewModal from './FailedImageReviewModal';
import ProcessingSettingsModal from './ProcessingSettingsModal';

interface FailedImagesReviewPanelProps {
  onBack: () => void;
}

interface ProcessingSettings {
  imageEnhancement: boolean;
  sharpening: number;
  saturation: number;
  imageConvert: boolean;
  convertToJpg: boolean;
  jpgQuality: number;
  pngQuality: number;
  removeBg: boolean;
  removeBgSize: string;
  trimTransparentBackground: boolean;
  jpgBackground: string;
}

const FailedImagesReviewPanel: React.FC<FailedImagesReviewPanelProps> = ({ onBack }) => {
  const [failedImages, setFailedImages] = useState<GeneratedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedImageForReview, setSelectedImageForReview] = useState<GeneratedImage | null>(null);
  const [showProcessingSettingsModal, setShowProcessingSettingsModal] = useState(false);
  const [processingSettings, setProcessingSettings] = useState<ProcessingSettings>({
    imageEnhancement: false,
    sharpening: 0,
    saturation: 1,
    imageConvert: false,
    convertToJpg: true,
    jpgQuality: 90,
    pngQuality: 9,
    removeBg: false,
    removeBgSize: 'auto',
    trimTransparentBackground: false,
    jpgBackground: '#FFFFFF'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterJob, setFilterJob] = useState<string | number>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [retryQueueStatus, setRetryQueueStatus] = useState<{
    isProcessing: boolean;
    queueLength: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  }>({
    isProcessing: false,
    queueLength: 0,
    pendingJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0
  });

  // Load failed images on component mount
  useEffect(() => {
    loadFailedImages();
    loadRetryQueueStatus();
  }, []);

  // Load retry queue status
  const loadRetryQueueStatus = async () => {
    try {
      const result = await window.electronAPI.getRetryQueueStatus();
      if (result.success && result.queueStatus) {
        setRetryQueueStatus(result.queueStatus);
      }
    } catch (error) {
      console.error('Failed to load retry queue status:', error);
    }
  };

  const loadFailedImages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const images = await window.electronAPI.getImagesByQCStatus('failed');
      if (images && Array.isArray(images)) {
        setFailedImages(images);
      } else {
        setFailedImages([]);
      }
    } catch (error) {
      console.error('Failed to load failed images:', error);
      setError('Failed to load failed images');
      setFailedImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedImages.size === filteredAndSortedImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredAndSortedImages.map(img => img.id)));
    }
  };

  const handleImageAction = async (action: string, imageId: string, data?: any) => {
    try {
      setError(null);
      
      switch (action) {
        case 'approve':
          // Move image to main dashboard success view
          await window.electronAPI.updateQCStatus(imageId, 'approved');
          await loadFailedImages();
          break;
        case 'retry':
          // Add image to retry pool
          await window.electronAPI.updateQCStatus(imageId, 'retry_pending');
          await loadFailedImages();
          break;
        case 'delete':
          await window.electronAPI.deleteGeneratedImage(imageId);
          await loadFailedImages();
          break;
        case 'view':
          const image = failedImages.find(img => img.id === imageId);
          if (image) {
            setSelectedImageForReview(image);
          }
          break;
      }
    } catch (error) {
      setError(`Failed to ${action} image`);
      console.error(`Failed to ${action} image:`, error);
    }
  };

  const handleBulkAction = async (action: string, settings?: { useOriginalSettings: boolean }) => {
    if (selectedImages.size === 0) return;
    
    try {
      setError(null);
      
      switch (action) {
        case 'approve':
          // Bulk approve images
          for (const imageId of selectedImages) {
            await window.electronAPI.updateQCStatus(imageId, 'approved');
          }
          break;
        case 'retry':
          // Show processing settings modal for retry
          setShowProcessingSettingsModal(true);
          return; // Don't clear selection yet
        case 'delete':
          // Bulk delete images
          for (const imageId of selectedImages) {
            await window.electronAPI.deleteGeneratedImage(imageId);
          }
          break;
      }
      
      await loadFailedImages();
      setSelectedImages(new Set());
    } catch (error) {
      setError(`Failed to bulk ${action} images`);
      console.error(`Failed to bulk ${action} images:`, error);
    }
  };

  const handleRetryWithSettings = async (useOriginalSettings: boolean, modifiedSettings?: ProcessingSettings, includeMetadata?: boolean) => {
    if (selectedImages.size === 0) return;
    
    try {
      setError(null);
      
      // Process retry as a single batch with chosen settings
      const imageIds = Array.from(selectedImages);
      const result = await window.electronAPI.retryFailedImagesBatch(
        imageIds, 
        useOriginalSettings, 
        useOriginalSettings ? null : (modifiedSettings || processingSettings),
        includeMetadata
      );
      
      if (result.success) {
        await loadFailedImages();
        await loadRetryQueueStatus(); // Refresh queue status
        setSelectedImages(new Set());
        setShowProcessingSettingsModal(false);
      } else {
        setError(result.error || 'Failed to process retry operations');
      }
    } catch (error) {
      setError('Failed to process retry operations');
      console.error('Failed to process retry operations:', error);
    }
  };

  const filteredAndSortedImages = React.useMemo(() => {
    let filtered = failedImages.filter(image => {
      // Job filter
      if (filterJob !== 'all' && image.executionId !== filterJob) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPrompt = image.generationPrompt.toLowerCase().includes(query);
        const matchesMetadataPrompt = image.metadata?.prompt?.toLowerCase().includes(query);
        if (!matchesPrompt && !matchesMetadataPrompt) {
          return false;
        }
      }
      
      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return a.generationPrompt.localeCompare(b.generationPrompt);
        default:
          return 0;
      }
    });

    return sorted;
  }, [failedImages, filterJob, searchQuery, sortBy]);

  const uniqueJobIds = Array.from(new Set(failedImages.map(img => img.executionId)));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading failed images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Failed Images Review</h1>
              <p className="text-gray-600">
                Review and manage images that failed quality assurance checks
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">{failedImages.length}</div>
              <div className="text-sm text-gray-500">Failed Images</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-4">
            {/* Job Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Job:</span>
              <select
                value={filterJob}
                onChange={(e) => setFilterJob(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Jobs</option>
                {uniqueJobIds.length > 0 ? uniqueJobIds.map(jobId => (
                  <option key={jobId} value={jobId}>
                    Job {String(jobId).slice(0, 8)}...
                  </option>
                )) : (
                  <option value="all" disabled>No jobs available</option>
                )}
              </select>
            </div>

            {/* Search Field */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Search:</span>
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sort Control */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">By Name</option>
              </select>
            </div>
          </div>

          {/* Clear Button */}
          <button
            onClick={() => {
              setFilterJob('all');
              setSearchQuery('');
              setSortBy('newest');
              setSelectedImages(new Set());
            }}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedImages.size === filteredAndSortedImages.length && filteredAndSortedImages.length > 0}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Select All ({selectedImages.size}/{filteredAndSortedImages.length})
              </span>
            </div>

            {/* Queue Status Indicator */}
            {(retryQueueStatus.isProcessing || retryQueueStatus.queueLength > 0) && (
              <div className="mr-4 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-blue-800">
                    {retryQueueStatus.isProcessing ? 'Processing...' : 'Queued'}
                  </span>
                  {retryQueueStatus.queueLength > 0 && (
                    <span className="text-xs text-blue-600">
                      ({retryQueueStatus.queueLength} job{retryQueueStatus.queueLength !== 1 ? 's' : ''})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Bulk Actions (visible always, disabled when none selected) */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('approve')}
                disabled={selectedImages.size === 0}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${selectedImages.size === 0 ? 'bg-green-200 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                title={selectedImages.size === 0 ? 'Select images to enable' : 'Approve selected images'}
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction('retry')}
                disabled={selectedImages.size === 0 || retryQueueStatus.isProcessing}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedImages.size === 0 || retryQueueStatus.isProcessing 
                    ? 'bg-blue-200 text-white cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={
                  selectedImages.size === 0 
                    ? 'Select images to enable' 
                    : retryQueueStatus.isProcessing 
                    ? 'Retry is currently processing. Please wait for completion.'
                    : 'Retry selected images (batch)'
                }
              >
                Retry Selected
                {retryQueueStatus.isProcessing && (
                  <span className="ml-1">⏳</span>
                )}
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                disabled={selectedImages.size === 0}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${selectedImages.size === 0 ? 'bg-red-200 text-white cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                title={selectedImages.size === 0 ? 'Select images to enable' : 'Delete selected images'}
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Images Grid */}
      <div className="flex-1 p-6">
        {filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Failed Images</h3>
            <p className="text-gray-500">All images have passed quality checks or are pending review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredAndSortedImages.map((image) => (
              <FailedImageCard
                key={image.id}
                image={image}
                isSelected={selectedImages.has(image.id)}
                onSelect={() => handleImageSelect(image.id)}
                onAction={handleImageAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Image Review Modal */}
      {selectedImageForReview && (
        <FailedImageReviewModal
          image={selectedImageForReview}
          isOpen={!!selectedImageForReview}
          onClose={() => setSelectedImageForReview(null)}
          onAction={handleImageAction}
        />
      )}

      {/* Processing Settings Modal */}
      {showProcessingSettingsModal && (
        <ProcessingSettingsModal
          isOpen={showProcessingSettingsModal}
          onClose={() => setShowProcessingSettingsModal(false)}
          onRetry={handleRetryWithSettings}
          selectedCount={selectedImages.size}
        />
      )}
    </div>
  );
};

export default FailedImagesReviewPanel;
