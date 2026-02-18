import { useEffect, useRef } from 'react';
import type { JobStatus, JobExecution } from './useDashboardState';

interface DashboardPollingProps {
  jobStatus: JobStatus;
  jobHistory: JobExecution[];
  setJobStatus: (status: JobStatus) => void;
  loadJobHistory: (silent?: boolean) => Promise<void>;
  loadStatistics: () => Promise<void>;
  loadGeneratedImages: () => Promise<void>;
  loadLogs: (jobState: string) => Promise<void>;
  loadJobConfiguration: () => Promise<void>;
  /** When true, skip initial loadGeneratedImages (e.g. when returning from Failed Review we do a single refresh instead). */
  skipInitialGalleryLoad?: boolean;
}

export const useDashboardPolling = ({
  jobStatus,
  jobHistory,
  setJobStatus,
  loadJobHistory,
  loadStatistics,
  loadGeneratedImages,
  loadLogs,
  loadJobConfiguration,
  skipInitialGalleryLoad = false,
}: DashboardPollingProps) => {
  const lastCompletionRef = useRef<number | null>(null);
  
  // Load initial data (one gallery load unless skipInitialGalleryLoad)
  useEffect(() => {
    loadJobHistory();
    loadStatistics();
    if (!skipInitialGalleryLoad) {
      loadGeneratedImages();
    }
    loadLogs('idle');
    loadJobConfiguration();
  }, [loadJobHistory, loadStatistics, loadGeneratedImages, loadLogs, loadJobConfiguration, skipInitialGalleryLoad]);

  // Poll for job status updates
  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const status = await window.electronAPI.jobManagement.getJobStatus();
        const normalized = { ...status } as any;
        
        if (normalized && normalized.state === 'error') {
          normalized.state = 'failed';
        }
        
        // Only treat "running" as stale when backend says running but has no currentJob AND job list has no running job.
        // Do not force to failed when we just started a job (jobHistory may not have refreshed yet).
        try {
          const hasRunningInHistory = Array.isArray(jobHistory) && jobHistory.some(j => String(j.status).toLowerCase() === 'running');
          const hasCurrentJobFromBackend = normalized?.currentJob != null;
          if (normalized && normalized.state === 'running' && !hasCurrentJobFromBackend && !hasRunningInHistory) {
            normalized.state = 'failed';
            normalized.currentJob = null;
            normalized.progress = 0;
            normalized.currentStep = 1;
          }
        } catch {}

        if (normalized && normalized.state === 'running' && typeof normalized.progress === 'number' && normalized.progress >= 0.999) {
          normalized.state = 'completed';
        }
        setJobStatus(normalized);
      } catch (error) {
        console.error('Failed to get job status:', error);
      }
    };

    const interval = setInterval(pollJobStatus, 500);
    pollJobStatus();

    return () => clearInterval(interval);
  }, [jobHistory, setJobStatus]);

  // Poll for logs while running
  useEffect(() => {
    if (jobStatus.state !== 'running' && jobStatus.state !== 'starting') return;
    const interval = setInterval(() => {
      loadLogs(jobStatus.state);
    }, 2000);
    return () => clearInterval(interval);
  }, [jobStatus.state, loadLogs]);

  // Refresh while running
  useEffect(() => {
    if (jobStatus.state !== 'running') return;
    const interval = setInterval(() => {
      loadGeneratedImages();
    }, 1500);
    return () => clearInterval(interval);
  }, [jobStatus.state, loadGeneratedImages]);

  // Auto-reconcile Job History
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const hasRunningInHistory = Array.isArray(jobHistory) && jobHistory.some(j => String(j.status).toLowerCase() === 'running');
        if (hasRunningInHistory && jobStatus.state !== 'running') {
          loadJobHistory(true);
          loadStatistics();
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [jobStatus.state, jobHistory, loadJobHistory, loadStatistics]);

  // Track completion time
  useEffect(() => {
    if (jobStatus.state === 'completed') {
      lastCompletionRef.current = Date.now();
      loadJobHistory();
      loadStatistics();
      setTimeout(() => {
        loadGeneratedImages();
      }, 500);
    } else if (jobStatus.state === 'failed') {
      lastCompletionRef.current = Date.now();
      loadJobHistory();
      loadStatistics();
    } else if (jobStatus.state === 'running') {
      lastCompletionRef.current = null;
      loadJobHistory(true);
    }
  }, [jobStatus.state, loadJobHistory, loadStatistics, loadGeneratedImages]);

  return { lastCompletionRef };
};
