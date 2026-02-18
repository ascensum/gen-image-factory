/**
 * Story 3.4 Phase 5c.6: JobHistory container – composes useJobHistoryFilteredSorted,
 * JobHistoryEmptyState, JobHistoryListItem, JobHistoryContextMenu, JobHistoryDeleteConfirm.
 */
import React, { useState, useRef, useEffect } from 'react';
import type { JobExecution } from './DashboardPanel.legacy';
import { useJobHistoryFilteredSorted } from './hooks/useJobHistoryFilteredSorted';
import JobHistoryEmptyState from './components/JobHistoryEmptyState';
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
  sortBy: controlledSortBy,
}) => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const jobListRef = useRef<HTMLDivElement>(null);

  const filteredAndSortedJobs = useJobHistoryFilteredSorted({
    jobs,
    statusFilter: controlledStatusFilter !== undefined ? controlledStatusFilter : 'all',
    sortBy: controlledSortBy !== undefined ? controlledSortBy : 'newest',
  });

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
    const handleClickOutside = (event: MouseEvent) => {
      if (!showContextMenu) return;
      const target = event.target as Element;
      const contextMenu = document.querySelector('.context-menu');
      if (contextMenu && !contextMenu.contains(target)) setShowContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContextMenu]);

  if (isLoading) {
    return <JobHistoryEmptyState variant="loading" />;
  }

  if (filteredAndSortedJobs.length === 0) {
    return <JobHistoryEmptyState variant="empty" />;
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
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

export default JobHistory;
