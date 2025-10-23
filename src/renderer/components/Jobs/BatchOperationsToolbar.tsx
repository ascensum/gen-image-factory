import React, { useState, useCallback } from 'react';

interface BatchOperationsToolbarProps {
  selectedCount: number;
  totalJobs: number;
  onBulkRerun: () => void;
  onBulkExport: () => void;
  onBulkDelete: () => void;
  onSelectAll: (selected: boolean) => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

const BatchOperationsToolbar: React.FC<BatchOperationsToolbarProps> = ({
  selectedCount,
  totalJobs,
  onBulkRerun,
  onBulkExport,
  onBulkDelete,
  onSelectAll,
  isAllSelected,
  isIndeterminate,
  isLoading = false,
  disabled = false
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleSelectAll = useCallback((checked: boolean) => {
    onSelectAll(checked);
  }, [onSelectAll]);

  const handleSelectAllKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectAll(!isAllSelected);
    }
  }, [handleSelectAll, isAllSelected]);

  const handleBulkRerun = useCallback(() => {
    if (selectedCount > 0 && !disabled) {
      onBulkRerun();
    }
  }, [selectedCount, disabled, onBulkRerun]);

  const handleBulkExport = useCallback(() => {
    if (selectedCount > 0 && !disabled) {
      onBulkExport();
    }
  }, [selectedCount, disabled, onBulkExport]);

  const handleBulkDelete = useCallback(() => {
    if (selectedCount > 0 && !disabled) {
      setShowConfirmDelete(true);
    }
  }, [selectedCount, disabled]);

  const handleConfirmDelete = useCallback(() => {
    onBulkDelete();
    setShowConfirmDelete(false);
  }, [onBulkDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmDelete(false);
  }, []);

  const handleDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBulkDelete();
    }
  }, [handleBulkDelete]);

  const handleConfirmDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleConfirmDelete();
    }
  }, [handleConfirmDelete]);

  const handleCancelDeleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCancelDelete();
    }
  }, [handleCancelDelete]);

  const getSelectionText = () => {
    if (selectedCount === 0) return 'No jobs selected';
    if (selectedCount === totalJobs) return `All ${totalJobs} jobs selected`;
    return `${selectedCount} of ${totalJobs} jobs selected`;
  };

  const getSelectionAriaLabel = () => {
    if (selectedCount === 0) return 'No jobs are currently selected';
    if (selectedCount === totalJobs) return `All ${totalJobs} jobs are selected`;
    return `${selectedCount} out of ${totalJobs} jobs are selected`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6">
      {/* Selection Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {/* Select All Checkbox */}
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isIndeterminate;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                disabled={disabled || isLoading}
                aria-label="Select all jobs"
                aria-describedby="select-all-help"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Select All
              </span>
            </label>
            <div className="ml-2">
              <button
                onClick={() => handleSelectAll(!isAllSelected)}
                onKeyDown={handleSelectAllKeyDown}
                className="text-xs text-gray-500 hover:text-gray-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                tabIndex={0}
                role="button"
                aria-label={isAllSelected ? 'Deselect all jobs' : 'Select all jobs'}
              >
                {isAllSelected ? 'Deselect' : 'Select'}
              </button>
            </div>
          </div>

          {/* Selection Count */}
          <div className="text-sm text-gray-600" aria-label={getSelectionAriaLabel()}>
            {getSelectionText()}
          </div>
        </div>

        {/* Help Text */}
        <div id="select-all-help" className="text-xs text-gray-500">
          Use Ctrl+A to select all jobs
        </div>
      </div>

      {/* Batch Operations */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Bulk Rerun Button */}
          <button
            onClick={handleBulkRerun}
            disabled={selectedCount === 0 || disabled || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              selectedCount === 0 || disabled || isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
            }`}
            aria-label={`Rerun ${selectedCount} selected job${selectedCount !== 1 ? 's' : ''}`}
            aria-describedby="rerun-help"
            aria-disabled={selectedCount === 0 || disabled || isLoading}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              <span>Rerun ({selectedCount})</span>
            </div>
          </button>
          <div id="rerun-help" className="sr-only">
            Rerun selected jobs with their original settings
          </div>

          {/* Bulk Export Button */}
          <button
            onClick={handleBulkExport}
            disabled={selectedCount === 0 || disabled || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              selectedCount === 0 || disabled || isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
            }`}
            aria-label={`Export ${selectedCount} selected job${selectedCount !== 1 ? 's' : ''}`}
            aria-describedby="export-help"
            aria-disabled={selectedCount === 0 || disabled || isLoading}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export ({selectedCount})</span>
            </div>
          </button>
          <div id="export-help" className="sr-only">
            Export selected jobs and their generated images
          </div>

          {/* Bulk Delete Button */}
          <button
            onClick={handleBulkDelete}
            onKeyDown={handleDeleteKeyDown}
            disabled={selectedCount === 0 || disabled || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              selectedCount === 0 || disabled || isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
            }`}
            aria-label={`Delete ${selectedCount} selected job${selectedCount !== 1 ? 's' : ''}`}
            aria-describedby="delete-help"
            aria-disabled={selectedCount === 0 || disabled || isLoading}
            tabIndex={0}
            role="button"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete ({selectedCount})</span>
            </div>
          </button>
          <div id="delete-help" className="sr-only">
            Permanently delete selected jobs and their data
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="text-xs text-gray-500">
          <span className="hidden sm:inline">Keyboard shortcuts: </span>
          <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 rounded">Ctrl+A</kbd> Select All,{' '}
          <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 rounded">Delete</kbd> Delete Selected
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      {showConfirmDelete && (
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
                Are you sure you want to delete {selectedCount} selected job{selectedCount !== 1 ? 's' : ''}? 
                This action cannot be undone and will permanently remove all associated data.
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

      {/* Loading State */}
      {isLoading && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-blue-800">Processing batch operation...</span>
          </div>
        </div>
      )}

      {/* No Selection State */}
      {selectedCount === 0 && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-sm text-gray-600">
            Select one or more jobs to perform batch operations.
          </p>
        </div>
      )}
    </div>
  );
};

export default BatchOperationsToolbar;
