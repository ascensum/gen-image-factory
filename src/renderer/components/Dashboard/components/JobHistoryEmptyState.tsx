/**
 * Story 3.4 Phase 5c.6: Empty and loading states for JobHistory.
 */
import React from 'react';

interface JobHistoryEmptyStateProps {
  variant: 'loading' | 'empty';
}

const JobHistoryEmptyState: React.FC<JobHistoryEmptyStateProps> = ({ variant }) => (
  <div className="flex flex-col h-full min-h-0">
    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">Job History</h2>
    {variant === 'loading' ? (
      <div className="flex-1 flex items-center justify-center py-8 min-h-0">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading job history...</span>
      </div>
    ) : (
      <div className="flex-1 flex flex-col items-center justify-center py-8 min-h-0">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No job history available</h3>
        <p className="mt-1 text-sm text-gray-500">Start your first job to see it here.</p>
      </div>
    )}
  </div>
);

export default JobHistoryEmptyState;
