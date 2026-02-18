/**
 * Story 3.4 Phase 4: Job Management view container.
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';
import SimpleDropdown, { DropdownOption } from '../../Common/SimpleDropdown';
import ExportFileModal from '../../Common/ExportFileModal';
import { useJobList } from '../hooks/useJobList';
import { useJobOperations } from '../hooks/useJobOperations';
import JobManagementTable from '../components/JobManagementTable';
import '../JobManagementPanel.css';

export interface JobManagementViewProps {
  onOpenSingleJob: (jobId: string | number) => void;
  onBack: () => void;
}

const statusOptions: DropdownOption<string>[] = [
  { value: 'all', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'processing', label: 'In Progress' },
  { value: 'failed', label: 'Failed' },
];

export const JobManagementView: React.FC<JobManagementViewProps> = ({ onOpenSingleJob, onBack }) => {
  const list = useJobList();
  const ops = useJobOperations({
    paginatedJobs: list.paginatedJobs,
    loadJobs: list.loadJobs,
    refreshCounts: list.refreshCounts,
    onOpenSingleJob,
  });

  if (list.error) {
    return (
      <div className="min-h-screen bg-[--background] text-[--foreground] flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 mb-4">Error</div>
            <p className="text-gray-600">{list.error}</p>
            <button onClick={() => list.loadJobs(false)} className="mt-4 bg-[--primary] text-white px-4 py-2 rounded hover:opacity-90">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[--background] text-[--foreground] flex flex-col overflow-hidden">
      <header className="job-management-header relative py-3 md:py-4">
        <div className="header-content relative">
          <div className="header-left">
            <button onClick={onBack} className="back-button" aria-label="Go back to dashboard">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="header-title">Job Management</h1>
          </div>
          <div className="header-actions ml-auto">
            <button onClick={() => list.loadJobs(false)} className="refresh-button" disabled={list.isLoading} aria-label="Refresh jobs">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-5 gap-4 p-6 shrink-0">
        <div className="stats-card"><div className="text-sm text-[--muted-foreground]">Total Jobs</div><div className="text-2xl font-semibold mt-1">{list.statistics.totalJobs}</div><div className="text-xs text-[--primary] mt-1">{list.uiStats.weeklyTrend === 'up' && `↑ ${list.uiStats.weeklyDeltaPct}% from last week`}{list.uiStats.weeklyTrend === 'down' && `↓ ${Math.abs(list.uiStats.weeklyDeltaPct)}% from last week`}{list.uiStats.weeklyTrend === 'flat' && 'No change from last week'}</div></div>
        <div className="stats-card"><div className="text-sm text-[--muted-foreground]">Completed</div><div className="text-2xl font-semibold mt-1 text-[--status-completed]">{list.statistics.completedJobs}</div><div className="text-xs text-[--muted-foreground] mt-1">Completion rate {list.uiStats.completionRate}%</div></div>
        <div className="stats-card"><div className="text-sm text-[--muted-foreground]">In Progress</div><div className="text-2xl font-semibold mt-1 text-[--status-in-progress]">{list.statistics.processingJobs}</div><div className="text-xs text-[--muted-foreground] mt-1">Currently processing</div></div>
        <div className="stats-card"><div className="text-sm text-[--muted-foreground]">Failed</div><div className="text-2xl font-semibold mt-1 text-[--status-failed]">{list.statistics.failedJobs}</div><div className="text-xs text-[--muted-foreground] mt-1">{list.uiStats.failedLast24h} failed in last 24h</div></div>
        <div className="stats-card"><div className="text-sm text-[--muted-foreground]">Pending</div><div className="text-2xl font-semibold mt-1 text-[--status-pending]">{list.statistics.pendingJobs}</div><div className="text-xs text-[--muted-foreground] mt-1">In queue</div></div>
      </div>

      <div className="px-6 py-4 space-y-4 border-b border-[--border] shrink-0">
        <div className="job-filters-row flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="relative flex items-center gap-2 flex-none mr-4">
            <label className="text-sm font-medium text-[--muted-foreground] whitespace-nowrap">By Status:</label>
            <SimpleDropdown options={statusOptions} value={list.filters.status || 'all'} onChange={(val) => list.handleFiltersChange({ ...list.filters, status: val })} buttonClassName="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[12rem] text-left" menuWidthClassName="w-[14rem]" ariaLabel="Filter jobs by status" />
          </div>
          <div className="flex items-center gap-2 flex-none">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!list.filters.hasPendingRetries} onChange={(e) => list.handleFiltersChange({ ...list.filters, hasPendingRetries: e.target.checked })} className="outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:outline-none focus-visible:ring-0" />
              Has pending reruns
            </label>
          </div>
          <div className="relative flex items-center gap-2 flex-nowrap flex-none w-[300px] z-0 ml-4">
            <div className="flex items-center gap-2 bg-[--background] border border-[--border] rounded-lg h-10 px-2">
              <input type="date" className="bg-transparent px-2 h-full focus:outline-none" placeholder="From" value={list.formatDateInput(list.filters.dateFrom)} onChange={(e) => { const v = e.target.value; list.handleFiltersChange({ ...list.filters, dateFrom: v ? new Date(v) : undefined }); }} />
              <div className="h-4 w-px bg-[--border]" />
              <input type="date" className="bg-transparent px-2 h-full focus:outline-none" placeholder="To" value={list.formatDateInput(list.filters.dateTo)} onChange={(e) => { const v = e.target.value; list.handleFiltersChange({ ...list.filters, dateTo: v ? new Date(v) : undefined }); }} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-[1_1_24rem] min-w-[16rem] max-w-[42rem] ml-6">
            <label className="text-sm font-medium text-[--muted-foreground] whitespace-nowrap">Search:</label>
            <div className="relative flex-1 h-10">
              <input type="text" value={list.searchQuery} onChange={(e) => list.handleSearch(e.target.value)} placeholder="Search jobs..." className="w-full h-10 bg-[--background] border border-[--border] rounded-lg px-4 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-[--ring]" />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[--muted-foreground]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {list.searchQuery && <button onClick={() => list.handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[--muted-foreground] hover:text-[--foreground]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[--muted-foreground]">{list.activeFiltersCount} active filter{list.activeFiltersCount === 1 ? '' : 's'}</span>
              <button onClick={list.clearFilters} className="text-[--primary] hover:underline text-sm">Clear all</button>
            </div>
            {ops.selectedJobs.size > 0 && (
              <>
                <div className="h-4 border-r border-[--border]" />
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[--muted-foreground]">{ops.selectedJobs.size} selected</span>
                  <button onClick={ops.handleBulkRerun} disabled={ops.isProcessing} className="bg-[--action-rerun] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Rerun Selected
                  </button>
                  <button onClick={ops.openExportBulk} disabled={ops.isProcessing} className="bg-[--action-export] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Export Selected
                  </button>
                  <button onClick={ops.handleBulkDelete} disabled={ops.isProcessing} className="bg-[--action-delete] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Selected
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="border-y border-[--border] px-4 py-2 shrink-0 bg-[--secondary]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => list.handlePageChange(list.currentPage - 1)} disabled={list.currentPage === 1} className="p-2 hover:bg-[--secondary] rounded-lg transition-colors disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm text-[--muted-foreground]">Page {list.currentPage} of {list.totalPages}</span>
            <button onClick={() => list.handlePageChange(list.currentPage + 1)} disabled={list.currentPage === list.totalPages} className="p-2 hover:bg-[--secondary] rounded-lg transition-colors disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <select value={list.pageSize} onChange={(e) => list.handlePageSizeChange(Number(e.target.value))} className="bg-[--background] border border-[--border] rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[--ring]">
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>
      </div>

      <JobManagementTable
        jobs={list.paginatedJobs}
        selectedJobs={ops.selectedJobs}
        getDisplayLabel={ops.getDisplayLabel}
        onJobSelect={ops.handleJobSelect}
        onSelectAll={ops.handleSelectAll}
        onOpenSingleJob={ops.handleOpenSingleJob}
        onRerunJob={ops.handleRerunSingle}
        onExportJob={ops.openExportSingle}
        onDeleteJob={ops.handleDeleteSingle}
      />

      {list.isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--primary] mx-auto" />
            <p className="mt-4 text-[--muted-foreground]">Loading jobs...</p>
          </div>
        </div>
      )}

      {ops.showExportDialog && (ops.exportType === 'single' ? (
        <ExportFileModal
          isOpen={true}
          title="Export Job"
          fileKind="xlsx"
          defaultFilename={(() => {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const job = list.jobs.find((j) => String(j.id) === String(ops.exportJobId));
            const shortId = ops.exportJobId ? String(ops.exportJobId).slice(-6) : '';
            const base = (job && ((job as any).displayLabel || (job as any).label || (job as any).configurationName)) || shortId || 'Job';
            return `${String(base).replace(/[^a-zA-Z0-9-_]/g, '_')}_${ts}.xlsx`;
          })()}
          onClose={ops.closeExportDialog}
          onExport={async ({ mode, outputPath, filename, duplicatePolicy }) => {
            try {
              if (!ops.exportJobId) return;
              let resolved = outputPath && !/\.xlsx$/i.test(outputPath) ? `${outputPath.replace(/[\\/]+$/, '')}/${filename}` : outputPath || filename;
              const options = mode === 'custom' ? { outputPath: resolved, duplicatePolicy } : undefined;
              const result = await (window as any).electronAPI.jobManagement.exportJobToExcel(ops.exportJobId, options);
              if (result?.success && result.filePath) { try { await (window as any).electronAPI.revealInFolder(result.filePath); } catch {} }
            } finally { ops.closeExportDialog(); }
          }}
        />
      ) : (
        <ExportFileModal
          isOpen={true}
          title={`Export ${ops.selectedJobs.size} Jobs`}
          fileKind="zip"
          defaultFilename={`bulk_export_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.zip`}
          onClose={ops.closeExportDialog}
          onExport={async ({ mode, outputPath, filename, duplicatePolicy }) => {
            try {
              const jobIds = Array.from(ops.selectedJobs);
              let resolved = outputPath && !/\.zip$/i.test(outputPath) ? `${outputPath.replace(/[\\/]+$/, '')}/${filename}` : outputPath || filename;
              const options = mode === 'custom' ? { outputPath: resolved, duplicatePolicy } : undefined;
              const result = await (window as any).electronAPI.jobManagement.bulkExportJobExecutions(jobIds, options);
              if (result?.success && result.zipPath) { try { await (window as any).electronAPI.revealInFolder(result.zipPath); } catch {} }
            } finally { ops.closeExportDialog(); }
            ops.setSelectedJobs(new Set());
          }}
        />
      ))}
    </div>
  );
};
