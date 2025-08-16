import React from 'react';

interface JobControlsProps {
  jobStatus: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  onStartJob: () => void;
  onStopJob: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const JobControls: React.FC<JobControlsProps> = ({
  jobStatus,
  onStartJob,
  onStopJob,
  onRefresh,
  isLoading
}) => {
  const isJobRunning = jobStatus === 'running' || jobStatus === 'starting';
  const canStartJob = jobStatus === 'idle' || jobStatus === 'completed' || jobStatus === 'failed' || jobStatus === 'stopped';
  const canStopJob = isJobRunning;

  return (
    <div className="flex items-center space-x-3">
      {/* Start Job Button */}
      <button
        onClick={onStartJob}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canStartJob && !isLoading) {
            onStartJob();
          }
        }}
        disabled={!canStartJob || isLoading}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
          canStartJob && !isLoading
            ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        aria-label="Start job"
      >
        {isLoading && jobStatus === 'starting' ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Starting...
          </>
        ) : (
          <>
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Job
          </>
        )}
      </button>

      {/* Stop Job Button */}
      <button
        onClick={onStopJob}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canStopJob && !isLoading) {
            onStopJob();
          }
        }}
        disabled={!canStopJob || isLoading}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
          canStopJob && !isLoading
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        aria-label="Stop job"
      >
        {isLoading && (jobStatus === 'running' || jobStatus === 'stopping') ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Stopping...
          </>
        ) : (
          <>
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop Job
          </>
        )}
      </button>

      {/* Refresh Button */}
      <button
        onClick={onRefresh}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isLoading) {
            onRefresh();
          }
        }}
        disabled={isLoading}
        className={`inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
          !isLoading
            ? 'bg-white hover:bg-gray-50 focus:ring-blue-500 text-gray-700 border-gray-300'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
        }`}
        aria-label="Refresh data"
        title="Refresh job history and statistics"
      >
        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>

      {/* Job Status Indicator */}
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          jobStatus === 'idle' ? 'bg-gray-400' :
          jobStatus === 'starting' ? 'bg-yellow-400' :
          jobStatus === 'running' ? 'bg-green-400' :
          jobStatus === 'completed' ? 'bg-blue-400' :
          jobStatus === 'failed' ? 'bg-red-400' :
          'bg-gray-400'
        }`} />
        <span className={`text-sm ${
          jobStatus === 'idle' ? 'bg-green-100 text-green-800 px-2 py-1 rounded-full' :
          jobStatus === 'starting' ? 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full' :
          jobStatus === 'running' ? 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full' :
          jobStatus === 'completed' ? 'bg-green-100 text-green-800 px-2 py-1 rounded-full' :
          jobStatus === 'failed' ? 'bg-red-100 text-red-800 px-2 py-1 rounded-full' :
          'bg-gray-100 text-gray-800 px-2 py-1 rounded-full'
        }`}>
          {jobStatus === 'idle' && 'Ready'}
          {jobStatus === 'starting' && 'Starting...'}
          {jobStatus === 'running' && 'Running'}
          {jobStatus === 'completed' && 'Completed'}
          {jobStatus === 'failed' && 'Failed'}
          {jobStatus === 'stopped' && 'Stopped'}
        </span>
      </div>
    </div>
  );
};

export default JobControls;
