import React, { useState, useRef, useEffect } from 'react';
import { JobExecution } from './DashboardPanel';
import { useJobHistoryFilteredSorted } from './hooks/useJobHistoryFilteredSorted';
import JobHistoryListItem from './components/JobHistoryListItem';
import JobHistoryContextMenu from './components/JobHistoryContextMenu';
import JobHistoryDeleteConfirm from './components/JobHistoryDeleteConfirm';

interface JobHistoryProps {
  jobs: JobExecution[];
  onJobAction: (action: string, jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
  isLoading: boolean;
  statusFilter?: string;
  sortBy?: 'newest' | 'oldest' | 'name';
}

const JobHistory: React.FC<JobHistoryProps> = ({
  jobs,
  onJobAction,
  onDeleteJob,
  isLoading,
  statusFilter: controlledStatusFilter,
  sortBy: controlledSortBy
}) => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const jobListRef = useRef<HTMLDivElement>(null);

  const statusFilter = controlledStatusFilter !== undefined ? controlledStatusFilter : 'all';
  const sortBy = controlledSortBy !== undefined ? controlledSortBy : 'newest';
  const filteredAndSortedJobs = useJobHistoryFilteredSorted({ jobs, statusFilter, sortBy });

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
    if (onDeleteJob) onDeleteJob(jobId);
    setShowDeleteConfirm(null);
  };

  const cancelDeleteJob = () => setShowDeleteConfirm(null);

  useEffect(() => {
    if (jobListRef.current && scrollPosition > 0) {
      requestAnimationFrame(() => {
        if (jobListRef.current) jobListRef.current.scrollTop = scrollPosition;
      });
    }
  }, [filteredAndSortedJobs, scrollPosition]);

  useEffect(() => {
    if (!jobListRef.current) return;
    const el = jobListRef.current;
    const handleScroll = () => setScrollPosition(el.scrollTop);
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!showContextMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const contextMenu = document.querySelector('.context-menu');
      if (contextMenu && !contextMenu.contains(target)) setShowContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0" role="list" ref={jobListRef}>
        {filteredAndSortedJobs.length > 5 && (
          <div className="text-xs text-gray-500 text-center py-2 border-b border-gray-200">
            Job History area - scroll when content overflows ({filteredAndSortedJobs.length} total)
          </div>
        )}
        {filteredAndSortedJobs.map((job) => (
          <JobHistoryListItem
            key={job.id}
            job={job as JobExecution & { displayLabel?: string; label?: string }}
            isSelected={selectedJob === job.id}
            onJobClick={handleJobClick}
            onContextMenu={handleContextMenu}
            onJobAction={onJobAction}
            onDeleteJob={onDeleteJob}
          />
        ))}
      </div>

      {showContextMenu && (
        <JobHistoryContextMenu
          jobId={showContextMenu}
          position={contextMenuPosition}
          jobs={jobs}
          onAction={handleContextMenuAction}
        />
      )}

      {showDeleteConfirm && (
        <JobHistoryDeleteConfirm
          onConfirm={() => handleDeleteJob(showDeleteConfirm)}
          onCancel={cancelDeleteJob}
        />
      )}
    </div>
  );
};

export default JobHistory;
