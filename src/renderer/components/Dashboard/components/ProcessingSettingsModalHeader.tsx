/**
 * Story 3.4 Phase 5c.5: Header for ProcessingSettingsModal.
 */
import React from 'react';

interface ProcessingSettingsModalHeaderProps {
  selectedCount: number;
  onClose: () => void;
}

const ProcessingSettingsModalHeader: React.FC<ProcessingSettingsModalHeaderProps> = ({
  selectedCount,
  onClose,
}) => (
  <div data-testid="modal-header" className="flex items-center justify-between p-6 border-b border-gray-200">
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Retry Processing Settings</h2>
      <p className="text-sm text-gray-600">
        Configure how to process {selectedCount} selected images for retry
      </p>
    </div>
    <button
      type="button"
      onClick={onClose}
      className="text-gray-400 hover:text-gray-600 transition-colors"
      aria-label="Close modal"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

export default ProcessingSettingsModalHeader;
