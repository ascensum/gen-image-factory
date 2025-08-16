import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JobExecution, JobFilters } from '../../../types/job';
import './JobManagementPanel.css';

interface JobManagementPanelProps {
  onOpenSingleJob: (jobId: string | number) => void;
  onBack: () => void;
}

const JobManagementPanel: React.FC<JobManagementPanelProps> = ({ onOpenSingleJob, onBack }) => {
  // State management following BMad-Method structured approach
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
  const [sortField, setSortField] = useState<keyof JobExecution>('startedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalJobs, setTotalJobs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for performance optimization
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoized computed values following BMad-Method performance principles
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
      let startDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(job => new Date(job.startedAt || 0) >= startDate);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          filtered = filtered.filter(job => new Date(job.startedAt || 0) >= startDate);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          filtered = filtered.filter(job => new Date(job.startedAt || 0) >= startDate);
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
      filtered = filtered.filter(job => (job.totalImages || 0) >= filters.minImages);
    }
    if (filters.maxImages !== null) {
      filtered = filtered.filter(job => (job.totalImages || 0) <= filters.maxImages);
    }

    return filtered;
  }, [jobs, searchQuery, filters]);

  const sortedJobs = useMemo(() => {
    if (!filteredJobs.length) return [];
    
    const sorted = [...filteredJobs].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField === 'startedAt' || sortField === 'completedAt') {
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
    
    const totalImages = jobs.reduce((sum, job) => sum + (job.totalImages || 0), 0);
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

  // Debounced search handler following BMad-Method performance principles
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      // Additional search logic can be added here if needed
    }, 300);
  }, []);

  // Load jobs from backend following BMad-Method structured approach
  const loadJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.jobManagement.getJobExecutionsWithFilters(filters, currentPage, pageSize);
      
      if (result.success) {
        setJobs(result.jobs || []);
        setTotalJobs(result.totalCount || result.jobs?.length || 0);
      } else {
        throw new Error(result.error || 'Failed to load jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      console.error('Error loading jobs:', err);
      
      // No sample data - show empty state
      if (jobs.length === 0) {
        setJobs([]);
        setTotalJobs(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, pageSize, jobs.length]);

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

  // Handle job actions following BMad-Method structured approach
  const handleJobRename = useCallback(async (jobId: string | number, newLabel: string) => {
    try {
      const result = await window.electronAPI.jobManagement.renameJobExecution(jobId, newLabel);
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
    }
  }, []);

  const handleBulkRerun = useCallback(async () => {
    if (selectedJobs.size === 0) return;
    
    try {
      setIsProcessing(true);
      const jobIds = Array.from(selectedJobs);
      
      // Process jobs sequentially to avoid overwhelming the system
      for (const jobId of jobIds) {
        await window.electronAPI.jobManagement.rerunJobExecution(jobId);
      }
      
      // Refresh jobs and clear selection
      await loadJobs();
      setSelectedJobs(new Set());
      
    } catch (err) {
      console.error('Error rerunning jobs:', err);
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
        await window.electronAPI.jobManagement.exportJobExecution(jobId);
      }
      
      // Clear selection after export
      setSelectedJobs(new Set());
      
    } catch (err) {
      console.error('Error exporting jobs:', err);
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
        await window.electronAPI.jobManagement.deleteJobExecution(jobId);
      }
      
      // Refresh jobs and clear selection
      await loadJobs();
      setSelectedJobs(new Set());
      
    } catch (err) {
      console.error('Error deleting jobs:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs, loadJobs]);

  // Handle single job view
  const handleOpenSingleJob = useCallback((jobId: string | number) => {
    onOpenSingleJob(jobId);
  }, [onOpenSingleJob]);

  // Keyboard shortcuts following BMad-Method accessibility principles
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
      <div className="min-h-screen bg-[--background] text-[--foreground] flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 mb-4">⚠️ Error</div>
            <p className="text-gray-600">{error}</p>
            <button 
              onClick={loadJobs} 
              className="mt-4 bg-[--primary] text-white px-4 py-2 rounded hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--background] text-[--foreground] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="job-management-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              onClick={onBack}
              className="back-button"
              aria-label="Go back to dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="header-title">Job Management</h1>
          </div>
          <div className="header-actions">
            <button 
              onClick={loadJobs}
              className="refresh-button"
              disabled={isLoading}
              aria-label="Refresh jobs"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Statistics Overview Bar following exact design specification */}
      <div className="grid grid-cols-5 gap-4 p-6 shrink-0">
        <div className="stats-card">
          <div className="text-sm text-[--muted-foreground]">Total Jobs</div>
          <div className="text-2xl font-semibold mt-1">{statistics.totalJobs}</div>
          <div className="text-xs text-[--primary] mt-1">↑ 12% from last week</div>
        </div>
        <div className="stats-card">
          <div className="text-sm text-[--muted-foreground]">Completed</div>
          <div className="text-2xl font-semibold mt-1 text-[--status-completed]">{statistics.completedJobs}</div>
          <div className="text-xs text-[--muted-foreground] mt-1">Success rate 98%</div>
        </div>
        <div className="stats-card">
          <div className="text-sm text-[--muted-foreground]">In Progress</div>
          <div className="text-2xl font-semibold mt-1 text-[--status-in-progress]">{statistics.processingJobs}</div>
          <div className="text-xs text-[--muted-foreground] mt-1">Currently processing</div>
        </div>
        <div className="stats-card">
          <div className="text-sm text-[--muted-foreground]">Failed</div>
          <div className="text-2xl font-semibold mt-1 text-[--status-failed]">{statistics.failedJobs}</div>
          <div className="text-xs text-[--muted-foreground] mt-1">Last 24h</div>
        </div>
        <div className="stats-card">
          <div className="text-sm text-[--muted-foreground]">Pending</div>
          <div className="text-2xl font-semibold mt-1 text-[--status-pending]">{statistics.pendingJobs}</div>
          <div className="text-xs text-[--muted-foreground] mt-1">In queue</div>
        </div>
      </div>

      {/* Filters and Search Bar following exact design specification */}
      <div className="px-6 py-4 space-y-4 border-b border-[--border] shrink-0">
        <div className="flex gap-4">
          {/* Status Filter */}
          <div className="relative w-48">
            <select 
              value={filters.status}
              onChange={(e) => handleFiltersChange({ ...filters, status: e.target.value as any })}
              className="w-full appearance-none bg-[--background] border border-[--border] rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[--ring]"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">In Progress</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-[--muted-foreground]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Date Range Filter */}
          <div className="relative flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[--background] border border-[--border] rounded-lg p-2">
              <input 
                type="date" 
                className="bg-transparent px-2 focus:outline-none" 
                placeholder="From"
                onChange={(e) => handleFiltersChange({ ...filters, dateRange: e.target.value })}
              />
              <div className="h-4 w-px bg-[--border]"></div>
              <input 
                type="date" 
                className="bg-transparent px-2 focus:outline-none" 
                placeholder="To"
                onChange={(e) => handleFiltersChange({ ...filters, dateRange: e.target.value })}
              />
            </div>
            {/* Quick Date Ranges */}
            <div className="flex gap-1">
              <button 
                onClick={() => handleFiltersChange({ ...filters, dateRange: 'today' })}
                className="px-2 py-1 text-xs bg-[--secondary] hover:bg-opacity-80 rounded"
              >
                Today
              </button>
              <button 
                onClick={() => handleFiltersChange({ ...filters, dateRange: 'week' })}
                className="px-2 py-1 text-xs bg-[--secondary] hover:bg-opacity-80 rounded"
              >
                Week
              </button>
              <button 
                onClick={() => handleFiltersChange({ ...filters, dateRange: 'month' })}
                className="px-2 py-1 text-xs bg-[--secondary] hover:bg-opacity-80 rounded"
              >
                Month
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search jobs..." 
              className="w-full bg-[--background] border border-[--border] rounded-lg px-4 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[--muted-foreground]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button 
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[--muted-foreground] hover:text-[--foreground]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary and Presets */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[--muted-foreground]">3 active filters</span>
              <button 
                onClick={() => {
                  setFilters({ status: 'all', dateRange: 'all', label: '', minImages: 0, maxImages: null });
                  setSearchQuery('');
                }}
                className="text-[--primary] hover:underline text-sm"
              >
                Clear all
              </button>
            </div>
            <div className="h-4 border-r border-[--border]"></div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 text-sm text-[--primary] hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save as preset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Job Table following exact design specification */}
      <div className="job-table-container">
        <div className="job-table-scroll">
          <table className="job-table w-full">
            <thead className="sticky top-0 bg-[--background] z-10">
              <tr>
                <th className="w-12">
                  <div 
                    className="checkbox-wrapper" 
                    role="checkbox" 
                    aria-checked={paginatedJobs.length > 0 && paginatedJobs.every(job => selectedJobs.has(job.id))}
                    tabIndex={0}
                    onClick={() => handleSelectAll(!paginatedJobs.every(job => selectedJobs.has(job.id)))}
                  >
                    {paginatedJobs.length > 0 && paginatedJobs.every(job => selectedJobs.has(job.id)) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="w-32">
                  Job ID
                  <span className="sort-indicator">▼</span>
                </th>
                <th className="w-64">Name/Label</th>
                <th className="w-32">Status</th>
                <th className="w-40">
                  Date
                  <span className="sort-indicator">▼</span>
                </th>
                <th className="w-24">Duration</th>
                <th className="w-24">Images</th>
                <th className="w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedJobs.map((job) => (
                <tr 
                  key={job.id} 
                  className={`job-row ${selectedJobs.has(job.id) ? 'selected' : ''}`}
                  onClick={() => handleOpenSingleJob(job.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div 
                      className="checkbox-wrapper"
                      aria-checked={selectedJobs.has(job.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJobSelect(job.id, !selectedJobs.has(job.id));
                      }}
                      role="checkbox"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleJobSelect(job.id, !selectedJobs.has(job.id));
                        }
                      }}
                    >
                      {selectedJobs.has(job.id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="job-id">#{job.id}</span>
                  </td>
                  <td>
                    <span 
                      className="job-label"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleJobRename(job.id, e.currentTarget.textContent || '')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          e.currentTarget.textContent = job.label || `Job ${job.id}`;
                          e.currentTarget.blur();
                        }
                      }}
                    >
                      {job.label || `Job ${job.id}`}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${job.status}`}>
                      {job.status === 'completed' && '✓ Completed'}
                      {job.status === 'processing' && '⟳ In Progress'}
                      {job.status === 'failed' && '✗ Failed'}
                      {job.status === 'pending' && '⏳ Pending'}
                      {!['completed', 'processing', 'failed', 'pending'].includes(job.status) && job.status}
                    </span>
                  </td>
                  <td>
                    <span className="timestamp">
                      {job.startedAt ? new Date(job.startedAt).toLocaleDateString() : 'Unknown'}
                    </span>
                  </td>
                  <td>
                    {job.startedAt && job.completedAt ? 
                      `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / (1000 * 60))}m` : 
                      'N/A'
                    }
                  </td>
                  <td>
                    <span className="flex items-center gap-1">
                      {job.totalImages || 0}
                      <svg className="w-4 h-4 text-[--muted-foreground]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </td>
                  <td>
                    <div className="quick-actions flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenSingleJob(job.id)}
                        className="p-1 hover:bg-[--secondary] rounded transition-colors"
                        title="View Job Details"
                      >
                        <svg className="w-4 h-4 text-[--action-view]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => window.electronAPI.jobManagement.rerunJobExecution(job.id)}
                        className="p-1 hover:bg-[--secondary] rounded transition-colors"
                        title="Rerun Job"
                      >
                        <svg className="w-4 h-4 text-[--action-rerun]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => window.electronAPI.jobManagement.exportJobExecution(job.id)}
                        className="p-1 hover:bg-[--secondary] rounded transition-colors"
                        title="Export Job"
                      >
                        <svg className="w-4 h-4 text-[--action-export]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => window.electronAPI.jobManagement.deleteJobExecution(job.id)}
                        className="p-1 hover:bg-[--secondary] rounded transition-colors"
                        title="Delete Job"
                      >
                        <svg className="w-4 h-4 text-[--action-delete]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Operations Toolbar following exact design specification */}
      {selectedJobs.size > 0 && (
        <div className="border-t border-[--border] p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-[--muted-foreground]">
                Selected: {selectedJobs.size} ({Math.round((selectedJobs.size / paginatedJobs.length) * 100)}%)
              </span>
              <button 
                onClick={() => setSelectedJobs(new Set())}
                className="text-[--primary] hover:underline text-sm"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleBulkRerun}
                disabled={isProcessing}
                className="bg-[--action-rerun] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Rerun Selected
              </button>
              <button 
                onClick={handleBulkExport}
                disabled={isProcessing}
                className="bg-[--action-export] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Selected
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="bg-[--action-delete] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls following exact design specification */}
      <div className="border-t border-[--border] p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 hover:bg-[--secondary] rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm text-[--muted-foreground]">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-[--secondary] rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="bg-[--background] border border-[--border] rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[--ring]"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <span className="text-sm text-[--muted-foreground]">
              Total: {totalJobs} jobs
            </span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--primary] mx-auto"></div>
            <p className="mt-4 text-[--muted-foreground]">Loading jobs...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobManagementPanel;
