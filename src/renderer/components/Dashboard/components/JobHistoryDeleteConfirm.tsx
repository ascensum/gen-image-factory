/**
 * Story 3.4 Phase 5c.6: Delete confirmation dialog for JobHistory.
 */
import React from 'react';

interface JobHistoryDeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const JobHistoryDeleteConfirm: React.FC<JobHistoryDeleteConfirmProps> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Job</h3>
      <p className="text-sm text-gray-500 mb-6">
        Are you sure you want to delete this job? This action cannot be undone.
      </p>
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default JobHistoryDeleteConfirm;
