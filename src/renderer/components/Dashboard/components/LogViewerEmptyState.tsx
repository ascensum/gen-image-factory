import React from 'react';

export type LogViewerEmptyVariant = 'loading' | 'empty' | 'noMatch';

export interface LogViewerEmptyStateProps {
  variant: LogViewerEmptyVariant;
}

const LogViewerEmptyState: React.FC<LogViewerEmptyStateProps> = ({ variant }) => {
  if (variant === 'loading') {
    return (
      <div className="text-center text-gray-500 py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <span className="ml-2 text-gray-600">Loading logs...</span>
      </div>
    );
  }
  if (variant === 'empty') {
    return (
      <div className="text-center text-gray-500 py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No logs available</h3>
        <p className="mt-1 text-sm text-gray-500">Logs will appear here when a job is running or has completed.</p>
      </div>
    );
  }
  return (
    <div className="text-center text-gray-500 py-8">
      No logs match the current filters.
    </div>
  );
};

export default LogViewerEmptyState;
