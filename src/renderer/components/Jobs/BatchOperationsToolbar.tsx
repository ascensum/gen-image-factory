import React from 'react';

interface BatchOperationsToolbarProps {
  selectedJobs: Set<string>;
  totalJobs: number;
  onClearSelection: () => void;
  onBatchRerun: () => Promise<void>;
  onBatchExport: () => Promise<void>;
  onBatchDelete: () => Promise<void>;
  isRerunInProgress: boolean;
  isExportInProgress: boolean;
  isDeleteInProgress: boolean;
  rerunProgress?: number;
  exportProgress?: number;
  deleteProgress?: number;
  queuedJobs?: number;
}

const BatchOperationsToolbar: React.FC<BatchOperationsToolbarProps> = ({
  selectedJobs,
  totalJobs,
  onClearSelection,
  onBatchRerun,
  onBatchExport,
  onBatchDelete,
  isRerunInProgress,
  isExportInProgress,
  isDeleteInProgress,
  rerunProgress = 0,
  exportProgress = 0,
  deleteProgress = 0,
  queuedJobs = 0
}) => {
  const selectedCount = selectedJobs.size;
  const selectedPercentage = totalJobs > 0 ? Math.round((selectedCount / totalJobs) * 100) : 0;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center justify-between">
        {/* Selection Info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">
              {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <span className="text-sm text-gray-500">
              ({selectedPercentage}% of total)
            </span>
          </div>
          
          {queuedJobs > 0 && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-blue-600">
                {queuedJobs} job{queuedJobs !== 1 ? 's' : ''} queued for rerun
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* Rerun Button */}
          <button
            onClick={onBatchRerun}
            disabled={isRerunInProgress || isExportInProgress || isDeleteInProgress}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isRerunInProgress
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isRerunInProgress ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Rerunning...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rerun Selected
              </>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={onBatchExport}
            disabled={isRerunInProgress || isExportInProgress || isDeleteInProgress}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              isExportInProgress
                ? 'bg-green-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isExportInProgress ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Selected
              </>
            )}
          </button>

          {/* Delete Button */}
          <button
            onClick={onBatchDelete}
            disabled={isRerunInProgress || isExportInProgress || isDeleteInProgress}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
              isDeleteInProgress
                ? 'bg-red-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isDeleteInProgress ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </>
            )}
          </button>

          {/* Clear Selection Button */}
          <button
            onClick={onClearSelection}
            disabled={isRerunInProgress || isExportInProgress || isDeleteInProgress}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Progress Bars */}
      {(isRerunInProgress || isExportInProgress || isDeleteInProgress) && (
        <div className="mt-4 space-y-3">
          {isRerunInProgress && (
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Rerun Progress</span>
                <span>{Math.round(rerunProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${rerunProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {isExportInProgress && (
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Export Progress</span>
                <span>{Math.round(exportProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {isDeleteInProgress && (
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Delete Progress</span>
                <span>{Math.round(deleteProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${deleteProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchOperationsToolbar;
