import React from 'react';

export interface LogViewerSummaryProps {
  totalCount: number;
  searchTerm: string;
  jobStatus: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
}

const LogViewerSummary: React.FC<LogViewerSummaryProps> = ({
  totalCount,
  searchTerm,
  jobStatus
}) => (
  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
    <div>
      {`${totalCount} logs`}
      {searchTerm && ` matching "${searchTerm}"`}
    </div>
    <div>
      {jobStatus === 'running' && (
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live updates</span>
        </div>
      )}
    </div>
  </div>
);

export default LogViewerSummary;
