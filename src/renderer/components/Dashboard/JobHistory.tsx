import React, { useState, useRef, useEffect } from 'react';
import { JobExecution } from './DashboardPanel';

interface JobHistoryProps {
  jobs: JobExecution[];
  onJobAction: (action: string, jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
  isLoading: boolean;
}

const JobHistory: React.FC<JobHistoryProps> = ({
  jobs,
  onJobAction,
  onDeleteJob,
  isLoading
}) => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const jobListRef = useRef<HTMLDivElement>(null);

  // Filter and sort jobs
  const filteredAndSortedJobs = React.useMemo(() => {
    // Ensure jobs is always an array
    if (!jobs || !Array.isArray(jobs)) {
      return [];
    }
    
    let filtered = jobs;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          // Handle null/undefined dates by putting them at the end
          if (!a.startedAt && !b.startedAt) return 0;
          if (!a.startedAt) return 1;
          if (!b.startedAt) return -1;
          return a.startedAt.getTime() - b.startedAt.getTime();
        case 'newest':
          // Handle null/undefined dates by putting them at the end
          if (!a.startedAt && !b.startedAt) return 0;
          if (!a.startedAt) return 1;
          if (!b.startedAt) return -1;
          return b.startedAt.getTime() - a.startedAt.getTime();
        case 'name':
          // Handle null/undefined configuration names
          const nameA = a.configurationName || 'Unknown';
          const nameB = b.configurationName || 'Unknown';
          return nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [jobs, statusFilter, sortBy]);

  const handleJobClick = (jobId: string) => {
    setSelectedJob(jobId);
    onJobAction('view', jobId);
  };

  const handleContextMenu = (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    setShowContextMenu(jobId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleContextMenuAction = (action: string, jobId: string) => {
    setShowContextMenu(null);

    switch (action) {
      case 'view':
        onJobAction('view', jobId);
        break;
      case 'export':
        onJobAction('export', jobId);
        break;
              case 'rerun':
          console.log('🚨 DEBUG RERUN: JobHistory rerun case triggered for jobId:', jobId);
          console.log('🚨 DEBUG RERUN: Timestamp:', new Date().toISOString());
          console.log('🚨 DEBUG RERUN: Stack trace:', new Error().stack);
          onJobAction('rerun', jobId);
          break;
      case 'delete':
        setShowDeleteConfirm(jobId);
        break;
      default:
        break;
    }
  };

  const handleDeleteJob = (jobId: string) => {
    if (onDeleteJob) {
      onDeleteJob(jobId);
    }
    setShowDeleteConfirm(null);
  };

  const confirmDeleteJob = (jobId: string) => {
    setShowDeleteConfirm(jobId);
  };

  const cancelDeleteJob = () => {
    setShowDeleteConfirm(null);
  };

  const formatDuration = (startedAt: Date | null, completedAt?: Date | null): string => {
    if (!startedAt) {
      return 'Unknown';
    }
    
    if (!completedAt) {
      return 'In Progress';
    }
    
    const duration = completedAt.getTime() - startedAt.getTime();
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) {
      return 'Unknown';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Maintain scroll position during updates
  useEffect(() => {
    if (jobListRef.current && scrollPosition > 0) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (jobListRef.current) {
          jobListRef.current.scrollTop = scrollPosition;
        }
      });
    }
  }, [filteredAndSortedJobs, scrollPosition]);

  // Save scroll position before updates
  useEffect(() => {
    if (jobListRef.current) {
      const handleScroll = () => {
        if (jobListRef.current) {
          setScrollPosition(jobListRef.current.scrollTop);
        }
      };

      const jobList = jobListRef.current;
      jobList.addEventListener('scroll', handleScroll);

      return () => {
        jobList.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showContextMenu) {
        const target = event.target as Element;
        const contextMenu = document.querySelector('.context-menu');
        if (contextMenu && !contextMenu.contains(target)) {
          setShowContextMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">Job History</h2>
        <div className="flex-1 flex items-center justify-center py-8 min-h-0">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading job history...</span>
        </div>
      </div>
    );
  }

  if (filteredAndSortedJobs.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">Job History</h2>
        <div className="flex-1 flex flex-col items-center justify-center py-8 min-h-0">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No job history available</h3>
          <p className="mt-1 text-sm text-gray-500">Start your first job to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Job List with Full Height Scrolling - no internal header to avoid duplication */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0" role="list" ref={jobListRef}>
        {/* Scroll indicator - shows when content overflows */}
        {filteredAndSortedJobs.length > 5 && (
          <div className="text-xs text-gray-500 text-center py-2 border-b border-gray-200">
            📜 Job History area - scroll when content overflows ({filteredAndSortedJobs.length} total)
          </div>
        )}
        
        {/* No jobs message */}
        {filteredAndSortedJobs.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
            <p className="mt-1 text-sm text-gray-500">Jobs will appear here once you start processing images.</p>
          </div>
        )}
        
        {filteredAndSortedJobs.map((job) => (
          <div
            key={job.id}
            role="listitem"
            tabIndex={0}
            aria-label={`${job.displayLabel || job.configurationName || 'Unknown'} - ${job.status}`}
            className={`bg-white border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedJob === job.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => handleJobClick(job.id)}
            onContextMenu={(e) => handleContextMenu(e, job.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onJobAction('view', job.id);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(job.status)}
                <div>
                  <h3 className="font-medium text-gray-900">{job.displayLabel || job.configurationName || 'Unknown'}</h3>
                  <div className="text-xs text-gray-500 mb-1">Job ID: {job.id}</div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                                          <span>{formatDate(job.startedAt)}</span>
                      <span>{formatDuration(job.startedAt, job.completedAt)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                {job.status === 'running' && (
                  <div className="text-center">
                    <div className="font-medium">Running</div>
                    <div className="text-xs">Processing images</div>
                  </div>
                )}
                
                <div>
                  <span className="font-medium">Images:</span>
                  <div>{job.totalImages} total ({job.successfulImages} successful, {job.failedImages} failed)</div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobAction('view', job.id);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="View job details"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobAction('export', job.id);
                    }}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Export to Excel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobAction('rerun', job.id);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Rerun job"
                    disabled={job.status === 'running'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteJob) {
                        onDeleteJob(job.id);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete job"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 context-menu min-w-48"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          <button
            onClick={() => handleContextMenuAction('view', showContextMenu)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          
          <button
            onClick={() => handleContextMenuAction('export', showContextMenu)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to Excel
          </button>
          
          <button
            onClick={() => handleContextMenuAction('rerun', showContextMenu)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            disabled={jobs.find(j => j.id === showContextMenu)?.status === 'running'}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rerun Job
          </button>
          
          <button
            onClick={() => handleContextMenuAction('delete', showContextMenu)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Job
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Job</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this job? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteJob}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteJob(showDeleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobHistory;
