/**
 * Story 3.4 Phase 5c.6: Single job card for JobHistory list.
 */
import React from 'react';
import StatusBadge from '../../Common/StatusBadge';
import type { JobExecution } from '../hooks/useDashboardState';

interface JobHistoryListItemProps {
  job: JobExecution & { displayLabel?: string; label?: string };
  isSelected: boolean;
  onJobClick: (jobId: string) => void;
  onContextMenu: (e: React.MouseEvent, jobId: string) => void;
  onJobAction: (action: string, jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
}

/** Same fallback as useDashboardActions: job_<timestamp> when no label but has startedAt, else "Job <id>". */
function fallbackLabelFromStartedAt(job: { id?: unknown; startedAt?: unknown; started_at?: unknown }): string {
  const raw = (job as { startedAt?: unknown; started_at?: unknown })?.startedAt ?? (job as { started_at?: unknown })?.started_at;
  let started: Date | null = null;
  if (raw instanceof Date) started = raw;
  else if (typeof raw === 'string' || typeof raw === 'number') started = new Date(raw);
  if (started && !isNaN(started.getTime())) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `job_${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
  }
  return `Job ${String(job?.id ?? '').trim() || '?'}`;
}

function getJobLabel(job: JobExecution & { displayLabel?: string; label?: string }): string {
  const prefer = job.displayLabel ?? job.label ?? (job as { configurationName?: string | null }).configurationName;
  const s = prefer != null && prefer !== '' ? String(prefer).trim() : '';
  if (s === '' || s === 'undefined') return fallbackLabelFromStartedAt(job);
  const isRerun = s.endsWith('(Rerun)');
  return isRerun ? s.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(job.id).slice(-6)})` : s;
}

function formatDuration(startedAt: Date | null, completedAt?: Date | null): string {
  if (!startedAt) return 'Unknown';
  if (!completedAt) return 'In Progress';
  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.floor(duration / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatDate(date: Date | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusIcon(status: string) {
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
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

const JobHistoryListItem: React.FC<JobHistoryListItemProps> = ({
  job,
  isSelected,
  onJobClick,
  onContextMenu,
  onJobAction,
  onDeleteJob,
}) => {
  const label = getJobLabel(job);
  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={`${label} - ${job.status}`}
      className={`bg-white border rounded-lg p-4 cursor-pointer transition-colors ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
      onClick={() => onJobClick(job.id)}
      onContextMenu={(e) => onContextMenu(e, job.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onJobAction('view', job.id);
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon(job.status)}
          <div>
            <h3 className="font-medium text-gray-900">{label}</h3>
            <div className="text-xs text-gray-500 mb-1">Job ID: {job.id}</div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>{formatDate(job.startedAt)}</span>
              {job.completedAt ? <span>{formatDuration(job.startedAt, job.completedAt)}</span> : null}
              <StatusBadge variant="job" status={job.status} />
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
            <div>
              {job.totalImages ?? 0} total ({job.successfulImages ?? 0} successful, {job.failedImages ?? 0} failed)
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => { e.stopPropagation(); onJobAction('view', job.id); }}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="View job details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onJobAction('export', job.id); }}
              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
              title="Export to Excel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onJobAction('rerun', job.id); }}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="Rerun job"
              disabled={job.status === 'running'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onDeleteJob) onDeleteJob(job.id);
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
  );
};

export default JobHistoryListItem;
