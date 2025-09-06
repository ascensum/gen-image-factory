import React, { useState, useEffect } from 'react';
import { GeneratedImage } from './DashboardPanel';
import FailedImageCard from './FailedImageCard';
import FailedImageReviewModal from './FailedImageReviewModal';
import ProcessingSettingsModal from './ProcessingSettingsModal';

interface FailedImagesReviewPanelProps {
  onBack: () => void;
  onBackToSingleJob?: () => void;
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

type QCStatus = 'qc_failed' | 'retry_pending' | 'processing' | 'retry_failed' | 'approved';

interface RetryJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  imageCount: number;
  settings: 'original' | 'modified';
  metadata: boolean;
  createdAt: Date;
  completedAt?: Date;
  successCount?: number;
  failureCount?: number;
}

const FailedImagesReviewPanel: React.FC<FailedImagesReviewPanelProps> = ({ onBack, onBackToSingleJob }) => {
  console.log('🔍 FailedImagesReviewPanel: Component mounting...');
  
  const [failedImages, setFailedImages] = useState<GeneratedImage[]>([]);
  const [retryPendingImages, setRetryPendingImages] = useState<GeneratedImage[]>([]);
  const [processingImages, setProcessingImages] = useState<GeneratedImage[]>([]);
  const [retryFailedImages, setRetryFailedImages] = useState<GeneratedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedImageForReview, setSelectedImageForReview] = useState<GeneratedImage | null>(null);
  const [showProcessingSettingsModal, setShowProcessingSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<QCStatus>('qc_failed');
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
    currentJob?: RetryJob;
  }>({
    isProcessing: false,
    queueLength: 0,
    pendingJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0
  });

  // Load all image statuses on component mount
  useEffect(() => {
    console.log('🔍 FailedImagesReviewPanel: useEffect running...');
    loadAllImageStatuses();
    loadRetryQueueStatus();
    
    // Set up real-time retry event listeners
    const handleRetryProgress = (event: any, data: any) => {
      console.log('🔧 Retry progress event received:', data);
      // Refresh data when progress updates
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    const handleRetryCompleted = (event: any, data: any) => {
      console.log('🔧 Retry completed event received:', data);
      // Refresh data when job completes
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    const handleRetryError = (event: any, data: any) => {
      console.log('🔧 Retry error event received:', data);
      setError(`Retry error: ${data.error}`);
      // Refresh data when error occurs
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    const handleRetryQueueUpdated = (event: any, data: any) => {
      console.log('🔧 Retry queue updated event received:', data);
      // Refresh queue status
      loadRetryQueueStatus();
    };

    const handleRetryStatusUpdated = (event: any, data: any) => {
      console.log('🔧 Retry status updated event received:', data);
      // Refresh data when status changes
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    // Register event listeners
    window.electronAPI.onRetryProgress(handleRetryProgress);
    window.electronAPI.onRetryCompleted(handleRetryCompleted);
    window.electronAPI.onRetryError(handleRetryError);
    window.electronAPI.onRetryQueueUpdated(handleRetryQueueUpdated);
    window.electronAPI.onRetryStatusUpdated(handleRetryStatusUpdated);
    
    // Set up polling as fallback
    const interval = setInterval(() => {
      loadRetryQueueStatus();
      if (retryQueueStatus.isProcessing) {
        loadAllImageStatuses();
      }
    }, 5000); // Increased interval since we have real-time events
    
    return () => {
      clearInterval(interval);
      // Remove event listeners
      window.electronAPI.removeRetryProgress(handleRetryProgress);
      window.electronAPI.removeRetryCompleted(handleRetryCompleted);
      window.electronAPI.removeRetryError(handleRetryError);
      window.electronAPI.removeRetryQueueUpdated(handleRetryQueueUpdated);
      window.electronAPI.removeRetryStatusUpdated(handleRetryStatusUpdated);
    };
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

  // Load all image statuses
  const loadAllImageStatuses = async () => {
    console.log('🔍 loadAllImageStatuses: Starting...');
    try {
      setIsLoading(true);
      setError(null);
      
      // Load images by each status
      const [failed, pending, processing, retryFailed] = await Promise.all([
        window.electronAPI.generatedImages.getImagesByQCStatus('qc_failed'),
        window.electronAPI.generatedImages.getImagesByQCStatus('retry_pending'),
        window.electronAPI.generatedImages.getImagesByQCStatus('processing'),
        window.electronAPI.generatedImages.getImagesByQCStatus('retry_failed')
      ]);
      
      // Extract arrays from responses
      const extractImages = (response: any) => {
        if (response && typeof response === 'object' && response.success !== undefined) {
          return response.images || [];
        }
        return Array.isArray(response) ? response : [];
      };
      
      setFailedImages(extractImages(failed));
      setRetryPendingImages(extractImages(pending));
      setProcessingImages(extractImages(processing));
      setRetryFailedImages(extractImages(retryFailed));
      
    } catch (error) {
      console.error('🔍 loadAllImageStatuses: Error occurred:', error);
      setError('Failed to load images');
    } finally {
      setIsLoading(false);
      console.log('🔍 loadAllImageStatuses: Loading complete');
    }
  };

  // Get current tab images
  const getCurrentTabImages = () => {
    switch (activeTab) {
      case 'qc_failed':
        return failedImages;
      case 'retry_pending':
        return retryPendingImages;
      case 'processing':
        return processingImages;
      case 'retry_failed':
        return retryFailedImages;
      case 'approved':
        return [...failedImages, ...retryPendingImages, ...processingImages, ...retryFailedImages];
      default:
        return failedImages;
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
    const currentImages = getCurrentTabImages();
    if (selectedImages.size === currentImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(currentImages.map(img => img.id)));
    }
  };

  const handleImageAction = async (action: string, imageId: string, data?: any) => {
    try {
      setError(null);
      
      switch (action) {
        case 'approve':
          // Move image to main dashboard success view
          await window.electronAPI.generatedImages.updateQCStatus(imageId, 'approved');
          await loadAllImageStatuses();
          break;
        case 'retry':
          // Add image to retry selection bucket
          const newSelected = new Set(selectedImages);
          newSelected.add(imageId);
          setSelectedImages(newSelected);
          console.log('🔍 Image added to retry selection:', imageId, 'Total selected:', newSelected.size);
          break;
        case 'delete':
          await window.electronAPI.generatedImages.deleteGeneratedImage(imageId);
          await loadAllImageStatuses();
          break;
        case 'view':
          const allImages = [...failedImages, ...retryPendingImages, ...processingImages, ...retryFailedImages];
          const image = allImages.find(img => img.id === imageId);
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
            await window.electronAPI.generatedImages.updateQCStatus(imageId, 'approved');
          }
          break;
        case 'retry':
          // Show processing settings modal for retry
          setShowProcessingSettingsModal(true);
          return; // Don't clear selection yet
        case 'delete':
          // Bulk delete images
          for (const imageId of selectedImages) {
            await window.electronAPI.generatedImages.deleteGeneratedImage(imageId);
          }
          break;
      }
      
      await loadAllImageStatuses();
      setSelectedImages(new Set());
    } catch (error) {
      setError(`Failed to bulk ${action} images`);
      console.error(`Failed to bulk ${action} images:`, error);
    }
  };

  const handleRetryWithSettings = async (useOriginalSettings: boolean, modifiedSettings?: ProcessingSettings, includeMetadata?: boolean) => {
    console.log('🔍 FailedImagesReviewPanel: handleRetryWithSettings called');
    console.log('🔍 FailedImagesReviewPanel: useOriginalSettings:', useOriginalSettings);
    console.log('🔍 FailedImagesReviewPanel: modifiedSettings keys:', modifiedSettings ? Object.keys(modifiedSettings) : 'undefined');
    console.log('🔍 FailedImagesReviewPanel: includeMetadata:', includeMetadata);
    console.log('🔍 FailedImagesReviewPanel: selectedImages count:', selectedImages.size);
    
    if (selectedImages.size === 0) return;
    
    try {
      setError(null);
      
      // Process retry as a single batch with chosen settings
      const imageIds = Array.from(selectedImages);
      console.log('🔍 FailedImagesReviewPanel: Calling retryFailedImagesBatch with imageIds:', imageIds);
      
      const result = await window.electronAPI.retryFailedImagesBatch(
        imageIds, 
        useOriginalSettings, 
        useOriginalSettings ? null : (modifiedSettings || processingSettings),
        includeMetadata
      );
      
      console.log('🔍 FailedImagesReviewPanel: retryFailedImagesBatch result:', result);
      
      if (result.success) {
        console.log('🔍 FailedImagesReviewPanel: Retry successful, refreshing data...');
        await loadAllImageStatuses();
        await loadRetryQueueStatus(); // Refresh queue status
        setSelectedImages(new Set());
        setShowProcessingSettingsModal(false);
        console.log('🔍 FailedImagesReviewPanel: Retry processing complete');
      } else {
        console.error('🔍 FailedImagesReviewPanel: Retry failed:', result.error);
        setError(result.error || 'Failed to process retry operations');
      }
    } catch (error) {
      console.error('🔍 FailedImagesReviewPanel: Exception occurred:', error);
      setError('Failed to process retry operations');
      console.error('Failed to process retry operations:', error);
    }
  };

  const filteredAndSortedImages = React.useMemo(() => {
    const currentImages = getCurrentTabImages();
    
    let filtered = currentImages.filter(image => {
      // Job filter
      if (filterJob !== 'all' && image.executionId !== filterJob) {
        return false;
      }
      
      // Search filter - search in generation prompt, metadata prompt, title, description, and tags
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const meta = image.metadata || {};
        
        // Search in generation prompt
        const matchesPrompt = image.generationPrompt.toLowerCase().includes(query);
        
        // Search in metadata prompt
        const metaPrompt = typeof meta?.prompt === 'string' ? meta.prompt.toLowerCase() : '';
        const matchesMetadataPrompt = metaPrompt.includes(query);
        
        // Search in metadata title (supports both string and object with 'en' property)
        const title = typeof meta?.title === 'string' ? meta.title : meta?.title?.en || '';
        const matchesTitle = title.toLowerCase().includes(query);
        
        // Search in metadata description (supports both string and object with 'en' property)
        const description = typeof meta?.description === 'string' ? meta.description : meta?.description?.en || '';
        const matchesDescription = description.toLowerCase().includes(query);
        
        // Search in metadata tags (array of strings)
        const tags = Array.isArray(meta?.tags) ? meta.tags.join(' ').toLowerCase() : '';
        const matchesTags = tags.includes(query);
        
        if (!matchesPrompt && !matchesMetadataPrompt && !matchesTitle && !matchesDescription && !matchesTags) {
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
  }, [activeTab, failedImages, retryPendingImages, processingImages, retryFailedImages, filterJob, searchQuery, sortBy]);

  const uniqueJobIds = Array.from(new Set([
    ...failedImages.map(img => img.executionId),
    ...retryPendingImages.map(img => img.executionId),
    ...processingImages.map(img => img.executionId),
    ...retryFailedImages.map(img => img.executionId)
  ]));

  const getTabCount = (status: QCStatus) => {
    switch (status) {
      case 'qc_failed':
        return failedImages.length;
      case 'retry_pending':
        return retryPendingImages.length;
      case 'processing':
        return processingImages.length;
      case 'retry_failed':
        return retryFailedImages.length;
      case 'approved':
        return failedImages.length + retryPendingImages.length + processingImages.length + retryFailedImages.length;
      default:
        return 0;
    }
  };

  const getStatusColor = (status: QCStatus) => {
    switch (status) {
      case 'qc_failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'retry_pending':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'retry_failed':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'approved':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading images...</p>
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
            {onBackToSingleJob && (
              <button
                onClick={onBackToSingleJob}
                className="text-blue-500 hover:text-blue-700 transition-colors"
                aria-label="Back to single job view"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Failed Images Review</h1>
              <p className="text-gray-600">
                Review and manage images that failed quality assurance checks
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">{getTabCount('qc_failed')}</div>
              <div className="text-sm text-gray-500">Failed Images</div>
            </div>
          </div>
        </div>
      </div>

      {/* Retry Queue Status Bar */}
      {(retryQueueStatus.isProcessing || retryQueueStatus.queueLength > 0) && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900">🔄 Retry Queue Status</h3>
              <div className="text-sm text-blue-700">
                {retryQueueStatus.isProcessing ? 'Currently Processing' : 'Queued Jobs'}
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{retryQueueStatus.processingJobs}</div>
                <div className="text-sm text-blue-700">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{retryQueueStatus.pendingJobs}</div>
                <div className="text-sm text-amber-700">Queued</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{retryQueueStatus.completedJobs}</div>
                <div className="text-sm text-green-700">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{retryQueueStatus.failedJobs}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
            </div>

            {retryQueueStatus.currentJob && (
              <div className="bg-white border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    Current Job: #{retryQueueStatus.currentJob.id}
                  </span>
                  <span className="text-xs text-blue-600">
                    {retryQueueStatus.currentJob.settings} settings + {retryQueueStatus.currentJob.metadata ? 'metadata' : 'no metadata'}
                  </span>
                </div>
                <div className="space-y-2">
                  {processingImages.map((image, index) => (
                    <div key={image.id} className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">🖼️ Image {image.id}: Processing...</span>
                      <div className="w-24 bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex space-x-1">
          {(['qc_failed', 'retry_pending', 'processing', 'retry_failed', 'approved'] as QCStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                activeTab === status
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status === 'qc_failed' && 'Failed'}
              {status === 'retry_pending' && 'Retry Pending'}
              {status === 'processing' && 'Processing'}
              {status === 'retry_failed' && 'Retry Failed'}
              {status === 'approved' && 'All'}
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full border ${getStatusColor(status)}`}>
                {getTabCount(status)}
              </span>
            </button>
          ))}
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

            {/* Bulk Actions (visible always, disabled when none selected) */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('approve')}
                disabled={selectedImages.size === 0}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedImages.size === 0 
                    ? 'bg-green-200 text-green-400 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title={selectedImages.size === 0 ? 'Select images to enable' : 'Approve selected images'}
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction('retry')}
                disabled={selectedImages.size === 0 || retryQueueStatus.isProcessing}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedImages.size === 0 || retryQueueStatus.isProcessing 
                    ? 'bg-blue-200 text-blue-400 cursor-not-allowed' 
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
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedImages.size === 0 
                    ? 'bg-red-200 text-red-400 cursor-not-allowed' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                title={selectedImages.size === 0 ? 'Select images to enable' : 'Delete selected images'}
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Images Grid */}
      <div className="flex-1 p-6">
        {filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab === 'qc_failed' ? 'Failed' : 
                   activeTab === 'retry_pending' ? 'Retry Pending' :
                   activeTab === 'processing' ? 'Processing' :
                   activeTab === 'retry_failed' ? 'Retry Failed' : 'Images'}
            </h3>
            <p className="text-gray-500">
              {activeTab === 'qc_failed' ? 'All images have passed quality checks or are pending review.' :
               activeTab === 'retry_pending' ? 'No images are currently queued for retry.' :
               activeTab === 'processing' ? 'No images are currently being processed.' :
               activeTab === 'retry_failed' ? 'No images have failed retry attempts.' :
               'No images match the current criteria.'}
            </p>
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

      {/* Retry History */}
      {(retryQueueStatus.completedJobs > 0 || retryQueueStatus.failedJobs > 0) && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Retry History</h3>
            <div className="space-y-2 text-sm text-gray-700">
              {retryQueueStatus.completedJobs > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✅</span>
                  <span>Completed: {retryQueueStatus.completedJobs} retry jobs</span>
                </div>
              )}
              {retryQueueStatus.failedJobs > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-red-600">❌</span>
                  <span>Failed: {retryQueueStatus.failedJobs} retry jobs</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
