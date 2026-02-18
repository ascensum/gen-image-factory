/**
 * Story 3.4 Phase 5b: Single job actions (tabs, back, rerun, export, delete).
 * Extracted from SingleJobView.tsx.
 */
import { useState, useCallback } from 'react';

export function useSingleJobActions(
  jobId: string | number,
  onBack: () => void,
  onRerun: (jobId: string | number) => void,
  onDelete: (jobId: string | number) => void,
  refreshLogs: () => Promise<void>
) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'logs') {
      refreshLogs();
    }
  }, [refreshLogs]);

  const handleBack = useCallback(() => onBack(), [onBack]);
  const handleExport = useCallback(() => setShowExportDialog(true), []);
  const handleRerun = useCallback(() => onRerun(jobId), [onRerun, jobId]);
  const handleDelete = useCallback(() => setShowDeleteConfirm(true), []);
  const handleConfirmDelete = useCallback(() => {
    onDelete(jobId);
    setShowDeleteConfirm(false);
  }, [onDelete, jobId]);
  const handleCancelDelete = useCallback(() => setShowDeleteConfirm(false), []);

  return {
    activeTab,
    setActiveTab,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showExportDialog,
    setShowExportDialog,
    handleTabChange,
    handleBack,
    handleExport,
    handleRerun,
    handleDelete,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
