import { useCallback, useRef } from 'react';
import type { JobStatus, JobExecution, JobStatistics, LogEntry } from './useDashboardState';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../types/generatedImage';

const GALLERY_PAGE_SIZE = 50;

interface DashboardActionsProps {
  setJobStatus: (status: JobStatus) => void;
  setJobHistory: (history: JobExecution[]) => void;
  setStatistics: (stats: JobStatistics) => void;
  setGeneratedImages: React.Dispatch<React.SetStateAction<GeneratedImage[]>>;
  setLogs: (logs: LogEntry[]) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedImages: (ids: Set<string>) => void;
  setExportJobId: (id: string | null) => void;
  setShowSingleExportModal: (show: boolean) => void;
  setJobConfiguration: (config: any) => void;
  setGalleryHasMore: (hasMore: boolean) => void;
  onOpenSingleJobView?: (jobId: string) => void;
}

export const useDashboardActions = ({
  setJobStatus,
  setJobHistory,
  setStatistics,
  setGeneratedImages,
  setLogs,
  setError,
  setIsLoading,
  setSelectedImages,
  setExportJobId,
  setShowSingleExportModal,
  setJobConfiguration,
  setGalleryHasMore,
  onOpenSingleJobView
}: DashboardActionsProps) => {
  const galleryLoadingMoreRef = useRef(false);

  const loadJobConfiguration = useCallback(async () => {
    try {
      const configResponse = await window.electronAPI.jobManagement.getConfiguration();
      if (configResponse?.success) {
        setJobConfiguration(configResponse.settings);
      }
    } catch (error) {
      console.error('Failed to load job configuration:', error);
    }
  }, [setJobConfiguration]);

  const loadJobHistory = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const jobApi = (window as any).electronAPI?.jobManagement;
      if (!jobApi) return;

      // Use same API as Job Management panel so Dashboard and Job Management show the same list
      const response = await jobApi.getAllJobExecutions({ limit: 50 });
      let jobsArray: any[] = [];
      if (Array.isArray(response)) {
        jobsArray = [...response];
      } else if (response && typeof response === 'object' && Array.isArray((response as { executions?: unknown[] }).executions)) {
        jobsArray = [...(response as { executions: unknown[] }).executions];
      } else if (response && typeof response === 'object' && Array.isArray((response as { history?: unknown[] }).history)) {
        jobsArray = [...(response as { history: unknown[] }).history];
      }
      // Normalize displayLabel so Job History shows same labels as Job Management (avoids "Job <id>" for running reruns)
      const normalized = jobsArray.map((j: any) => {
        // Support both camelCase (IPC) and snake_case (some API shapes)
        const labelVal = j?.label ?? j?.configurationName ?? j?.configurationLabel ?? '';
        const raw = (labelVal != null && labelVal !== undefined ? String(labelVal) : '')?.trim?.() ?? '';
        let base = raw;
        if (!base) {
          const rawStarted = j?.startedAt ?? j?.started_at;
          let started: Date | null = null;
          if (rawStarted instanceof Date) {
            started = rawStarted;
          } else if (typeof rawStarted === 'string' || typeof rawStarted === 'number') {
            started = new Date(rawStarted);
          }
          if (started && !isNaN(started.getTime())) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            base = `job_${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
          } else {
            base = `Job ${j?.id ?? ''}`;
          }
        }
        const isRerun = base.endsWith('(Rerun)');
        const displayLabel = isRerun
          ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(j?.id ?? '').slice(-6)})`
          : base;
        return { ...j, displayLabel };
      });

      // Enrich running job label from getJobStatus + getJobExecution (same as Job Management panel)
      // so Dashboard shows correct label while job is processing, not only after completion
      try {
        const status = await jobApi.getJobStatus?.();
        const current = (status as { currentJob?: { executionId?: string; id?: string; label?: string; configurationName?: string; startedAt?: unknown } })?.currentJob;
        const stateStr = String((status as { state?: string })?.state ?? '').toLowerCase();
        const execId = current?.executionId ?? (current as { id?: string })?.id;
        if (current && execId && (stateStr === 'running' || stateStr === 'starting')) {
          const idx = normalized.findIndex((j: any) => String(j?.id) === String(execId));
          const runningItem = idx >= 0 ? normalized[idx] : null;
          const fallbackLabel = `Job ${execId}`;
          const hasBadLabel = runningItem && (
            (runningItem as any).displayLabel === fallbackLabel ||
            String((runningItem as any).displayLabel || '').trim() === '' ||
            (String((runningItem as any).displayLabel || '').trim() === fallbackLabel.trim())
          );
          const needsEnrich = idx >= 0 ? hasBadLabel : true; // add running job at top if missing from list
          if (needsEnrich) {
            let label = (runningItem as any)?.label ?? (current as any)?.label ?? (current as any)?.configurationName ?? '';
            let startedAt: Date | null = null;
            const rawStarted = (runningItem as any)?.startedAt ?? (runningItem as any)?.started_at ?? (current as any)?.startedAt ?? (current as any)?.startTime;
            if (rawStarted instanceof Date) startedAt = rawStarted;
            else if (typeof rawStarted === 'string' || typeof rawStarted === 'number') startedAt = new Date(rawStarted);
            if ((!label || String(label).trim() === '') && jobApi.getJobExecution) {
              const res = await jobApi.getJobExecution(execId);
              const exec = (res as { execution?: { label?: string; startedAt?: unknown } })?.execution;
              if (exec) {
                label = (exec.label ?? (exec as any).configurationName ?? '').toString().trim();
                const es = (exec as any).startedAt ?? (exec as any).started_at;
                if (es != null) startedAt = es instanceof Date ? es : new Date(es as string | number);
              }
            }
            const base = (label && String(label).trim() !== '') ? String(label).trim() : (startedAt && !isNaN(startedAt.getTime()))
              ? (() => { const pad = (n: number) => n.toString().padStart(2, '0'); return `job_${startedAt!.getFullYear()}${pad(startedAt!.getMonth() + 1)}${pad(startedAt!.getDate())}_${pad(startedAt!.getHours())}${pad(startedAt!.getMinutes())}${pad(startedAt!.getSeconds())}`; })()
              : fallbackLabel;
            const isRerun = base.endsWith('(Rerun)');
            const displayLabel = isRerun ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(execId).slice(-6)})` : base;
            if (idx >= 0) {
              normalized[idx] = { ...(normalized[idx] as object), displayLabel, label: base };
            } else {
              normalized.unshift({ id: execId, status: 'running', displayLabel, label: base, startedAt: startedAt ?? undefined } as any);
            }
          }
        }
      } catch (_) {
        // Non-fatal: list is already normalized
      }

      setJobHistory(normalized);
    } catch (error) {
      console.error('Failed to load job history:', error);
      setError('Failed to load job history');
      setJobHistory([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [setIsLoading, setError, setJobHistory]);

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await window.electronAPI.jobManagement.getJobStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }, [setStatistics]);

  const normalizeImages = useCallback((images: any[]) =>
    images.map((img: any) => ({
      ...img,
      id: String(img.id),
      executionId: img.executionId != null ? String(img.executionId) : undefined,
    })), []);

  const loadGeneratedImages = useCallback(async () => {
    try {
      const api = (window as any).electronAPI?.generatedImages;
      if (!api?.getImagesByQCStatus) return;
      const response = await api.getImagesByQCStatus('approved', { limit: GALLERY_PAGE_SIZE, offset: 0 });
      const raw = response?.images ?? [];
      const approvedImages = normalizeImages(Array.isArray(raw) ? raw : []);
      setGeneratedImages(approvedImages);
      setGalleryHasMore(!!(response?.hasMore ?? (approvedImages.length === GALLERY_PAGE_SIZE)));
      if (approvedImages.length > 0) {
        const dirs = Array.from(new Set(
          approvedImages
            .filter((img: any) => img && (img.finalImagePath || img.tempImagePath))
            .map((img: any) => String(img.finalImagePath || img.tempImagePath))
            .map((p: string) => p.replace(/\\[^/]*$/, '').replace(/\/[^/]*$/, ''))
        ));
        if (dirs.length > 0 && (window as any).electronAPI?.refreshProtocolRoots) {
          (window as any).electronAPI.refreshProtocolRoots(dirs).catch((e: unknown) => {
            console.warn('Failed to refresh protocol roots on images load (dashboard):', (e as Error)?.message || e);
          });
        }
      } else {
        setGalleryHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load generated images:', error);
      setGeneratedImages([]);
      setGalleryHasMore(false);
    }
  }, [setGeneratedImages, setGalleryHasMore, normalizeImages]);

  const loadNextGalleryPage = useCallback(async (currentLength: number) => {
    if (galleryLoadingMoreRef.current) return;
    galleryLoadingMoreRef.current = true;
    try {
      const api = (window as any).electronAPI?.generatedImages;
      if (!api?.getImagesByQCStatus) return;
      const response = await api.getImagesByQCStatus('approved', { limit: GALLERY_PAGE_SIZE, offset: currentLength });
      const raw = response?.images ?? [];
      const nextImages = normalizeImages(Array.isArray(raw) ? raw : []);
      if (nextImages.length > 0) {
        setGeneratedImages((prev) => [...prev, ...nextImages]);
      }
      setGalleryHasMore(!!(response?.hasMore ?? (nextImages.length === GALLERY_PAGE_SIZE)));
    } catch (error) {
      console.error('Failed to load next gallery page:', error);
      setGalleryHasMore(false);
    } finally {
      galleryLoadingMoreRef.current = false;
    }
  }, [setGeneratedImages, setGalleryHasMore, normalizeImages]);

  const loadLogs = useCallback(async (jobState: string) => {
    try {
      if (jobState !== 'running') {
        // (Grace period logic will stay in component or moved to polling)
        // setLogs([]);
        // return;
      }
      let mode = 'standard';
      try {
        const settingsRes: any = await (window as any).electronAPI.getSettings?.();
        if (settingsRes?.settings?.advanced?.debugMode) {
          mode = 'debug';
        }
      } catch (e) {}

      const jobLogs = await window.electronAPI.jobManagement.getJobLogs(mode);
      if (jobLogs && Array.isArray(jobLogs)) {
        setLogs(jobLogs);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
    }
  }, [setLogs]);

  const handleStartJob = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const configResponse = await window.electronAPI.jobManagement.getConfiguration();
      if (!configResponse.success || !configResponse.settings) {
        throw new Error('Failed to load configuration');
      }
      const config = configResponse.settings;
      await window.electronAPI.jobManagement.jobStart(config);
      await Promise.all([loadJobHistory(), loadStatistics()]);
    } catch (error) {
      console.error('Failed to start job:', error);
      setError('Failed to start job');
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, loadJobHistory, loadStatistics]);

  const handleStopJob = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await window.electronAPI.jobManagement.jobStop();
      await Promise.all([loadJobHistory(), loadStatistics()]);
    } catch (error) {
      setError('Failed to stop job');
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, loadJobHistory, loadStatistics]);

  const handleForceStop = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await window.electronAPI.jobManagement.jobForceStop();
      await Promise.all([loadJobHistory(), loadStatistics()]);
    } catch (error) {
      setError('Failed to force stop job');
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, loadJobHistory, loadStatistics]);

  const handleJobAction = useCallback(async (action: string, jobId: string) => {
    try {
      setError(null);
      switch (action) {
        case 'view':
          onOpenSingleJobView && onOpenSingleJobView(jobId);
          break;
        case 'export':
          setExportJobId(jobId);
          setShowSingleExportModal(true);
          break;
        case 'delete':
          await window.electronAPI.jobManagement.deleteJobExecution(jobId);
          await loadJobHistory();
          await loadStatistics();
          break;
        case 'rerun':
          const rerunResult = await window.electronAPI.jobManagement.rerunJobExecution(jobId);
          if (rerunResult && rerunResult.success) {
            setTimeout(async () => {
              await loadJobHistory();
              await loadStatistics();
            }, 1000);
          } else {
            setError(`Failed to rerun job: ${rerunResult?.error || 'Unknown error'}`);
          }
          break;
      }
    } catch (error: any) {
      setError(`Failed to ${action} job`);
    }
  }, [setError, onOpenSingleJobView, setExportJobId, setShowSingleExportModal, loadJobHistory, loadStatistics]);

  const handleImageAction = useCallback(async (action: string, imageId: string, data?: any) => {
    try {
      setError(null);
      switch (action) {
        case 'delete':
          await window.electronAPI.jobManagement.deleteGeneratedImage(imageId);
          await loadGeneratedImages();
          break;
        case 'update-qc-status':
          if (data) {
            await window.electronAPI.jobManagement.updateQCStatus(imageId, data);
            await loadGeneratedImages();
          }
          break;
      }
    } catch (error) {
      setError(`Failed to ${action} image`);
    }
  }, [setError, loadGeneratedImages]);

  const handleBulkAction = useCallback(async (action: string, imageIds: string[]) => {
    try {
      setError(null);
      if (imageIds.length === 0) return;
      switch (action) {
        case 'delete':
          await window.electronAPI.jobManagement.bulkDeleteImages(imageIds);
          setSelectedImages(new Set());
          break;
      }
      await loadGeneratedImages();
    } catch (error) {
      setError(`Failed to bulk ${action} images`);
    }
  }, [setError, setSelectedImages, loadGeneratedImages]);

  return {
    loadJobHistory,
    loadStatistics,
    loadGeneratedImages,
    loadNextGalleryPage,
    loadLogs,
    loadJobConfiguration,
    handleStartJob,
    handleStopJob,
    handleForceStop,
    handleJobAction,
    handleImageAction,
    handleBulkAction
  };
};
