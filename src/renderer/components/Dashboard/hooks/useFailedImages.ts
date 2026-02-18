/**
 * Story 3.4 Phase 3: Failed images data loading and filtering.
 * Extracted from FailedImagesReviewPanel.tsx (frozen).
 * Label filter: Failed (All) + pill labels from formatQcLabel (same as status pills).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatQcLabel, formatRetryErrorForUser } from '../../../utils/qc';
import type { GeneratedImage } from '../../../../types/generatedImage';

export type QCStatus = 'qc_failed' | 'retry_pending' | 'processing' | 'retry_failed' | 'approved';

export interface RetryJob {
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

export interface RetryQueueStatus {
  isProcessing: boolean;
  queueLength: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  currentJob?: RetryJob;
}

function extractImages(response: any): GeneratedImage[] {
  if (response && typeof response === 'object' && response.success !== undefined) {
    return response.images || [];
  }
  return Array.isArray(response) ? response : [];
}

export function useFailedImages() {
  const [failedImages, setFailedImages] = useState<GeneratedImage[]>([]);
  const [retryPendingImages, setRetryPendingImages] = useState<GeneratedImage[]>([]);
  const [processingImages, setProcessingImages] = useState<GeneratedImage[]>([]);
  const [retryFailedImages, setRetryFailedImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterJob, setFilterJob] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [isJobFilterOpen, setIsJobFilterOpen] = useState(false);
  const [jobFilterQuery, setJobFilterQuery] = useState('');
  const [retryQueueStatus, setRetryQueueStatus] = useState<RetryQueueStatus>({
    isProcessing: false,
    queueLength: 0,
    pendingJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [jobIdToLabel, setJobIdToLabel] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<QCStatus>('qc_failed');
  /** 'all' (Failed (All)) or a pill label from formatQcLabel (QC Failed, Download failed, etc.). */
  const [imageFilter, setImageFilter] = useState<string>('all');

  const loadRetryQueueStatus = useCallback(async () => {
    try {
      const result = await (window as any).electronAPI.getRetryQueueStatus();
      if (result?.success && result.queueStatus) {
        setRetryQueueStatus(result.queueStatus);
      }
    } catch (e) {
      console.error('Failed to load retry queue status:', e);
    }
  }, []);

  const loadAllImageStatuses = useCallback(async (background = false) => {
    try {
      if (!background) {
        setIsLoading(true);
        setError(null);
      }
      const [failed, pending, processing, retryFailed] = await Promise.all([
        (window as any).electronAPI.generatedImages.getImagesByQCStatus('qc_failed'),
        (window as any).electronAPI.generatedImages.getImagesByQCStatus('retry_pending'),
        (window as any).electronAPI.generatedImages.getImagesByQCStatus('processing'),
        (window as any).electronAPI.generatedImages.getImagesByQCStatus('retry_failed'),
      ]);
      setFailedImages(extractImages(failed));
      setRetryPendingImages(extractImages(pending));
      setProcessingImages(extractImages(processing));
      setRetryFailedImages(extractImages(retryFailed));
      try {
        const jobsResp = await (window as any).electronAPI?.jobManagement?.getAllJobExecutions?.({});
        let list: any[] = [];
        if (Array.isArray((jobsResp as any)?.executions)) list = (jobsResp as any).executions;
        else if (Array.isArray((jobsResp as any)?.jobs)) list = (jobsResp as any).jobs;
        else if (Array.isArray((jobsResp as any)?.data)) list = (jobsResp as any).data;
        const map: Record<string, string> = {};
        list.forEach((j: any) => {
          const k = String(j?.id);
          let label = (j?.label || j?.configurationName || j?.displayLabel || '').toString().trim();
          // Show "Job Label (Rerun xxxx)" in grid/list like Job History and Job Management (not just "Job Label (Rerun)")
          if (label && label.endsWith('(Rerun)')) {
            label = label.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(j?.id ?? k).slice(-6)})`;
          }
          if (k) map[k] = label;
        });
        setJobIdToLabel(map);
      } catch {}
    } catch (e) {
      console.error('loadAllImageStatuses error:', e);
      if (!background) setError('Failed to load images');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllImageStatuses();
    loadRetryQueueStatus();
    const handleRetryProgress = () => {
      loadAllImageStatuses(true);
      loadRetryQueueStatus();
    };
    const handleRetryCompleted = async (_event: any, data: any) => {
      try {
        const newPath: string | undefined = data?.result?.newPath || data?.result?.processedImagePath;
        if (newPath && (window as any).electronAPI?.refreshProtocolRoots) {
          const dir = newPath.replace(/\\[^/]*$/, '').replace(/\/[^/]*$/, '');
          await (window as any).electronAPI.refreshProtocolRoots([dir]);
        }
      } catch (_) {}
      loadAllImageStatuses(true);
      loadRetryQueueStatus();
    };
    const handleRetryError = (_event: any, data: any) => {
      setError(formatRetryErrorForUser(data?.error));
      loadAllImageStatuses(true);
      loadRetryQueueStatus();
    };
    const handleRetryQueueUpdated = () => loadRetryQueueStatus();
    const handleRetryStatusUpdated = () => {
      loadAllImageStatuses(true);
      loadRetryQueueStatus();
    };
    (window as any).electronAPI.onRetryProgress(handleRetryProgress);
    (window as any).electronAPI.onRetryCompleted(handleRetryCompleted);
    (window as any).electronAPI.onRetryError(handleRetryError);
    (window as any).electronAPI.onRetryQueueUpdated(handleRetryQueueUpdated);
    (window as any).electronAPI.onRetryStatusUpdated(handleRetryStatusUpdated);
    const interval = setInterval(() => {
      loadRetryQueueStatus();
    }, 5000);
    return () => {
      clearInterval(interval);
      (window as any).electronAPI.removeRetryProgress(handleRetryProgress);
      (window as any).electronAPI.removeRetryCompleted(handleRetryCompleted);
      (window as any).electronAPI.removeRetryError(handleRetryError);
      (window as any).electronAPI.removeRetryQueueUpdated(handleRetryQueueUpdated);
      (window as any).electronAPI.removeRetryStatusUpdated(handleRetryStatusUpdated);
    };
  }, [loadAllImageStatuses, loadRetryQueueStatus]);

  /** Images for the active tab (Failed, Retry Pending, Processing, Retry Failed, All). */
  const currentTabImages = useMemo(() => {
    switch (activeTab) {
      case 'qc_failed': return failedImages;
      case 'retry_pending': return retryPendingImages;
      case 'processing': return processingImages;
      case 'retry_failed': return retryFailedImages;
      case 'approved': return [...failedImages, ...retryPendingImages, ...processingImages, ...retryFailedImages];
      default: return failedImages;
    }
  }, [activeTab, failedImages, retryPendingImages, processingImages, retryFailedImages]);

  /** Filter by pill label: Failed (All) shows all; otherwise show images whose formatQcLabel equals selected label. */
  const imagesByStatusFilter = useMemo(() => {
    if (imageFilter === 'all') return currentTabImages;
    return currentTabImages.filter((img: any) => {
      const label = formatQcLabel(img?.qcStatus, img?.qcReason) || 'QC Failed';
      return label === imageFilter;
    });
  }, [currentTabImages, imageFilter]);

  const getCurrentTabImages = useCallback(() => {
    switch (activeTab) {
      case 'qc_failed': return failedImages;
      case 'retry_pending': return retryPendingImages;
      case 'processing': return processingImages;
      case 'retry_failed': return retryFailedImages;
      case 'approved': return [...failedImages, ...retryPendingImages, ...processingImages, ...retryFailedImages];
      default: return failedImages;
    }
  }, [activeTab, failedImages, retryPendingImages, processingImages, retryFailedImages]);

  const filteredAndSortedImages = useMemo(() => {
    const currentImages = imagesByStatusFilter;
    let filtered = currentImages.filter((image) => {
      if (filterJob !== 'all' && String(image.executionId) !== filterJob) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const meta = image.metadata || {};
        const matchesPrompt = image.generationPrompt.toLowerCase().includes(query);
        const metaPrompt = typeof meta?.prompt === 'string' ? meta.prompt.toLowerCase() : '';
        const matchesMetadataPrompt = metaPrompt.includes(query);
        const title = typeof meta?.title === 'string' ? meta.title : meta?.title?.en || '';
        const matchesTitle = title.toLowerCase().includes(query);
        const description = typeof meta?.description === 'string' ? meta.description : meta?.description?.en || '';
        const matchesDescription = description.toLowerCase().includes(query);
        const tags = Array.isArray(meta?.tags) ? meta.tags.join(' ').toLowerCase() : '';
        const matchesTags = tags.includes(query);
        if (!matchesPrompt && !matchesMetadataPrompt && !matchesTitle && !matchesDescription && !matchesTags) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.createdAt ? new Date(b.createdAt as any).getTime() : 0) - (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        case 'oldest':
          return (a.createdAt ? new Date(a.createdAt as any).getTime() : 0) - (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        case 'name':
          return a.generationPrompt.localeCompare(b.generationPrompt);
        default: return 0;
      }
    });
    return sorted;
  }, [imagesByStatusFilter, filterJob, searchQuery, sortBy]);

  const uniqueJobIds = useMemo(() => Array.from(new Set([
    ...failedImages.map((img) => String(img.executionId)),
    ...retryPendingImages.map((img) => String(img.executionId)),
    ...processingImages.map((img) => String(img.executionId)),
    ...retryFailedImages.map((img) => String(img.executionId)),
  ])), [failedImages, retryPendingImages, processingImages, retryFailedImages]);

  const getTabCount = useCallback((status: QCStatus): number => {
    switch (status) {
      case 'qc_failed': return failedImages.length;
      case 'retry_pending': return retryPendingImages.length;
      case 'processing': return processingImages.length;
      case 'retry_failed': return retryFailedImages.length;
      case 'approved': return failedImages.length + retryPendingImages.length + processingImages.length + retryFailedImages.length;
      default: return 0;
    }
  }, [failedImages, retryPendingImages, processingImages, retryFailedImages]);

  const getStatusColor = useCallback((status: QCStatus): string => {
    switch (status) {
      case 'qc_failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'retry_pending': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'processing': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'retry_failed': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'approved': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilterJob('all');
    setSearchQuery('');
    setSortBy('newest');
    setImageFilter('all');
  }, []);

  return {
    failedImages,
    retryPendingImages,
    processingImages,
    retryFailedImages,
    isLoading,
    error,
    setError,
    filterJob,
    setFilterJob,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isJobFilterOpen,
    setIsJobFilterOpen,
    jobFilterQuery,
    setJobFilterQuery,
    retryQueueStatus,
    viewMode,
    setViewMode,
    jobIdToLabel,
    activeTab,
    setActiveTab,
    imageFilter,
    setImageFilter,
    loadAllImageStatuses,
    loadRetryQueueStatus,
    getCurrentTabImages,
    filteredAndSortedImages,
    uniqueJobIds,
    getTabCount,
    getStatusColor,
    clearFilters,
  };
}
