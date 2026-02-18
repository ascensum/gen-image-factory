/**
 * Story 3.4 Phase 3: Bulk action controls for Failed Images Review.
 * Approve Selected, Retry Selected, Delete Selected.
 */
import React from 'react';

export interface BulkActionsProps {
  selectedCount: number;
  totalCount: number;
  isProcessing: boolean;
  onSelectAll: () => void;
  onBulkApprove: () => void;
  onBulkRetry: () => void;
  onBulkDelete: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  totalCount,
  isProcessing,
  onSelectAll,
  onBulkApprove,
  onBulkRetry,
  onBulkDelete,
}) => (
  <div className="flex items-center gap-4 flex-wrap">
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={selectedCount === totalCount && totalCount > 0}
        onChange={onSelectAll}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">
        Select All ({selectedCount}/{totalCount})
      </span>
    </div>
    <div className="flex items-center space-x-2">
      <button
        onClick={onBulkApprove}
        disabled={selectedCount === 0}
        className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
          selectedCount === 0
            ? 'bg-green-200 text-green-400 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
        title={selectedCount === 0 ? 'Select images to enable' : 'Approve selected images'}
      >
        Approve Selected
      </button>
      <button
        onClick={onBulkRetry}
        disabled={selectedCount === 0 || isProcessing}
        className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
          selectedCount === 0 || isProcessing
            ? 'bg-blue-200 text-blue-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        title={
          selectedCount === 0
            ? 'Select images to enable'
            : isProcessing
              ? 'Retry is currently processing. Please wait for completion.'
              : 'Retry selected images (batch)'
        }
      >
        Retry Selected
        {isProcessing && (
          <svg className="ml-1 w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 00-10 10h2a8 8 0 018-8V2z" />
          </svg>
        )}
      </button>
      <button
        onClick={onBulkDelete}
        disabled={selectedCount === 0}
        className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
          selectedCount === 0
            ? 'bg-red-200 text-red-400 cursor-not-allowed'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
        title={selectedCount === 0 ? 'Select images to enable' : 'Delete selected images'}
      >
        Delete Selected
      </button>
    </div>
  </div>
);

export default BulkActions;
