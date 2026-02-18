/**
 * Story 3.4 Phase 4: Job table (exact markup from JobManagementPanel).
 */
import React from 'react';
import StatusBadge from '../../Common/StatusBadge';
import type { JobExecution } from '../../../../types/job';

export interface JobManagementTableProps {
  jobs: JobExecution[];
  selectedJobs: Set<string | number>;
  getDisplayLabel: (job: JobExecution) => string;
  onJobSelect: (jobId: string | number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpenSingleJob: (jobId: string | number) => void;
  onRerunJob: (jobId: string | number) => void;
  onExportJob: (jobId: string | number) => void;
  onDeleteJob: (jobId: string | number) => void;
}

const JobManagementTable: React.FC<JobManagementTableProps> = ({
  jobs,
  selectedJobs,
  getDisplayLabel,
  onJobSelect,
  onSelectAll,
  onOpenSingleJob,
  onRerunJob,
  onExportJob,
  onDeleteJob,
}) => {
  const allSelected = jobs.length > 0 && jobs.every((j) => selectedJobs.has(j.id));
  return (
    <div className="job-table-container">
      <div className="job-table-scroll">
        <table className="job-table w-full">
          <thead className="sticky top-0 bg-[--background] z-10">
            <tr>
              <th className="w-12">
                <div className="checkbox-wrapper" role="checkbox" aria-checked={allSelected} tabIndex={0} onClick={() => onSelectAll(!allSelected)}>
                  {allSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </th>
              <th className="w-32">Job ID <span className="sort-indicator">▼</span></th>
              <th className="w-64">Name/Label</th>
              <th className="w-32">Status</th>
              <th className="w-40">Date <span className="sort-indicator">▼</span></th>
              <th className="w-24">Duration</th>
              <th className="w-24">Images</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={String(job.id)} className={`job-row ${selectedJobs.has(job.id) ? 'selected' : ''}`}>
                <td>
                  <div
                    className="checkbox-wrapper"
                    aria-checked={selectedJobs.has(job.id)}
                    onClick={(e) => { e.stopPropagation(); onJobSelect(job.id, !selectedJobs.has(job.id)); }}
                    role="checkbox"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onJobSelect(job.id, !selectedJobs.has(job.id)); } }}
                  >
                    {selectedJobs.has(job.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </td>
                <td><span className="job-id">#{job.id}</span></td>
                <td><span className="job-label">{getDisplayLabel(job)}</span></td>
                <td><StatusBadge variant="job" status={job.status} /></td>
                <td><span className="timestamp">{job.startedAt ? new Date(job.startedAt).toLocaleDateString() : 'Unknown'}</span></td>
                <td>
                  {job.startedAt && job.completedAt
                    ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / (1000 * 60))}m`
                    : 'N/A'}
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
                    <button onClick={() => onOpenSingleJob(job.id)} className="p-1 hover:bg-[--secondary] rounded transition-colors" title="View Job Details">
                      <svg className="w-4 h-4 text-[--action-view]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    <button onClick={() => onRerunJob(job.id)} className="p-1 hover:bg-[--secondary] rounded transition-colors" title="Rerun Job">
                      <svg className="w-4 h-4 text-[--action-rerun]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 01-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
                    </button>
                    <button onClick={() => onExportJob(job.id)} className="p-1 hover:bg-[--secondary] rounded transition-colors" title="Export Job">
                      <svg className="w-4 h-4 text-[--action-export]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                    <button onClick={() => onDeleteJob(job.id)} className="p-1 hover:bg-[--secondary] rounded transition-colors" title="Delete Job">
                      <svg className="w-4 h-4 text-[--action-delete]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JobManagementTable;
