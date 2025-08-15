import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JobExecution, JobFilters } from '../../../types/job';
import JobStatistics from './JobStatistics';
import JobFiltersComponent from './JobFilters';
import JobTable from './JobTable';
import BatchOperationsToolbar from './BatchOperationsToolbar';

interface JobManagementPanelProps {
  onOpenSingleJob: (jobId: string | number) => void;
}

const JobManagementPanel: React.FC<JobManagementPanelProps> = ({ onOpenSingleJob }) => {
  // State management
  const [jobs, setJobs] = useState<JobExecution[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string | number>>(new Set());
  const [filters, setFilters] = useState<JobFilters>({
    status: 'all',
    dateRange: 'all',
    label: '',
    minImages: 0,
    maxImages: null
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof JobExecution>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalJobs, setTotalJobs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for performance optimization
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSearchQueryRef = useRef<string>('');

  // Memoized computed values
  const filteredJobs = useMemo(() => {
    if (!jobs.length) return [];
    
    let filtered = [...jobs];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.label?.toLowerCase().includes(query) ||
        job.id.toString().includes(query) ||
        job.status.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(job => job.status === filters.status);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const jobDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          jobDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(job => new Date(job.createdAt) >= jobDate);
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          filtered = filtered.filter(job => {
            const jobCreated = new Date(job.createdAt);
            return jobCreated >= yesterday && jobCreated < today;
          });
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(job => new Date(job.createdAt) >= weekAgo);
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filtered = filtered.filter(job => new Date(job.createdAt) >= monthAgo);
          break;
        case 'quarter':
          const quarterAgo = new Date(now);
          quarterAgo.setMonth(quarterAgo.getMonth() - 3);
          filtered = filtered.filter(job => new Date(job.createdAt) >= quarterAgo);
          break;
        case 'year':
          const yearAgo = new Date(now);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          filtered = filtered.filter(job => new Date(job.createdAt) >= yearAgo);
          break;
      }
    }

    // Apply label filter
    if (filters.label.trim()) {
      const labelQuery = filters.label.toLowerCase();
      filtered = filtered.filter(job => 
        job.label?.toLowerCase().includes(labelQuery)
      );
    }

    // Apply image count filters
    if (filters.minImages > 0) {
      filtered = filtered.filter(job => (job.imageCount || 0) >= filters.minImages);
    }
    if (filters.maxImages !== null) {
      filtered = filtered.filter(job => (job.imageCount || 0) <= filters.maxImages);
    }

    return filtered;
  }, [jobs, searchQuery, filters]);

  const sortedJobs = useMemo(() => {
    if (!filteredJobs.length) return [];
    
    const sorted = [...filteredJobs].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField === 'createdAt' || sortField === 'startedAt' || sortField === 'completedAt') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      // Handle numeric fields
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string fields
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

      return 0;
    });

    return sorted;
  }, [filteredJobs, sortField, sortDirection]);

  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedJobs.slice(startIndex, endIndex);
  }, [sortedJobs, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(sortedJobs.length / pageSize);
  }, [sortedJobs.length, pageSize]);

  const statistics = useMemo(() => {
    const completed = jobs.filter(job => job.status === 'completed').length;
    const failed = jobs.filter(job => job.status === 'failed').length;
    const processing = jobs.filter(job => job.status === 'processing').length;
    const pending = jobs.filter(job => job.status === 'pending').length;
    
    const totalImages = jobs.reduce((sum, job) => sum + (job.imageCount || 0), 0);
    const averageImagesPerJob = jobs.length > 0 ? totalImages / jobs.length : 0;

    return {
      totalJobs: jobs.length,
      completedJobs: completed,
      failedJobs: failed,
      processingJobs: processing,
      pendingJobs: pending,
      totalImages,
      averageImagesPerJob
    };
  }, [jobs]);

  // Debounced search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      lastSearchQueryRef.current = query;
      // Additional search logic can be added here if needed
    }, 300);
  }, []);

  // Load jobs from backend
  const loadJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.getJobExecutionsWithFilters(filters, currentPage, pageSize);
      
      if (result.success) {
        setJobs(result.jobs);
        setTotalJobs(result.totalCount);
      } else {
        throw new Error(result.error || 'Failed to load jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      console.error('Error loading jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, pageSize]);

  // Load jobs on mount and when dependencies change
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: JobFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle sorting
  const handleSort = useCallback((field: keyof JobExecution, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Handle job selection
  const handleJobSelect = useCallback((jobId: string | number, selected: boolean) => {
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

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedJobs(new Set(paginatedJobs.map(job => job.id)));
    } else {
      setSelectedJobs(new Set());
    }
  }, [paginatedJobs]);

  // Handle job actions
  const handleJobRename = useCallback(async (jobId: string | number, newLabel: string) => {
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
      console.error('Error renaming job:', err);
      // You might want to show a toast notification here
    }
  }, []);

  const handleBulkRerun = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    try {
      setIsProcessing(true);
      const jobIds = Array.from(selectedJobs);
      
      // Process jobs sequentially to avoid overwhelming the system
      for (const jobId of jobIds) {
        await window.electronAPI.rerunJobExecution(jobId);
      }
      
      // Refresh jobs and clear selection
      await loadJobs();
      setSelectedJobs(new Set());
      
    } catch (err) {
      console.error('Error rerunning jobs:', err);
      // You might want to show a toast notification here
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs, loadJobs]);

  const handleBulkExport = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    try {
      setIsProcessing(true);
      const jobIds = Array.from(selectedJobs);
      
      // Export jobs sequentially
      for (const jobId of jobIds) {
        await window.electronAPI.exportJobExecution(jobId);
      }
      
      // Clear selection after export
      setSelectedJobs(new Set());
      
    } catch (err) {
      console.error('Error exporting jobs:', err);
      // You might want to show a toast notification here
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    try {
      setIsProcessing(true);
      const jobIds = Array.from(selectedJobs);
      
      // Delete jobs sequentially
      for (const jobId of jobIds) {
        await window.electronAPI.deleteJobExecution(jobId);
      }
      
      // Refresh jobs and clear selection
      await loadJobs();
      setSelectedJobs(new Set());
      
    } catch (err) {
      console.error('Error deleting jobs:', err);
      // You might want to show a toast notification here
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs, loadJobs]);

  // Handle single job view
  const handleOpenSingleJob = useCallback((jobId: string | number) => {
    onOpenSingleJob(jobId);
  }, [onOpenSingleJob]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A to select all
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        handleSelectAll(true);
      }
      
      // Delete key to delete selected jobs
      if (e.key === 'Delete' && selectedJobs.size > 0) {
        e.preventDefault();
        handleBulkDelete();
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        setSelectedJobs(new Set());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedJobs.size, handleSelectAll, handleBulkDelete]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" role="main" aria-label="Job Management Error">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Jobs</h3>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <button
                onClick={loadJobs}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Retry loading jobs"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" role="main" aria-label="Job Management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Job Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor and manage your image generation jobs, view statistics, and perform batch operations.
          </p>
        </div>

        {/* Statistics */}
        <JobStatistics
          {...statistics}
          isLoading={isLoading}
        />

        {/* Filters and Search */}
        <JobFiltersComponent
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          totalJobs={totalJobs}
          filteredJobs={sortedJobs.length}
        />

        {/* Batch Operations Toolbar */}
        <BatchOperationsToolbar
          selectedCount={selectedJobs.size}
          totalJobs={paginatedJobs.length}
          onBulkRerun={handleBulkRerun}
          onBulkExport={handleBulkExport}
          onBulkDelete={handleBulkDelete}
          onSelectAll={handleSelectAll}
          isAllSelected={paginatedJobs.length > 0 && paginatedJobs.every(job => selectedJobs.has(job.id))}
          isIndeterminate={selectedJobs.size > 0 && selectedJobs.size < paginatedJobs.length}
          isLoading={isProcessing}
          disabled={isLoading}
        />

        {/* Jobs Table */}
        <JobTable
          jobs={paginatedJobs}
          selectedJobs={selectedJobs}
          onJobSelect={handleJobSelect}
          onJobRename={handleJobRename}
          onSort={handleSort}
          sortField={sortField}
          sortDirection={sortDirection}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center px-4 py-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Loading jobs...
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sortedJobs.length === 0 && (
          <div className="mt-6 text-center">
            <div className="bg-white rounded-lg shadow p-6">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || Object.values(filters).some(v => v !== 'all' && v !== '' && v !== 0 && v !== null)
                  ? 'Try adjusting your filters or search criteria.'
                  : 'No jobs have been executed yet.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobManagementPanel;
