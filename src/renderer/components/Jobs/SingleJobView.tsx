import React, { useState, useEffect, useCallback } from 'react';
import { JobExecution, GeneratedImage } from '../../../types/job';

interface SingleJobViewProps {
  jobId: string | number;
  onBack: () => void;
  onExport: (jobId: string | number) => void;
  onRerun: (jobId: string | number) => void;
  onDelete: (jobId: string | number) => void;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const SingleJobView: React.FC<SingleJobViewProps> = ({
  jobId,
  onBack,
  onExport,
  onRerun,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [job, setJob] = useState<JobExecution | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'images',
      label: 'Images',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ];

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load job details
      const jobResult = await window.electronAPI.getJobExecution(jobId);
      if (jobResult.success) {
        setJob(jobResult.execution);
      } else {
        throw new Error(jobResult.error || 'Failed to load job');
      }

      // Load job images
      const imagesResult = await window.electronAPI.getGeneratedImagesForJob(jobId);
      if (imagesResult.success) {
        setImages(imagesResult.images);
      }

      // Load job logs (placeholder - implement when available)
      setLogs([
        `Job ${jobId} started at ${new Date().toISOString()}`,
        'Processing images...',
        'Post-processing completed',
        'Job finished successfully'
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tabId);
    }
  }, [handleTabChange]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleBackKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBack();
    }
  }, [handleBack]);

  const handleExport = useCallback(() => {
    onExport(jobId);
  }, [onExport, jobId]);

  const handleRerun = useCallback(() => {
    onRerun(jobId);
  }, [onRerun, jobId]);

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDelete();
    }
  }, [handleDelete]);

  const handleConfirmDelete = useCallback(() => {
    onDelete(jobId);
    setShowDeleteConfirm(false);
  }, [onDelete, jobId]);

  const handleConfirmDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleConfirmDelete();
    }
  }, [handleConfirmDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleCancelDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCancelDelete();
    }
  }, [handleCancelDelete]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'In Progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" role="main" aria-label="Loading job details">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" role="main" aria-label="Job error">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Job</h3>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <button
                onClick={handleBack}
                onKeyDown={handleBackKeyDown}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Go back to job list"
                tabIndex={0}
                role="button"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" role="main" aria-label="Job not found">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Job Not Found</h3>
              <p className="text-sm text-gray-500 mb-4">The requested job could not be found.</p>
              <button
                onClick={handleBack}
                onKeyDown={handleBackKeyDown}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Go back to job list"
                tabIndex={0}
                role="button"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" role="main" aria-labelledby="job-title">
      {/* Header */}
      <div className="bg-white shadow border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBack}
                  onKeyDown={handleBackKeyDown}
                  className="inline-flex items-center p-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Go back to job list"
                  tabIndex={0}
                  role="button"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div>
                  <h1 id="job-title" className="text-2xl font-bold text-gray-900">
                    {job.label || `Job ${job.id}`}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Job ID: {job.id} • Created: {formatDate(job.createdAt)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  aria-label="Export job and images"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>

                <button
                  onClick={handleRerun}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Rerun job"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Rerun
                </button>

                <button
                  onClick={handleDelete}
                  onKeyDown={handleDeleteKeyDown}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  aria-label="Delete job"
                  tabIndex={0}
                  role="button"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8" role="tablist" aria-label="Job detail tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                tabIndex={activeTab === tab.id ? 0 : -1}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Panels */}
        <div className="bg-white rounded-lg shadow">
          {/* Overview Tab */}
          <div
            id="overview-panel"
            role="tabpanel"
            aria-labelledby="overview-tab"
            className={activeTab === 'overview' ? 'block' : 'hidden'}
          >
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Job Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Basic Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Job ID</dt>
                      <dd className="text-sm text-gray-900 font-mono">{job.id}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Label</dt>
                      <dd className="text-sm text-gray-900">{job.label || 'No label'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="text-sm text-gray-900">{formatDate(job.createdAt)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Timing Information */}
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Timing</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Started</dt>
                      <dd className="text-sm text-gray-900">{job.startedAt ? formatDate(job.startedAt) : 'Not started'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Completed</dt>
                      <dd className="text-sm text-gray-900">{job.completedAt ? formatDate(job.completedAt) : 'Not completed'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Duration</dt>
                      <dd className="text-sm text-gray-900">{formatDuration(job.startedAt, job.completedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Image Statistics */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-md font-medium text-gray-700 mb-3">Image Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <dt className="text-sm font-medium text-gray-500">Total Images</dt>
                    <dd className="text-2xl font-bold text-gray-900">{images.length}</dd>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <dt className="text-sm font-medium text-green-600">Successful</dt>
                    <dd className="text-2xl font-bold text-green-900">
                      {images.filter(img => img.status === 'completed').length}
                    </dd>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <dt className="text-sm font-medium text-red-600">Failed</dt>
                    <dd className="text-2xl font-bold text-red-900">
                      {images.filter(img => img.status === 'failed').length}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Images Tab */}
          <div
            id="images-panel"
            role="tabpanel"
            aria-labelledby="images-tab"
            className={activeTab === 'images' ? 'block' : 'hidden'}
          >
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Generated Images</h2>
              
              {images.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No images generated</h3>
                  <p className="mt-1 text-sm text-gray-500">This job hasn't generated any images yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      role="article"
                      aria-labelledby={`image-${image.id}-title`}
                    >
                      <div className="aspect-w-1 aspect-h-1 mb-3">
                        <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      
                      <h3 id={`image-${image.id}-title`} className="text-sm font-medium text-gray-900 mb-2">
                        Image {image.id}
                      </h3>
                      
                      <div className="space-y-2 text-xs text-gray-500">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(image.status)}`}>
                            {image.status}
                          </span>
                        </div>
                        {image.filePath && (
                          <div className="flex justify-between">
                            <span>Path:</span>
                            <span className="truncate ml-2">{image.filePath}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Logs Tab */}
          <div
            id="logs-panel"
            role="tabpanel"
            aria-labelledby="logs-tab"
            className={activeTab === 'logs' ? 'block' : 'hidden'}
          >
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Job Logs</h2>
              
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No logs available</h3>
                  <p className="mt-1 text-sm text-gray-500">This job doesn't have any logs yet.</p>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-300 font-mono"
                        role="log"
                        aria-label={`Log entry ${index + 1}`}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirmation-title"
          aria-describedby="delete-confirmation-description"
        >
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 id="delete-confirmation-title" className="text-lg font-medium text-gray-900">
                  Confirm Deletion
                </h3>
              </div>
            </div>
            
            <div className="mb-6">
              <p id="delete-confirmation-description" className="text-sm text-gray-500">
                Are you sure you want to delete this job? This action cannot be undone and will permanently remove the job and all associated data.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                onKeyDown={handleCancelDeleteKeyDown}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                aria-label="Cancel deletion"
                tabIndex={0}
                role="button"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                onKeyDown={handleConfirmDeleteKeyDown}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                aria-label="Confirm deletion"
                tabIndex={0}
                role="button"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleJobView;
