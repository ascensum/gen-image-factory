import React, { useState, useCallback } from 'react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => Promise<{ success: boolean; message?: string; error?: string; filename?: string; isProgress?: boolean }>;
  title: string;
  description?: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  title,
  description
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    filename?: string;
    isProgress?: boolean;
  } | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportResult(null);
    
    try {
      // Show initial progress
      setExportResult({
        success: true,
        message: 'Starting export...',
        isProgress: true
      });
      
      const result = await onExport();
      
      // Add small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setExportResult(result);
      
      if (result.success) {
        // Auto-close after 5 seconds on success
        setTimeout(() => {
          handleClose();
        }, 5000);
      }
    } catch (error) {
      setExportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsExporting(false);
    }
  }, [onExport, onClose]);

  const handleOpenExportsFolder = useCallback(async () => {
    try {
      await window.electronAPI.openExportsFolder();
    } catch (error) {
      console.error('Failed to open exports folder:', error);
    }
  }, []);

  const handleClose = useCallback(() => {
    // Reset all state when closing
    setIsExporting(false);
    setExportResult(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isExporting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {description && (
          <p className="text-gray-600 mb-4">{description}</p>
        )}

        {!exportResult && !isExporting && (
          <div className="space-y-4">
            <p className="text-gray-700">Ready to export. Click Export to continue.</p>
            <div className="flex space-x-3">
              <button
                onClick={handleExport}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Export
              </button>
                                        <button
                            onClick={handleClose}
                            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
            </div>
          </div>
        )}

        {isExporting && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Exporting...</span>
            </div>
            <p className="text-sm text-gray-500">Creating Excel file with job details and settings...</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: '100%' }}></div>
            </div>
            
            {exportResult?.isProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">{exportResult.message}</p>
              </div>
            )}
          </div>
        )}

        {exportResult && (
          <div className="space-y-4">
            {exportResult.success ? (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Export Successful!</h4>
                {exportResult.message && (
                  <p className="text-gray-600 mb-2">{exportResult.message}</p>
                )}
                {exportResult.filename && (
                  <p className="text-sm text-gray-500 mb-4">File: {exportResult.filename}</p>
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={handleOpenExportsFolder}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open Exports Folder
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Export Failed</h4>
                <p className="text-red-600 mb-4">{exportResult.error}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleExport}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportDialog;
