import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { JobExecution, JobFilters } from '../../types/job';
import JobStatistics from './JobStatistics';
import JobFilters from './JobFilters';
import JobTable from './JobTable';
import BatchOperationsToolbar from './BatchOperationsToolbar';

interface JobManagementPanelProps {
  onBack: () => void;
  onOpenSingleJobView: (jobId: string) => void;
  onOpenSettings?: () => void;
}

const JobManagementPanel: React.FC<JobManagementPanelProps> = ({
  onBack,
  onOpenSingleJobView,
  onOpenSettings
}) => {
  // State management
  const [jobs, setJobs] = useState<JobExecution[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<JobFilters>({
    status: 'all',
    limit: 25,
    offset: 0
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    column: keyof JobExecution;
    direction: 'asc' | 'desc';
  }>({
    column: 'startedAt',
    direction: 'desc'
  });

  // Batch operation states
  const [isRerunInProgress, setIsRerunInProgress] = useState(false);
  const [isExportInProgress, setIsExportInProgress] = useState(false);
  const [isDeleteInProgress, setIsDeleteInProgress] = useState(false);
  const [rerunProgress, setRerunProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [queuedJobs, setQueuedJobs] = useState(0);

  // Load jobs with filters
  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.getJobExecutionsWithFilters(filters);
      if (result.success && result.executions) {
        setJobs(result.executions);
      } else {
        setError(result.error || 'Failed to load jobs');
        setJobs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Load total count
  const loadTotalCount = useCallback(async () => {
    try {
      const result = await window.electronAPI.getJobExecutionsCount(filters);
      if (result.success && result.count !== undefined) {
        setTotalCount(result.count);
      }
    } catch (err) {
      console.error('Failed to load job count:', err);
    }
  }, [filters]);

  // Load data on mount and filter changes
  useEffect(() => {
    loadJobs();
    loadTotalCount();
  }, [loadJobs, loadTotalCount]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: JobFilters) => {
    setFilters(newFilters);
    setSelectedJobs(new Set()); // Clear selection when filters change
  }, []);

  // Handle job selection
  const handleJobSelect = useCallback((jobId: string, selected: boolean) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(jobId);
      } else {
        newSet.delete(jobId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedJobs(new Set(jobs.map(job => job.id)));
    } else {
      setSelectedJobs(new Set());
    }
  }, [jobs]);

  // Handle job actions
  const handleJobAction = useCallback((action: 'view' | 'export' | 'rerun' | 'delete', jobId: string) => {
    switch (action) {
      case 'view':
        onOpenSingleJobView(jobId);
        break;
      case 'export':
        // Handle single job export
        break;
      case 'rerun':
        // Handle single job rerun
        break;
      case 'delete':
        // Handle single job delete
        break;
    }
  }, [onOpenSingleJobView]);

  // Handle job label edit
  const handleJobLabelEdit = useCallback(async (jobId: string, newLabel: string) => {
    try {
      const result = await window.electronAPI.renameJobExecution(jobId, newLabel);
      if (result.success) {
        // Update local state
        setJobs(prev => prev.map(job => 
          job.id === jobId ? { ...job, label: newLabel } : job
        ));
      } else {
        throw new Error(result.error || 'Failed to rename job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename job');
      // Reload jobs to get the original state
      loadJobs();
    }
  }, [loadJobs]);

  // Handle sort change
  const handleSortChange = useCallback((column: keyof JobExecution, direction: 'asc' | 'desc') => {
    setSortConfig({ column, direction });
    // Note: In a real implementation, you'd send the sort to the backend
    // For now, we'll just update the local state
  }, []);

  // Handle batch operations
  const handleBatchRerun = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    setIsRerunInProgress(true);
    setRerunProgress(0);
    
    try {
      const result = await window.electronAPI.bulkRerunJobExecutions(Array.from(selectedJobs));
      if (result.success) {
        setQueuedJobs(result.queuedJobs || 0);
        setSelectedJobs(new Set()); // Clear selection
        // Reload jobs to show updated statuses
        loadJobs();
      } else {
        setError(result.error || 'Failed to rerun jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rerun jobs');
    } finally {
      setIsRerunInProgress(false);
      setRerunProgress(0);
    }
  }, [selectedJobs, loadJobs]);

  const handleBatchExport = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    setIsExportInProgress(true);
    setExportProgress(0);
    
    try {
      const result = await window.electronAPI.bulkExportJobExecutions(Array.from(selectedJobs));
      if (result.success) {
        setSelectedJobs(new Set()); // Clear selection
        // Show success message
        console.log('Export completed successfully');
      } else {
        setError(result.error || 'Failed to export jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export jobs');
    } finally {
      setIsExportInProgress(false);
      setExportProgress(0);
    }
  }, [selectedJobs]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedJobs.size} job(s)? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    setIsDeleteInProgress(true);
    setDeleteProgress(0);
    
    try {
      const result = await window.electronAPI.bulkDeleteJobExecutions(Array.from(selectedJobs));
      if (result.success) {
        setSelectedJobs(new Set()); // Clear selection
        // Reload jobs to show updated list
        loadJobs();
        loadTotalCount();
      } else {
        setError(result.error || 'Failed to delete jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete jobs');
    } finally {
      setIsDeleteInProgress(false);
      setDeleteProgress(0);
    }
  }, [selectedJobs, loadJobs, loadTotalCount]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedJobs(new Set());
  }, []);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      status: 'all',
      limit: 25,
      offset: 0
    });
    setSelectedJobs(new Set());
  }, []);

  // Memoized sorted jobs
  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      const aValue = a[sortConfig.column];
      const bValue = b[sortConfig.column];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    return sorted;
  }, [jobs, sortConfig]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Job Management</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadJobs}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Refresh
              </button>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Settings
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Statistics */}
        <JobStatistics totalCount={totalCount} />

        {/* Filters */}
        <div className="mt-6">
          <JobFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            availableConfigurations={[]} // TODO: Load from backend
            isLoading={isLoading}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
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
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Job Table */}
        <div className="mt-6">
          <JobTable
            jobs={sortedJobs}
            selectedJobs={selectedJobs}
            onJobSelect={handleJobSelect}
            onSelectAll={handleSelectAll}
            onJobAction={handleJobAction}
            onJobLabelEdit={handleJobLabelEdit}
            sortConfig={sortConfig}
            onSortChange={handleSortChange}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Batch Operations Toolbar */}
        {selectedJobs.size > 0 && (
          <div className="mt-6">
            <BatchOperationsToolbar
              selectedJobs={selectedJobs}
              totalJobs={totalCount}
              onClearSelection={handleClearSelection}
              onBatchRerun={handleBatchRerun}
              onBatchExport={handleBatchExport}
              onBatchDelete={handleBatchDelete}
              isRerunInProgress={isRerunInProgress}
              isExportInProgress={isExportInProgress}
              isDeleteInProgress={isDeleteInProgress}
              rerunProgress={rerunProgress}
              exportProgress={exportProgress}
              deleteProgress={deleteProgress}
              queuedJobs={queuedJobs}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default JobManagementPanel;
