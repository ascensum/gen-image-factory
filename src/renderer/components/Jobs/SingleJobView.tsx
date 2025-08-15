import React, { useState, useEffect, useCallback } from 'react';
import { JobExecution } from '../../types/job';

interface SingleJobViewProps {
  jobId: string;
  onBack: () => void;
  onJobAction: (action: 'export' | 'rerun' | 'delete', jobId: string) => void;
}

type TabType = 'overview' | 'images' | 'logs';

const SingleJobView: React.FC<SingleJobViewProps> = ({
  jobId,
  onBack,
  onJobAction
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [job, setJob] = useState<JobExecution | null>(null);
  const [images, setImages] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Load job data
  const loadJobData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.getJobResults(jobId);
      if (result.success && result.job) {
        setJob(result.job);
        setImages(result.images || []);
      } else {
        setError(result.error || 'Failed to load job data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Load logs
  const loadLogs = useCallback(async () => {
    try {
      const logsResult = await window.electronAPI.getJobLogs('detailed');
      if (Array.isArray(logsResult)) {
        setLogs(logsResult);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadJobData();
    loadLogs();
  }, [loadJobData, loadLogs]);

  // Handle job actions
  const handleJobAction = useCallback(async (action: 'export' | 'rerun' | 'delete') => {
    if (!job) return;
    
    setIsActionInProgress(true);
    
    try {
      if (action === 'delete') {
        const confirmed = window.confirm(
          'Are you sure you want to delete this job? This action cannot be undone.'
        );
        if (!confirmed) return;
      }
      
      await onJobAction(action, job.id.toString());
      
      if (action === 'delete') {
        onBack(); // Go back to job list after deletion
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`);
    } finally {
      setIsActionInProgress(false);
    }
  }, [job, onJobAction, onBack]);

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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Job</h2>
          <p className="text-gray-600 mb-4">{error || 'Job not found'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Job Details: {job.label || `Job ${job.id}`}
                </h1>
                <p className="text-sm text-gray-500">ID: #{job.id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleJobAction('export')}
                disabled={isActionInProgress}
                className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 disabled:opacity-50"
              >
                Export
              </button>
              <button
                onClick={() => handleJobAction('rerun')}
                disabled={isActionInProgress}
                className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 disabled:opacity-50"
              >
                Rerun
              </button>
              <button
                onClick={() => handleJobAction('delete')}
                disabled={isActionInProgress}
                className="px-3 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {(['overview', 'images', 'logs'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg">
          {activeTab === 'overview' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Job Overview</h3>
              
              {/* Job Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Status</h4>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Duration</h4>
                  <p className="text-sm text-gray-900">{formatDuration(job.startedAt, job.completedAt)}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Started At</h4>
                  <p className="text-sm text-gray-900">{formatDate(job.startedAt)}</p>
                </div>
                
                {job.completedAt && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Completed At</h4>
                    <p className="text-sm text-gray-900">{formatDate(job.completedAt)}</p>
                  </div>
                )}
              </div>

              {/* Image Statistics */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-500 mb-4">Generated Images</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-2xl font-semibold text-gray-900">{job.totalImages}</p>
                    <p className="text-sm text-gray-500">Total Images</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-2xl font-semibold text-green-900">{job.successfulImages}</p>
                    <p className="text-sm text-green-500">Successful</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-2xl font-semibold text-red-900">{job.failedImages}</p>
                    <p className="text-sm text-red-500">Failed</p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {job.errorMessage && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Error Message</h4>
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-800">{job.errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Images</h3>
              
              {images.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No images found</h3>
                  <p className="mt-1 text-sm text-gray-500">This job hasn't generated any images yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="aspect-w-1 aspect-h-1 mb-4">
                        <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                          <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">Image {index + 1}</p>
                        <p className="text-gray-500">Status: {image.qcStatus || 'unknown'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Execution Logs</h3>
              
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
                  <p className="mt-1 text-sm text-gray-500">No execution logs are available for this job.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              log.level === 'error' ? 'bg-red-100 text-red-800' :
                              log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {log.level}
                            </span>
                            <span className="text-sm text-gray-500">
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Unknown time'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900">{log.message}</p>
                          {log.source && (
                            <p className="text-xs text-gray-500 mt-1">Source: {log.source}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SingleJobView;
