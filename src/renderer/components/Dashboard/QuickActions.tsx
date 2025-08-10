import React, { useState } from 'react';

interface QuickActionsProps {
  jobStatus: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  onJobAction: (action: string, jobId: string) => void;
  onImageAction: (action: string, imageId: string, data?: any) => void;
  isLoading: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  jobStatus,
  onJobAction,
  onImageAction,
  isLoading
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAction = (action: string, data?: any) => {
    setShowDropdown(false);
    
    switch (action) {
      case 'export-all':
        // Export all jobs to Excel
        onJobAction('export', 'all');
        break;
      case 'clear-completed':
        // Clear completed jobs
        if (window.confirm('Are you sure you want to clear all completed jobs? This action cannot be undone.')) {
          onJobAction('clear-completed', 'all');
        }
        break;
      case 'approve-all-pending':
        // Approve all pending images
        if (window.confirm('Are you sure you want to approve all pending images?')) {
          onImageAction('approve-all-pending', 'all');
        }
        break;
      case 'delete-rejected':
        // Delete all rejected images
        if (window.confirm('Are you sure you want to delete all rejected images? This action cannot be undone.')) {
          onImageAction('delete-rejected', 'all');
        }
        break;
      case 'export-images':
        // Export image metadata
        onImageAction('export-metadata', 'all');
        break;
      case 'refresh':
        // Refresh data
        window.location.reload();
        break;
    }
  };

  return (
    <div className="relative">
      {/* Quick Actions Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isLoading}
        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Quick Actions
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {/* Job Actions Section */}
            <div className="px-3 py-2 border-b border-gray-100">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Job Actions</h3>
            </div>
            
            <button
              onClick={() => handleAction('export-all')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export All Jobs to Excel
            </button>
            
            <button
              onClick={() => handleAction('clear-completed')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Completed Jobs
            </button>

            {/* Image Actions Section */}
            <div className="px-3 py-2 border-b border-gray-100 mt-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Image Actions</h3>
            </div>
            
            <button
              onClick={() => handleAction('approve-all-pending')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Approve All Pending Images
            </button>
            
            <button
              onClick={() => handleAction('delete-rejected')}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete All Rejected Images
            </button>
            
            <button
              onClick={() => handleAction('export-images')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Export Image Metadata
            </button>

            {/* System Actions Section */}
            <div className="px-3 py-2 border-b border-gray-100 mt-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">System</h3>
            </div>
            
            <button
              onClick={() => handleAction('refresh')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default QuickActions;
