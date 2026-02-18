import { useState, useCallback, useMemo } from 'react';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../types/generatedImage';

export interface JobStatus {
  state: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  currentJob?: JobExecution;
  progress: number;
  currentStep: number;
  totalSteps: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface JobExecution {
  id: string;
  configurationId: number;
  configurationName: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  errorMessage?: string | null;
}

export interface JobStatistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  totalImagesGenerated: number;
  successRate: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  stepName?: string;
  subStep?: string;
  imageIndex?: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  metadata?: Record<string, any>;
  progress?: number;
  totalImages?: number;
  successfulImages?: number;
  failedImages?: number;
}

export const useDashboardState = () => {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    state: 'idle',
    progress: 0,
    currentStep: 1,
    totalSteps: 2
  });
  const [jobHistory, setJobHistory] = useState<JobExecution[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statistics, setStatistics] = useState<JobStatistics>({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageExecutionTime: 0,
    totalImagesGenerated: 0,
    successRate: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'image-gallery'>('overview');
  const [imageViewMode, setImageViewMode] = useState<'grid' | 'list'>('grid');
  
  const [imageJobFilter, setImageJobFilter] = useState<string>('all');
  const [imageSearchQuery, setImageSearchQuery] = useState<string>('');
  const [imageSortBy, setImageSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [imageDateFrom, setImageDateFrom] = useState<string | null>(null);
  const [imageDateTo, setImageDateTo] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [jobConfiguration, setJobConfiguration] = useState<any>(null);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [showSingleExportModal, setShowSingleExportModal] = useState(false);
  const [galleryHasMore, setGalleryHasMore] = useState(false);

  // Derived statistics (moved from DashboardPanel.tsx)
  const computedStatistics = useMemo(() => {
    const jobs = Array.isArray(jobHistory) ? jobHistory : [];
    const totalJobsLocal = jobs.length;
    const completedJobsLocal = jobs.filter(j => String(j.status).toLowerCase() === 'completed').length;
    const failedJobsLocal = jobs.filter(j => String(j.status).toLowerCase() === 'failed').length;
    const totalImagesGeneratedLocal = jobs.reduce((sum, j) => sum + (Number((j as any).successfulImages) || 0), 0);
    const totalImagesLocal = jobs.reduce((sum, j) => sum + (Number((j as any).totalImages) || 0), 0);
    const avgDurationLocalSec = (() => {
      const completed = jobs.filter(j => j.completedAt && j.startedAt);
      if (completed.length === 0) return 0;
      const totalSec = completed.reduce((acc, j) => {
        const start = j.startedAt ? new Date(j.startedAt as any).getTime() : 0;
        const end = j.completedAt ? new Date(j.completedAt as any).getTime() : 0;
        const dur = end && start && end > start ? (end - start) / 1000 : 0;
        return acc + dur;
      }, 0);
      return Math.round(totalSec / completed.length);
    })();

    const successRateLocal = totalImagesLocal > 0
      ? Math.round((totalImagesGeneratedLocal / totalImagesLocal) * 100)
      : (statistics.successRate || 0);

    return {
      totalJobs: totalJobsLocal || statistics.totalJobs || 0,
      completedJobs: completedJobsLocal || statistics.completedJobs || 0,
      failedJobs: failedJobsLocal || statistics.failedJobs || 0,
      averageExecutionTime: avgDurationLocalSec || statistics.averageExecutionTime || 0,
      totalImagesGenerated: totalImagesGeneratedLocal || statistics.totalImagesGenerated || 0,
      successRate: successRateLocal || 0,
    } as JobStatistics;
  }, [jobHistory, statistics]);

  return {
    jobStatus, setJobStatus,
    jobHistory, setJobHistory,
    generatedImages, setGeneratedImages,
    logs, setLogs,
    statistics, setStatistics,
    computedStatistics,
    error, setError,
    isLoading, setIsLoading,
    activeTab, setActiveTab,
    imageViewMode, setImageViewMode,
    imageJobFilter, setImageJobFilter,
    imageSearchQuery, setImageSearchQuery,
    imageSortBy, setImageSortBy,
    imageDateFrom, setImageDateFrom,
    imageDateTo, setImageDateTo,
    selectedImages, setSelectedImages,
    jobConfiguration, setJobConfiguration,
    exportJobId, setExportJobId,
    showSingleExportModal, setShowSingleExportModal,
    galleryHasMore, setGalleryHasMore
  };
};
