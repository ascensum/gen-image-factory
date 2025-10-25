import React from 'react';

interface ConfirmResetDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onFullReset: () => void; // clears API keys
  onSoftReset: () => void; // keeps API keys
}

const ConfirmResetDialog: React.FC<ConfirmResetDialogProps> = ({
  isOpen,
  title = 'Reset to Defaults',
  description = 'Choose how you want to reset. You can reset everything (including API keys) or keep your API keys and reset all other settings.',
  onClose,
  onFullReset,
  onSoftReset
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {description && (
          <p className="text-gray-600 mb-4">{description}</p>
        )}

        <div className="space-y-3">
          <button
            onClick={onFullReset}
            className="w-full box-border bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors whitespace-normal break-words text-center"
          >
            Full Reset (clear API keys)
          </button>
          <button
            onClick={onSoftReset}
            className="w-full box-border bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-normal break-words text-center"
          >
            Reset (keep API keys)
          </button>
          <button
            onClick={onClose}
            className="w-full box-border bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors whitespace-normal break-words text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmResetDialog;


