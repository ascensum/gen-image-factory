import React from 'react';

interface JobStatisticsProps {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
  pendingJobs: number;
  totalImages: number;
  averageImagesPerJob: number;
  isLoading?: boolean;
}

const JobStatistics: React.FC<JobStatisticsProps> = ({
  totalJobs,
  completedJobs,
  failedJobs,
  processingJobs,
  pendingJobs,
  totalImages,
  averageImagesPerJob,
  isLoading = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'pending':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
    }
  };

  const getCompletionRate = () => {
    if (totalJobs === 0) return 0;
    return Math.round((completedJobs / totalJobs) * 100);
  };

  const getFailureRate = () => {
    if (totalJobs === 0) return 0;
    return Math.round((failedJobs / totalJobs) * 100);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6" role="region" aria-label="Job Statistics">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Job Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6" role="region" aria-labelledby="statistics-title">
      <header className="mb-6">
        <h2 id="statistics-title" className="text-lg font-medium text-gray-900">
          Job Statistics Overview
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Summary of job execution status and performance metrics
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Jobs Card */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600" id="total-jobs-label">
                Total Jobs
              </p>
              <p className="text-2xl font-bold text-gray-900" aria-labelledby="total-jobs-label">
                {totalJobs.toLocaleString()}
              </p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Images Card */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600" id="total-images-label">
                Total Images
              </p>
              <p className="text-2xl font-bold text-blue-900" aria-labelledby="total-images-label">
                {totalImages.toLocaleString()}
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Average Images Per Job Card */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600" id="avg-images-label">
                Avg Images/Job
              </p>
              <p className="text-2xl font-bold text-green-900" aria-labelledby="avg-images-label">
                {averageImagesPerJob.toFixed(1)}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Completion Rate Card */}
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600" id="completion-rate-label">
                Completion Rate
              </p>
              <p className="text-2xl font-bold text-purple-900" aria-labelledby="completion-rate-label">
                {getCompletionRate()}%
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="space-y-4">
        <h3 className="text-md font-medium text-gray-900" id="status-breakdown-title">
          Status Breakdown
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { status: 'completed', count: completedJobs, label: 'Completed' },
            { status: 'failed', count: failedJobs, label: 'Failed' },
            { status: 'processing', count: processingJobs, label: 'Processing' },
            { status: 'pending', count: pendingJobs, label: 'Pending' }
          ].map(({ status, count, label }) => (
            <div
              key={status}
              className={`rounded-lg p-4 border ${getStatusColor(status)}`}
              role="article"
              aria-labelledby={`${status}-status-label`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" id={`${status}-status-label`}>
                    {label}
                  </p>
                  <p className="text-xl font-bold">
                    {count.toLocaleString()}
                  </p>
                  {totalJobs > 0 && (
                    <p className="text-xs opacity-75">
                      {Math.round((count / totalJobs) * 100)}% of total
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-white bg-opacity-50">
                  {getStatusIcon(status)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-md font-medium text-gray-900 mb-4" id="performance-metrics-title">
          Performance Metrics
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Success vs Failure Chart */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Success vs Failure Rate</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium text-green-600">{getCompletionRate()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getCompletionRate()}%` }}
                  role="progressbar"
                  aria-valuenow={getCompletionRate()}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Success rate progress"
                ></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Failure Rate</span>
                <span className="text-sm font-medium text-red-600">{getFailureRate()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getFailureRate()}%` }}
                  role="progressbar"
                  aria-valuenow={getFailureRate()}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Failure rate progress"
                ></div>
              </div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Insights</h4>
            <div className="space-y-2 text-sm text-gray-600">
              {totalJobs === 0 ? (
                <p>No jobs have been executed yet.</p>
              ) : (
                <>
                  {completedJobs > 0 && (
                    <p>✓ {completedJobs} job{completedJobs !== 1 ? 's' : ''} completed successfully</p>
                  )}
                  {failedJobs > 0 && (
                    <p>⚠ {failedJobs} job{failedJobs !== 1 ? 's' : ''} failed</p>
                  )}
                  {processingJobs > 0 && (
                    <p>🔄 {processingJobs} job{processingJobs !== 1 ? 's' : ''} currently processing</p>
                  )}
                  {pendingJobs > 0 && (
                    <p>⏳ {pendingJobs} job{pendingJobs !== 1 ? 's' : ''} waiting in queue</p>
                  )}
                  {averageImagesPerJob > 0 && (
                    <p>📊 Average of {averageImagesPerJob.toFixed(1)} images per job</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobStatistics;
