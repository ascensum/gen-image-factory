import React, { useState, useCallback } from 'react';
import { JobExecution } from '../../types/job';

interface SortConfig {
  column: keyof JobExecution;
  direction: 'asc' | 'desc';
}

interface JobTableProps {
  jobs: JobExecution[];
  selectedJobs: Set<string>;
  onJobSelect: (jobId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onJobAction: (action: 'view' | 'export' | 'rerun' | 'delete', jobId: string) => void;
  onJobLabelEdit: (jobId: string, newLabel: string) => Promise<void>;
  sortConfig: SortConfig;
  onSortChange: (column: keyof JobExecution, direction: 'asc' | 'desc') => void;
  isLoading: boolean;
  error: string | null;
}

const JobTable: React.FC<JobTableProps> = ({
  jobs,
  selectedJobs,
  onJobSelect,
  onSelectAll,
  onJobAction,
  onJobLabelEdit,
  sortConfig,
  onSortChange,
  isLoading,
  error
}) => {
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>('');

  // Handle inline editing
  const handleEditStart = useCallback((job: JobExecution) => {
    setEditingJobId(job.id);
    setEditingLabel(job.label || '');
  }, []);

  const handleEditSave = useCallback(async () => {
    if (editingJobId && editingLabel !== undefined) {
      try {
        await onJobLabelEdit(editingJobId, editingLabel);
        setEditingJobId(null);
        setEditingLabel('');
      } catch (error) {
        // Error is handled by the parent component
        console.error('Failed to save label:', error);
      }
    }
  }, [editingJobId, editingLabel, onJobLabelEdit]);

  const handleEditCancel = useCallback(() => {
    setEditingJobId(null);
    setEditingLabel('');
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  }, [handleEditSave, handleEditCancel]);

  // Handle sort
  const handleSort = useCallback((column: keyof JobExecution) => {
    const direction = sortConfig.column === column && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    onSortChange(column, direction);
  }, [sortConfig, onSortChange]);

  // Format duration
  const formatDuration = useCallback((startedAt: Date, completedAt?: Date): string => {
    if (!completedAt) return 'Running';
    
    const duration = completedAt.getTime() - startedAt.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  // Format date
  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Get status badge color
  const getStatusBadgeColor = useCallback((status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'stopped':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // Check if all jobs are selected
  const allSelected = jobs.length > 0 && selectedJobs.size === jobs.length;
  const someSelected = selectedJobs.size > 0 && selectedJobs.size < jobs.length;

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center text-red-600">
          <p>Error loading jobs: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Selection Column */}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </th>
              
              {/* Job ID Column */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center">
                  Job ID
                  {sortConfig.column === 'id' && (
                    <svg className={`ml-1 h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </th>
              
              {/* Name/Label Column */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('label')}
              >
                <div className="flex items-center">
                  Name/Label
                  {sortConfig.column === 'label' && (
                    <svg className={`ml-1 h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </th>
              
              {/* Status Column */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  Status
                  {sortConfig.column === 'status' && (
                    <svg className={`ml-1 h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </th>
              
              {/* Date Column */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('startedAt')}
              >
                <div className="flex items-center">
                  Date
                  {sortConfig.column === 'startedAt' && (
                    <svg className={`ml-1 h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </th>
              
              {/* Duration Column */}
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('startedAt')}
              >
                Duration
              </th>
              
              {/* Images Column */}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Images
              </th>
              
              {/* Actions Column */}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                {/* Selection Checkbox */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedJobs.has(job.id)}
                    onChange={(e) => onJobSelect(job.id, e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </td>
                
                {/* Job ID */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onJobAction('view', job.id)}
                    className="text-sm font-mono text-indigo-600 hover:text-indigo-900"
                  >
                    #{job.id}
                  </button>
                </td>
                
                {/* Name/Label */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingJobId === job.id ? (
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleEditSave}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center">
                      <span 
                        className="text-sm text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                        onClick={() => handleEditStart(job)}
                      >
                        {job.label || `Job ${job.id}`}
                      </span>
                      <button
                        onClick={() => handleEditStart(job)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </td>
                
                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(job.status)}`}>
                    {job.status}
                  </span>
                </td>
                
                {/* Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(job.startedAt)}
                </td>
                
                {/* Duration */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDuration(job.startedAt, job.completedAt)}
                </td>
                
                {/* Images */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <svg className="h-4 w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {job.totalImages}
                  </div>
                </td>
                
                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onJobAction('view', job.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="View Details"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onJobAction('export', job.id)}
                      className="text-green-600 hover:text-green-900"
                      title="Export"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onJobAction('rerun', job.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Rerun"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onJobAction('delete', job.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      
      {jobs.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default JobTable;
