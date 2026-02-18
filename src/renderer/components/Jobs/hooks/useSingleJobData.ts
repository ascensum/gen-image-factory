/**
 * Story 3.4 Phase 5b: Single job data loading, job/images/logs/configuration.
 * Extracted from SingleJobView.tsx.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JobExecution } from '../../../../../types/job';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../../types/generatedImage';

export function useSingleJobData(jobId: string | number) {
  const [job, setJob] = useState<JobExecution | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobConfiguration, setJobConfiguration] = useState<any>(null);
  const labelUpdateTimerRef = useRef<number | null>(null);

  const overviewSettings = useMemo(() => {
    return (job as any)?.configurationSnapshot || jobConfiguration?.settings || null;
  }, [job, jobConfiguration]);

  const getDisplayLabel = useCallback(() => {
    const jobLabel = job?.label;
    if (jobLabel && jobLabel.trim() !== '') {
      const isRerun = jobLabel.endsWith('(Rerun)');
      return isRerun ? jobLabel.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(job?.id).slice(-6)})` : jobLabel;
    }
    const started = job?.startedAt ? new Date(job.startedAt as any) : null;
    if (started && !isNaN(started.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
      return `job_${ts}`;
    }
    return `Job ${job?.id ?? ''}`.trim();
  }, [job]);

  const loadJobData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobResult = await window.electronAPI.jobManagement.getJobExecution(jobId);
      if (jobResult.success) {
        setJob(jobResult.execution);
        if (jobResult.execution.id) {
          try {
            const statsResult = await window.electronAPI.calculateJobExecutionStatistics(jobResult.execution.id);
            if (statsResult.success) {
              setJob((prevJob) => {
                const base = prevJob ?? ({} as JobExecution);
                return {
                  ...(base as any),
                  id: base?.id ?? jobResult.execution.id,
                  configurationId: base?.configurationId ?? jobResult.execution.configurationId,
                  configurationName: (base as any)?.configurationName,
                  startedAt: base?.startedAt ?? jobResult.execution.startedAt,
                  completedAt: base?.completedAt ?? jobResult.execution.completedAt,
                  status: (base as any)?.status ?? jobResult.execution.status,
                  totalImages: statsResult.statistics.totalImages,
                  successfulImages: statsResult.statistics.successfulImages,
                  failedImages: statsResult.statistics.failedImages,
                  approvedImages: (statsResult.statistics as any).approvedImages,
                  qcFailedImages: (statsResult.statistics as any).qcFailedImages,
                  label: base?.label ?? jobResult.execution.label,
                } as JobExecution;
              });
            }
          } catch (statsError) {
            console.warn('Failed to calculate statistics:', statsError);
          }
        }
      } else {
        setError(jobResult.error || 'Failed to load job details');
      }

      const execution = jobResult?.execution;
      if (execution?.id) {
        const imagesResult = await window.electronAPI.generatedImages.getGeneratedImagesByExecution(execution.id);
        if (imagesResult.success) {
          setImages(imagesResult.images || []);
        } else {
          setImages([]);
        }
      } else {
        setImages([]);
      }

      try {
        const jobLogs = await window.electronAPI.jobManagement.getJobLogs('standard');
        setLogs(Array.isArray(jobLogs) ? jobLogs : []);
      } catch {
        setLogs([]);
      }

      if (execution?.configurationId) {
        try {
          const configResult = await window.electronAPI.getJobConfigurationById(execution.configurationId);
          if (configResult.success && configResult.configuration) {
            setJobConfiguration(configResult.configuration);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Error loading job data:', err);
      setError('Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJobData();
  }, [loadJobData]);

  useEffect(() => {
    async function tick() {
      try {
        const status: any = await (window as any).electronAPI?.jobManagement?.getJobStatus?.();
        const live = status?.currentJob;
        if (live && String(live?.executionId || '') === String(job?.id || '')) {
          const lbl = String(live?.label || '').trim();
          if (lbl) {
            setJob((prev) => (prev ? ({ ...prev, label: lbl }) as JobExecution : prev));
          }
        }
      } catch {}
    }
    if (job && String(job.status).toLowerCase() === 'running') {
      tick();
      const id = window.setInterval(tick, 1500);
      labelUpdateTimerRef.current = id as unknown as number;
      return () => {
        if (labelUpdateTimerRef.current) {
          window.clearInterval(labelUpdateTimerRef.current);
          labelUpdateTimerRef.current = null;
        }
      };
    }
  }, [job?.id, job?.status]);

  const refreshLogs = useCallback(async () => {
    try {
      let mode = 'standard';
      try {
        const settingsRes = await (window as any).electronAPI.getSettings?.();
        if (settingsRes?.settings?.advanced?.debugMode) mode = 'debug';
      } catch {}
      const jobLogs = await (window as any).electronAPI.jobManagement.getJobLogs(mode);
      setLogs(Array.isArray(jobLogs) ? jobLogs : []);
    } catch {
      setLogs([]);
    }
  }, []);

  return {
    job,
    setJob,
    images,
    setImages,
    logs,
    setLogs,
    isLoading,
    error,
    jobConfiguration,
    setJobConfiguration,
    overviewSettings,
    getDisplayLabel,
    loadJobData,
    refreshLogs,
  };
}
