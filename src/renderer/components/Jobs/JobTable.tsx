import React, { useState, useCallback, useMemo } from 'react';
import { JobExecution } from '../../../types/job';

interface JobTableProps {
  jobs: JobExecution[];
  selectedJobs: Set<string | number>;
  onJobSelect: (jobId: string | number, selected: boolean) => void;
  onJobRename: (jobId: string | number, newLabel: string) => void;
  onSort: (field: keyof JobExecution, direction: 'asc' | 'desc') => void;
  sortField: keyof JobExecution;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

const JobTable: React.FC<JobTableProps> = ({
  jobs,
  selectedJobs,
  onJobSelect,
  onJobRename,
  onSort,
  sortField,
  sortDirection,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange
}) => {
  const [editingJobId, setEditingJobId] = useState<string | number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEditStart = useCallback((job: JobExecution) => {
    setEditingJobId(job.id);
    setEditValue(job.label || '');
  }, []);

  const handleEditSave = useCallback((jobId: string | number) => {
    if (editValue.trim()) {
      onJobRename(jobId, editValue.trim());
    }
    setEditingJobId(null);
    setEditValue('');
  }, [editValue, onJobRename]);

  const handleEditCancel = useCallback(() => {
    setEditingJobId(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, jobId: string | number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave(jobId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  }, [handleEditSave, handleEditCancel]);

  const handleSelectAll = useCallback((checked: boolean) => {
    jobs.forEach(job => onJobSelect(job.id, checked));
  }, [jobs, onJobSelect]);

  const isAllSelected = useMemo(() => {
    return jobs.length > 0 && jobs.every(job => selectedJobs.has(job.id));
  }, [jobs, selectedJobs]);

  const isIndeterminate = useMemo(() => {
    return selectedJobs.size > 0 && selectedJobs.size < jobs.length;
  }, [selectedJobs.size, jobs.length]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'In Progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSortIcon = (field: keyof JobExecution) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const getDisplayLabel = useCallback((job: JobExecution) => {
    const label = (job.label || '').trim();
    if (label !== '') return label;
    // Prefer startedAt for fallback timestamp; fall back to createdAt
    const started = (job as any).startedAt ? new Date((job as any).startedAt) : ((job as any).createdAt ? new Date((job as any).createdAt) : null);
    if (started && !isNaN(started.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}_${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
      return `job_${ts}`;
    }
    return `Job ${job.id}`;
  }, []);

  const handleSort = (field: keyof JobExecution) => {
    const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(field, direction);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number(e.target.value));
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const handlePageKeyDown = (e: React.KeyboardEvent, page: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePageChange(page);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Table Header with ARIA labels */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900" id="job-table-title">
          Job Executions
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Showing {jobs.length} of {jobs.length} jobs on page {currentPage} of {totalPages}
        </p>
      </div>

      {/* Table Container with proper ARIA attributes */}
      <div className="overflow-x-auto">
        <table 
          className="min-w-full divide-y divide-gray-200"
          aria-labelledby="job-table-title"
          role="table"
          aria-describedby="job-table-description"
        >
          <caption id="job-table-description" className="sr-only">
            Table of job executions with selection, sorting, and inline editing capabilities
          </caption>
          
          <thead className="bg-gray-50">
            <tr>
              {/* Select All Checkbox */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="Select all jobs on this page"
                  />
                  <span className="sr-only">Select all</span>
                </label>
              </th>

              {/* Sortable Column Headers */}
              {[
                { key: 'label', label: 'Label', sortable: true },
                { key: 'status', label: 'Status', sortable: true },
                { key: 'createdAt', label: 'Created', sortable: true },
                { key: 'startedAt', label: 'Duration', sortable: true },
                { key: 'imageCount', label: 'Images', sortable: true },
                { key: 'actions', label: 'Actions', sortable: false }
              ].map(({ key, label, sortable }) => (
                <th
                  key={key}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  {...(sortable && {
                    onClick: () => handleSort(key as keyof JobExecution),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(key as keyof JobExecution);
                      }
                    },
                    tabIndex: 0,
                    role: 'button',
                    'aria-label': `Sort by ${label} ${sortField === key ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`,
                    'aria-sort': sortField === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                  })}
                >
                  <div className="flex items-center space-x-1">
                    <span>{label}</span>
                    {sortable && (
                      <span className="text-gray-400" aria-hidden="true">
                        {getSortIcon(key as keyof JobExecution)}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job, index) => (
              <tr 
                key={job.id}
                className={`hover:bg-gray-50 ${selectedJobs.has(job.id) ? 'bg-blue-50' : ''}`}
                aria-selected={selectedJobs.has(job.id)}
              >
                {/* Selection Checkbox */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedJobs.has(job.id)}
                      onChange={(e) => onJobSelect(job.id, e.target.checked)}
                      aria-label={`Select job ${getDisplayLabel(job)}`}
                    />
                  </label>
                </td>

                {/* Label Column with Inline Editing */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingJobId === job.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, job.id)}
                        onBlur={() => handleEditSave(job.id)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        aria-label="Edit job label"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditSave(job.id)}
                        className="text-green-600 hover:text-green-800"
                        aria-label="Save label"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Cancel editing"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {getDisplayLabel(job)}
                      </span>
                      <button
                        onClick={() => handleEditStart(job)}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label={`Edit label for job ${getDisplayLabel(job)}`}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </td>

                {/* Status Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </td>

                {/* Created Date Column */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(job.createdAt)}
                </td>

                {/* Duration Column */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDuration(job.startedAt, job.completedAt)}
                </td>

                {/* Image Count Column */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {job.imageCount || 0}
                </td>

                {/* Actions Column */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {/* TODO: Implement view details */}}
                      className="text-blue-600 hover:text-blue-900"
                      aria-label={`View details for job ${getDisplayLabel(job)}`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => {/* TODO: Implement rerun */}}
                      className="text-green-600 hover:text-green-900"
                      aria-label={`Rerun job ${getDisplayLabel(job)}`}
                    >
                      Rerun
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls with ARIA labels */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          {/* Page Size Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="page-size" className="text-sm text-gray-700">
              Show:
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
              aria-label="Items per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">per page</span>
          </div>

          {/* Pagination Navigation */}
          <nav 
            className="flex items-center space-x-1"
            role="navigation"
            aria-label="Pagination navigation"
          >
            {/* Previous Page Button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 text-sm rounded-md ${
                currentPage === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-label="Go to previous page"
              aria-disabled={currentPage === 1}
            >
              Previous
            </button>

            {/* Page Numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  onKeyDown={(e) => handlePageKeyDown(e, pageNum)}
                  className={`px-3 py-1 text-sm rounded-md ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-label={`Go to page ${pageNum}`}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                  tabIndex={0}
                  role="button"
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Page Button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 text-sm rounded-md ${
                currentPage === totalPages
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-label="Go to next page"
              aria-disabled={currentPage === totalPages}
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default JobTable;
