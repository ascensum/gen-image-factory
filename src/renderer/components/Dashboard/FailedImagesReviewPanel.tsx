import React, { useState, useEffect } from 'react';
import type { GeneratedImage } from '../../../types/generatedImage';
import FailedImageCard from './FailedImageCard';
import FailedImageReviewModal from './FailedImageReviewModal';
import ProcessingSettingsModal from './ProcessingSettingsModal';
import type { ProcessingSettings } from '../../../types/processing';

interface FailedImagesReviewPanelProps {
  onBack: () => void;
  onBackToSingleJob?: () => void;
}

// Using shared ProcessingSettings type

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
  console.log(' FailedImagesReviewPanel: Component mounting...');
  
  const [failedImages, setFailedImages] = useState<GeneratedImage[]>([]);
  const [retryPendingImages, setRetryPendingImages] = useState<GeneratedImage[]>([]);
  const [processingImages, setProcessingImages] = useState<GeneratedImage[]>([]);
  const [retryFailedImages, setRetryFailedImages] = useState<GeneratedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedImageForReview, setSelectedImageForReview] = useState<GeneratedImage | null>(null);
  const [showProcessingSettingsModal, setShowProcessingSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<QCStatus>('qc_failed');
  const [processingSettings] = useState<ProcessingSettings>({
    imageEnhancement: false,
    sharpening: 0,
    saturation: 1,
    imageConvert: false,
    convertToJpg: true,
    jpgQuality: 90,
    pngQuality: 100,
    removeBg: false,
    removeBgSize: 'auto',
    trimTransparentBackground: false,
    jpgBackground: '#FFFFFF'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterJob, setFilterJob] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  // Job filter dropdown controls
  const [isJobFilterOpen, setIsJobFilterOpen] = useState(false);
  const [jobFilterQuery, setJobFilterQuery] = useState('');
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [jobIdToLabel, setJobIdToLabel] = useState<Record<string, string>>({});

  // Load all image statuses on component mount
  useEffect(() => {
    console.log(' FailedImagesReviewPanel: useEffect running...');
    loadAllImageStatuses();
    loadRetryQueueStatus();
    
    // Set up real-time retry event listeners
    const handleRetryProgress = (_event: any, data: any) => {
      console.log(' Retry progress event received:', data);
      // Refresh data when progress updates
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    const handleRetryCompleted = async (_event: any, data: any) => {
      console.log(' Retry completed event received:', data);
      // Refresh data when job completes
      try {
        const newPath: string | undefined = data?.result?.newPath || data?.result?.processedImagePath;
        if (newPath && (window as any).electronAPI?.refreshProtocolRoots) {
          const dir = newPath.replace(/\\[^/]*$/, '').replace(/\/[^/]*$/, '');
          await (window as any).electronAPI.refreshProtocolRoots([dir]);
        }
      } catch (e) {
        console.warn('️ Failed to refresh protocol roots after retry-completed:', (e as any)?.message || e);
      }
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    const handleRetryError = (_event: any, data: any) => {
      console.log(' Retry error event received:', data);
      setError(`Retry error: ${data.error}`);
      // Refresh data when error occurs
      loadAllImageStatuses();
      loadRetryQueueStatus();
    };

    const handleRetryQueueUpdated = (_event: any, _data: any) => {
      console.log(' Retry queue updated event received');
      // Refresh queue status
      loadRetryQueueStatus();
    };

    const handleRetryStatusUpdated = (_event: any, _data: any) => {
      console.log(' Retry status updated event received');
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
    console.log(' loadAllImageStatuses: Starting...');
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

      // Load job labels for list view mapping
      try {
        const jobsResp = await (window as any).electronAPI?.jobManagement?.getAllJobExecutions?.({});
        let list: any[] = [];
        if (Array.isArray((jobsResp as any)?.executions)) list = (jobsResp as any).executions;
        else if (Array.isArray((jobsResp as any)?.jobs)) list = (jobsResp as any).jobs;
        else if (Array.isArray((jobsResp as any)?.data)) list = (jobsResp as any).data;
        const map: Record<string, string> = {};
        list.forEach((j: any) => {
          const k = String(j?.id);
          const label = (j?.label || j?.configurationName || '').toString();
          if (k) map[k] = label;
        });
        setJobIdToLabel(map);
      } catch {}
      // Also load job labels for list view
      try {
        const jobsResult = await (window as any).electronAPI?.jobManagement?.getAllJobExecutions?.({});
        let list: any[] = [];
        if (Array.isArray((jobsResult as any)?.executions)) list = (jobsResult as any).executions;
        else if (Array.isArray((jobsResult as any)?.jobs)) list = (jobsResult as any).jobs;
        else if (Array.isArray((jobsResult as any)?.data)) list = (jobsResult as any).data;
        const map: Record<string, string> = {};
        list.forEach((j: any) => {
          const key = String(j?.id);
          const label = (j?.label || j?.configurationName || '').toString();
          if (key) map[key] = label;
        });
        // setJobIdToLabel(map); // This line was removed as per the edit hint
      } catch {}
      
    } catch (error) {
      console.error(' loadAllImageStatuses: Error occurred:', error);
      setError('Failed to load images');
    } finally {
      setIsLoading(false);
      console.log(' loadAllImageStatuses: Loading complete');
    }
  };

  // Post-retry safeguard: for original-settings flow that may not emit events,
  // poll briefly until tracked images leave retry_pending/processing, then stop.
  const waitAndRefreshUntilDone = async (imageIds: string[], timeoutMs = 60000, intervalMs = 2000) => {
    try {
      const normalize = (resp: any) => (resp && typeof resp === 'object' && resp.success !== undefined)
        ? (resp.images || [])
        : (Array.isArray(resp) ? resp : []);
      const includesTracked = (arr: any[]) => arr.some((img: any) => imageIds.includes(String(img.id)));

      const startedAt = Date.now();
      // Initial refresh so UI updates immediately after enqueue
      await loadAllImageStatuses();
      await loadRetryQueueStatus();

      while (Date.now() - startedAt < timeoutMs) {
        // Fetch current pending/processing directly
        const [pendingResp, processingResp] = await Promise.all([
          window.electronAPI.generatedImages.getImagesByQCStatus('retry_pending'),
          window.electronAPI.generatedImages.getImagesByQCStatus('processing')
        ]);
        const pending = normalize(pendingResp);
        const processing = normalize(processingResp);

        // Refresh UI state each tick
        await loadAllImageStatuses();
        await loadRetryQueueStatus();

        const stillTracked = includesTracked(pending) || includesTracked(processing);
        if (!stillTracked) break;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    } catch (_) {
      // Non-fatal; UI will still have baseline refreshes and event listeners
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
      setSelectedImages(new Set(currentImages.map(img => String(img.id))));
    }
  };

  const handleImageAction = async (action: string, imageId: string) => {
    try {
      setError(null);
      
      switch (action) {
        case 'approve':
          // Use manual approve to move file and set final path before QC flip
          let approveResult: any = null;
          if ((window as any).electronAPI?.generatedImages?.manualApproveImage) {
            approveResult = await (window as any).electronAPI.generatedImages.manualApproveImage(imageId);
          } else {
            approveResult = await window.electronAPI.generatedImages.updateQCStatus(imageId, 'approved');
          }
          try {
            const outDir = approveResult?.outputDirectory;
            const finalPath = approveResult?.finalImagePath;
            const dirFromPath = finalPath && typeof finalPath === 'string' ? finalPath.replace(/\\[^/]*$/,'').replace(/\/[^/]*$/, '') : null;
            const rootToAdd = outDir || dirFromPath || null;
            if (rootToAdd && (window as any).electronAPI?.refreshProtocolRoots) {
              await (window as any).electronAPI.refreshProtocolRoots([rootToAdd]);
            }
          } catch (e) {
            console.warn('️ refreshProtocolRoots failed (non-blocking):', (e as any)?.message || e);
          }
          await loadAllImageStatuses();
          break;
        case 'retry':
          // Add image to retry selection bucket
          const newSelected = new Set(selectedImages);
          newSelected.add(imageId);
          setSelectedImages(newSelected);
          console.log(' Image added to retry selection:', imageId, 'Total selected:', newSelected.size);
          break;
        case 'delete':
          await window.electronAPI.generatedImages.deleteGeneratedImage(imageId);
          await loadAllImageStatuses();
          break;
        case 'view':
          const allImages = [...failedImages, ...retryPendingImages, ...processingImages, ...retryFailedImages];
          const image = allImages.find(img => String(img.id) === imageId);
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

  const handleBulkAction = async (action: string) => {
    if (selectedImages.size === 0) return;
    
    try {
      setError(null);
      
      switch (action) {
        case 'approve':
          // Bulk approve images using manualApprove when available
          for (const imageId of selectedImages) {
            if ((window as any).electronAPI?.generatedImages?.manualApproveImage) {
              await (window as any).electronAPI.generatedImages.manualApproveImage(imageId);
            } else {
              await window.electronAPI.generatedImages.updateQCStatus(imageId, 'approved');
            }
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
    console.log(' FailedImagesReviewPanel: handleRetryWithSettings called');
    console.log(' FailedImagesReviewPanel: useOriginalSettings:', useOriginalSettings);
    console.log(' FailedImagesReviewPanel: modifiedSettings keys:', modifiedSettings ? Object.keys(modifiedSettings) : 'undefined');
    console.log(' FailedImagesReviewPanel: includeMetadata:', includeMetadata);
    console.log(' FailedImagesReviewPanel: selectedImages count:', selectedImages.size);
    
    if (selectedImages.size === 0) return;
    
    try {
      setError(null);
      
      // Process retry as a single batch with chosen settings
      const imageIds = Array.from(selectedImages);
      console.log(' FailedImagesReviewPanel: Calling retryFailedImagesBatch with imageIds:', imageIds);
      
      const result = await window.electronAPI.retryFailedImagesBatch(
        imageIds, 
        useOriginalSettings, 
        useOriginalSettings ? null : (modifiedSettings || processingSettings),
        includeMetadata
      );
      
      console.log(' FailedImagesReviewPanel: retryFailedImagesBatch result:', result);
      
      if (result.success) {
        console.log(' FailedImagesReviewPanel: Retry successful, refreshing data...');
        await loadAllImageStatuses();
        await loadRetryQueueStatus(); // Refresh queue status
        setSelectedImages(new Set());
        setShowProcessingSettingsModal(false);
        console.log(' FailedImagesReviewPanel: Retry processing complete');
        // Ensure counters settle for original-settings flow by polling briefly
        try {
          const ids = imageIds.map((id) => String(id));
          // Fire-and-forget; do not block UI
          waitAndRefreshUntilDone(ids).catch(() => {});
        } catch {}
      } else {
        console.error(' FailedImagesReviewPanel: Retry failed:', result.error);
        setError(result.error || 'Failed to process retry operations');
      }
    } catch (error) {
      console.error(' FailedImagesReviewPanel: Exception occurred:', error);
      setError('Failed to process retry operations');
      console.error('Failed to process retry operations:', error);
    }
  };

  const filteredAndSortedImages = React.useMemo(() => {
    const currentImages = getCurrentTabImages();
    
    let filtered = currentImages.filter(image => {
      // Job filter
      if (filterJob !== 'all' && String(image.executionId) !== filterJob) {
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
          return (b.createdAt ? new Date(b.createdAt as any).getTime() : 0) - (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        case 'oldest':
          return (a.createdAt ? new Date(a.createdAt as any).getTime() : 0) - (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        case 'name':
          return a.generationPrompt.localeCompare(b.generationPrompt);
        default:
          return 0;
      }
    });

    return sorted;
  }, [activeTab, failedImages, retryPendingImages, processingImages, retryFailedImages, filterJob, searchQuery, sortBy]);

  const uniqueJobIds = Array.from(new Set([
    ...failedImages.map(img => String(img.executionId)),
    ...retryPendingImages.map(img => String(img.executionId)),
    ...processingImages.map(img => String(img.executionId)),
    ...retryFailedImages.map(img => String(img.executionId))
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 relative">
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
          
          {/* Removed main logo from header to de-emphasize branding in utility view */}
          <div className="flex items-center space-x-4 ml-auto">
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
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                Retry Queue Status
              </h3>
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
                  {processingImages.map((image) => (
                    <div key={image.id} className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">️ Image {image.id}: Processing...</span>
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

      {/* Selection & Controls Ribbon (unified) */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: controls ordered like Image Gallery: View → Job → Search → Sort → Clear */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle (match Image Gallery style) */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-gray-200 text-gray-900 border border-gray-300'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
                aria-label="Grid View"
                title="Grid View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all duration-200 ${
                  viewMode === 'list'
                    ? 'bg-gray-200 text-gray-900 border border-gray-300'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                }`}
                aria-label="List View"
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Job Filter (searchable + scrollable dropdown) */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Job:</span>
                <button
                  type="button"
                  onClick={() => setIsJobFilterOpen(v => !v)}
                  className="relative text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem] text-left pr-8"
                  aria-haspopup="listbox"
                  aria-expanded={isJobFilterOpen}
                >
                  {filterJob === 'all' ? 'All Jobs' : (() => {
                    const label = jobIdToLabel[String(filterJob)];
                    if (label && label.trim() !== '') {
                      const base = label.trim();
                      const isRerun = base.endsWith('(Rerun)');
                      return isRerun
                        ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(filterJob).slice(-3)})`
                        : base;
                    }
                    return `Job ${String(filterJob).slice(0, 8)}`;
                  })()}
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-700">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                    </svg>
                  </span>
                </button>
              </div>

              {isJobFilterOpen && (
                <div className="absolute z-20 mt-2 w-[18rem] bg-white border border-gray-200 rounded-md shadow-lg overflow-x-hidden">
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      value={jobFilterQuery}
                      onChange={(e) => setJobFilterQuery(e.target.value)}
                      placeholder="Search jobs..."
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <ul role="listbox" className="max-h-72 overflow-y-auto overflow-x-hidden py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => { setFilterJob('all'); setIsJobFilterOpen(false); setJobFilterQuery(''); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-normal break-words ${filterJob === 'all' ? 'bg-gray-100' : ''}`}
                        role="option"
                        aria-selected={filterJob === 'all'}
                      >
                        All Jobs
                      </button>
                    </li>
                    {uniqueJobIds
                      .map(id => ({ id, label: jobIdToLabel[String(id)] || `Job ${String(id).slice(0, 8)}` }))
                      .filter(opt => opt.label.toLowerCase().includes(jobFilterQuery.toLowerCase()))
                      .map(opt => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            onClick={() => { setFilterJob(String(opt.id)); setIsJobFilterOpen(false); setJobFilterQuery(''); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-normal break-words ${String(filterJob) === String(opt.id) ? 'bg-gray-100' : ''}`}
                            role="option"
                            aria-selected={String(filterJob) === String(opt.id)}
                            title={(() => {
                              const lbl = opt.label.trim();
                              return lbl.endsWith('(Rerun)')
                                ? lbl.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(opt.id).slice(-3)})`
                                : lbl;
                            })()}
                          >
                            {(() => {
                              const lbl = opt.label.trim();
                              return lbl.endsWith('(Rerun)')
                                ? lbl.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(opt.id).slice(-3)})`
                                : lbl;
                            })()}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Search:</span>
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
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

            {/* Clear */}
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

          {/* Right: selection + bulk actions */}
          <div className="flex items-center gap-4 flex-wrap">
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
                  <svg className="ml-1 w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2A10 10 0 002 12h2zm2 5.291A7.962 7.962 0 014 12H2c0 3.042 1.135 5.824 3 7.938l1-0.647z"></path>
                  </svg>
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

      {/* (Old selection controls removed in favor of unified ribbon above) */}

      {/* Scrollable content area: only images/list (and history) scroll, headers stay fixed */}
      <div className="flex-1 overflow-y-auto">
        {/* Images Grid/List */}
        <div className="p-6">
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
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredAndSortedImages.map((image) => (
                  <FailedImageCard
                    key={image.id}
                    image={image}
                    isSelected={selectedImages.has(String(image.id))}
                    onSelect={() => handleImageSelect(String(image.id))}
                    onAction={(action, id) => handleImageAction(action, id)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full table-fixed divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-12 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                      <th className="w-20 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                      <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QC Status</th>
                      <th className="w-[40%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="w-[18%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Name/Label</th>
                      <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedImages.map((image) => (
                      <tr key={image.id} className="hover:bg-gray-50">
                        <td className="w-12 px-4 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedImages.has(String(image.id))}
                            onChange={() => handleImageSelect(String(image.id))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="w-20 px-4 py-2 align-top">
                          <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex items-center justify-center" title={(function(){
                            const raw = (image as any)?.metadata;
                            const truncate = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
                            try {
                              const meta = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
                              const t = typeof meta?.title === 'object' ? (meta.title.en || '') : (meta?.title || '');
                              if (t && String(t).trim()) return String(t).trim();
                              const p = String(image.generationPrompt || '');
                              return truncate(p);
                            } catch {
                              const p = String(image.generationPrompt || '');
                              return truncate(p);
                            }
                          })()}>
                            {(image.finalImagePath || image.tempImagePath) ? (
                              <img
                                src={`local-file://${image.finalImagePath || image.tempImagePath}`}
                                alt="thumb"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNNTAgNTBIMTUwVjc1SDc1VjEyNUg1MFY1MFoiIGZpbGw9IiNEMUQ1RDNBIi8+Cjwvc3ZnPg==';
                                }}
                              />
                            ) : (
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="w-28 px-4 py-2 align-top">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                            {String(image.qcStatus) === 'qc_failed' ? 'QC failed' : String(image.qcStatus) === 'retry_failed' ? 'Retry failed' : String(image.qcStatus) === 'retry_pending' ? 'Pending retry' : String(image.qcStatus) === 'processing' ? 'Processing' : String(image.qcStatus)}
                          </span>
                        </td>
                        <td className="w-[40%] px-4 py-2 text-sm text-gray-700 whitespace-normal break-words align-top">{image.qcReason || '-'}</td>
                        <td className="w-[18%] px-4 py-2 text-sm text-gray-700 align-top">{jobIdToLabel[String(image.executionId)] || `Job ${image.executionId}`}</td>
                        <td className="w-28 px-4 py-2 text-sm text-gray-700 align-top">{image.createdAt ? new Date(image.createdAt as any).toLocaleDateString() : '-'}</td>
                        <td className="w-28 px-4 py-2 align-top">
                          <div className="flex items-center gap-3 justify-start flex-wrap">
                            <button onClick={() => handleImageAction('view', String(image.id))} className="text-gray-600 hover:text-gray-900" title="View" aria-label="View">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                            <button onClick={() => handleImageAction('approve', String(image.id))} className="text-green-600 hover:text-green-700" title="Approve" aria-label="Approve">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                            </button>
                            <button onClick={() => handleImageAction('retry', String(image.id))} className="text-blue-600 hover:text-blue-700" title="Add to Retry" aria-label="Add to Retry">
                              {/* lucide redo-2 */}
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>
                            </button>
                            <button onClick={() => handleImageAction('delete', String(image.id))} className="text-red-600 hover:text-red-700" title="Delete" aria-label="Delete">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        </div>

        {/* Retry History */}
        {(retryQueueStatus.completedJobs > 0 || retryQueueStatus.failedJobs > 0) && (
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Retry History
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              {retryQueueStatus.completedJobs > 0 && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Completed: {retryQueueStatus.completedJobs} retry jobs</span>
                </div>
              )}
              {retryQueueStatus.failedJobs > 0 && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Failed: {retryQueueStatus.failedJobs} retry jobs</span>
                </div>
              )}
            </div>
            </div>
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
      {selectedImageForReview && (() => {
        const currentIndex = filteredAndSortedImages.findIndex(img => String(img.id) === String((selectedImageForReview as any).id));
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex >= 0 && currentIndex < filteredAndSortedImages.length - 1;
        const onPrevious = hasPrevious ? () => setSelectedImageForReview(filteredAndSortedImages[currentIndex - 1]) : undefined;
        const onNext = hasNext ? () => setSelectedImageForReview(filteredAndSortedImages[currentIndex + 1]) : undefined;
        return (
          <FailedImageReviewModal
            image={selectedImageForReview}
            isOpen={!!selectedImageForReview}
            onClose={() => setSelectedImageForReview(null)}
            onAction={handleImageAction}
            onPrevious={onPrevious}
            onNext={onNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        );
      })()}

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
