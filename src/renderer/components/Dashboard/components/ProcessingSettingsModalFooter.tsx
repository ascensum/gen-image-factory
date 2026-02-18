/**
 * Story 3.4 Phase 5c.5: Footer for ProcessingSettingsModal.
 */
import React from 'react';

interface ProcessingSettingsModalFooterProps {
  useOriginalSettings: boolean;
  selectedCount: number;
  onClose: () => void;
  onRetry: () => void;
}

const ProcessingSettingsModalFooter: React.FC<ProcessingSettingsModalFooterProps> = ({
  useOriginalSettings,
  selectedCount,
  onClose,
  onRetry,
}) => (
  <div data-testid="modal-footer" className="flex justify-end space-x-3 p-6 border-t border-gray-200">
    <button
      onClick={onClose}
      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
    >
      Cancel
    </button>
    <button
      onClick={onRetry}
      className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
    >
      {useOriginalSettings ? 'Retry with Original Settings' : 'Retry with Modified Settings'} ({selectedCount} images)
    </button>
  </div>
);

export default ProcessingSettingsModalFooter;
