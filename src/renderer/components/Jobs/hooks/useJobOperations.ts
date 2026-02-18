/**
 * Story 3.4 Phase 4: Job selection, bulk actions, single-job actions, export.
 * Extracted from JobManagementPanel.tsx (frozen).
 */
import { useState, useCallback, useEffect } from 'react';
import type { JobExecution } from '../../../../types/job';

export interface UseJobOperationsOptions {
  paginatedJobs: JobExecution[];
  loadJobs: (silent?: boolean) => Promise<void>;
  refreshCounts: () => Promise<void>;
  onOpenSingleJob: (jobId: string | number) => void;
}

export function useJobOperations(options: UseJobOperationsOptions) {
  const { paginatedJobs, loadJobs, refreshCounts, onOpenSingleJob } = options;
  const [selectedJobs, setSelectedJobs] = useState<Set<string | number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<'single' | 'bulk'>('single');
  const [exportJobId, setExportJobId] = useState<string | number | null>(null);

  const getDisplayLabel = useCallback((job: JobExecution) => {
    const prefer = (job as any).displayLabel || job.label || (job as any).configurationName;
    if (prefer && String(prefer).trim() !== '') {
      const base = String(prefer).trim();
      const isRerun = base.endsWith('(Rerun)');
      return isRerun ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(job.id).slice(-6)})` : base;
    }
    const started = job.startedAt ? new Date(job.startedAt as any) : null;
    if (started && !isNaN(started.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
      return `job_${ts}`;
    }
    return `Job ${job.id}`;
  }, []);

  const handleJobSelect = useCallback((jobId: string | number, selected: boolean) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (selected) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) setSelectedJobs(new Set(paginatedJobs.map((j) => j.id)));
    else setSelectedJobs(new Set());
  }, [paginatedJobs]);

  const handleBulkRerun = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    try {
      setIsProcessing(true);
      const jobIds = Array.from(selectedJobs);
      const result = await (window as any).electronAPI.jobManagement.bulkRerunJobExecutions(jobIds);
      if (result?.success) {
        await loadJobs();
        await refreshCounts();
        setSelectedJobs(new Set());
      } else {
        alert(`Bulk rerun failed: ${(result as any)?.error || 'Unknown error'}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Error rerunning jobs: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs, loadJobs, refreshCounts]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    try {
      setIsProcessing(true);
      const jobIds = Array.from(selectedJobs);
      for (const jobId of jobIds) {
        await (window as any).electronAPI.jobManagement.deleteJobExecution(jobId);
      }
      await loadJobs();
      await refreshCounts();
      setSelectedJobs(new Set());
    } catch (err) {
      console.error('Error deleting jobs:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs, loadJobs, refreshCounts]);

  const handleOpenSingleJob = useCallback((jobId: string | number) => {
    onOpenSingleJob(jobId);
  }, [onOpenSingleJob]);

  const handleRerunSingle = useCallback(async (jobId: string | number) => {
    try {
      const result = await (window as any).electronAPI.jobManagement.rerunJobExecution(jobId);
      if (result?.success) {
        setTimeout(() => loadJobs(), 1000);
      } else {
        window.alert(result?.error || 'Failed to start rerun');
        loadJobs();
      }
    } catch (err) {
      console.error('Failed to rerun job:', err);
      window.alert((err as Error)?.message || 'Failed to start rerun');
      loadJobs();
    }
  }, [loadJobs]);

  const handleDeleteSingle = useCallback(async (jobId: string | number) => {
    try {
      const result = await (window as any).electronAPI.jobManagement.deleteJobExecution(jobId);
      if (result?.success) await loadJobs();
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  }, [loadJobs]);

  const openExportSingle = useCallback((jobId: string | number) => {
    setExportType('single');
    setExportJobId(jobId);
    setShowExportDialog(true);
  }, []);

  const openExportBulk = useCallback(() => {
    setExportType('bulk');
    setExportJobId(null);
    setShowExportDialog(true);
  }, []);

  const closeExportDialog = useCallback(() => {
    setShowExportDialog(false);
    setExportType('single');
    setExportJobId(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        handleSelectAll(true);
      }
      if (e.key === 'Delete' && selectedJobs.size > 0) {
        e.preventDefault();
        handleBulkDelete();
      }
      if (e.key === 'Escape') {
        setSelectedJobs(new Set());
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedJobs.size, handleSelectAll, handleBulkDelete]);

  return {
    selectedJobs,
    setSelectedJobs,
    isProcessing,
    showExportDialog,
    exportType,
    exportJobId,
    setShowExportDialog,
    setExportType,
    setExportJobId,
    getDisplayLabel,
    handleJobSelect,
    handleSelectAll,
    handleBulkRerun,
    handleBulkDelete,
    handleOpenSingleJob,
    handleRerunSingle,
    handleDeleteSingle,
    openExportSingle,
    openExportBulk,
    closeExportDialog,
  };
}
