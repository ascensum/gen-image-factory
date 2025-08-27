import React, { useState } from 'react';
import { Toggle } from '../Settings/Toggle';

interface ProcessingSettings {
  imageEnhancement: boolean;
  sharpening: number;
  saturation: number;
  imageConvert: boolean;
  convertToJpg: boolean;
  jpgQuality: number;
  pngQuality: number;
  removeBg: boolean;
  removeBgSize: string;
  trimTransparentBackground: boolean;
  jpgBackground: string;
}

interface ProcessingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: (useOriginalSettings: boolean, modifiedSettings?: ProcessingSettings, includeMetadata?: boolean) => void;
  selectedCount: number;
}

const ProcessingSettingsModal: React.FC<ProcessingSettingsModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  selectedCount
}) => {
  const [useOriginalSettings, setUseOriginalSettings] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [batchSettings, setBatchSettings] = useState<ProcessingSettings>({
    imageEnhancement: false,
    sharpening: 5,
    saturation: 1.4,
    imageConvert: false,
    convertToJpg: true,
    jpgQuality: 90,
    pngQuality: 9,
    removeBg: false,
    removeBgSize: 'auto',
    trimTransparentBackground: false,
    jpgBackground: '#FFFFFF'
  });

  if (!isOpen) return null;

  const handleRetry = () => {
    if (useOriginalSettings) {
      onRetry(true, undefined, includeMetadata);
    } else {
      onRetry(false, batchSettings, includeMetadata);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const updateSetting = (key: keyof ProcessingSettings, value: any) => {
    setBatchSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div data-testid="processing-settings-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
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

        {/* Content */}
        <div data-testid="modal-content" className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Batch Processing Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-800">Batch Processing</h4>
                <p className="text-sm text-blue-700 mt-1">
                  All {selectedCount} selected images will be processed together with the same settings. 
                  This ensures consistent results across the entire batch.
                </p>
              </div>
            </div>
          </div>

          {/* Settings Choice */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Processing Method</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="processingMethod"
                  value="original"
                  aria-label="Retry with Original Settings"
                  checked={useOriginalSettings}
                  onChange={() => setUseOriginalSettings(true)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Retry with Original Settings</div>
                  <div className="text-xs text-gray-500">
                    Process all images with their original job settings (QC, metadata, processing)
                  </div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="processingMethod"
                  value="modified"
                  aria-label="Retry with Modified Settings"
                  checked={!useOriginalSettings}
                  onChange={() => setUseOriginalSettings(false)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Retry with Modified Settings</div>
                  <div className="text-xs text-gray-500">
                    Process all images with new settings (QC, metadata, processing) - no image regeneration
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Metadata Regeneration Option */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Metadata Options</h3>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-800">Metadata Regeneration</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Choose whether to regenerate metadata for the selected images during retry processing.
                  </p>
                  <div className="mt-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        aria-label="Also regenerate metadata"
                        checked={includeMetadata}
                        onChange={(e) => setIncludeMetadata(e.target.checked)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-blue-800 font-medium">
                        Also regenerate metadata (titles, descriptions, tags)
                      </span>
                    </label>
                    <p className="text-xs text-blue-600 mt-1">
                      This will regenerate AI-generated metadata for all selected images using the current AI model settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modified Settings Configuration */}
          {!useOriginalSettings && (
            <div className="space-y-6">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Important Note</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      These settings will be applied to all {selectedCount} images in the batch. 
                      Images will NOT be regenerated - only QC, metadata, and processing will be updated.
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900">Batch Processing Configuration</h3>
              
              {/* Image Enhancement */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Image Enhancement</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      aria-label="Enable image enhancement"
                      checked={batchSettings.imageEnhancement}
                      onChange={(e) => updateSetting('imageEnhancement', e.target.checked)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Enable Image Enhancement</span>
                  </label>
                  
                  <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                       Sharpening Level: {batchSettings.sharpening}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                         value={batchSettings.sharpening}
                         onChange={(e) => updateSetting('sharpening', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                       Saturation: {batchSettings.saturation}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                         value={batchSettings.saturation}
                         onChange={(e) => updateSetting('saturation', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Image Conversion */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Image Conversion</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      aria-label="Enable image conversion"
                      checked={batchSettings.imageConvert}
                      onChange={(e) => updateSetting('imageConvert', e.target.checked)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Convert Image Format</span>
                  </label>
                  
                   {batchSettings.imageConvert && (
                    <>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                           checked={batchSettings.convertToJpg}
                          onChange={(e) => updateSetting('convertToJpg', e.target.checked)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Convert to JPG</span>
                      </label>
                      
                       {batchSettings.convertToJpg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                             JPG Quality: {batchSettings.jpgQuality}%
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="100"
                             value={batchSettings.jpgQuality}
                            onChange={(e) => updateSetting('jpgQuality', parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                      
                       {!batchSettings.convertToJpg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                             PNG Quality: {batchSettings.pngQuality}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="9"
                             value={batchSettings.pngQuality}
                            onChange={(e) => updateSetting('pngQuality', parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Background Removal */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Background Processing</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      aria-label="Remove background"
                      checked={batchSettings.removeBg}
                      onChange={(e) => updateSetting('removeBg', e.target.checked)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Remove Background</span>
                  </label>
                  
                   {batchSettings.removeBg && (
                    <>
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Remove BG Size
                        </label>
                        <select
                          aria-label="Remove BG Size"
                          value={batchSettings.removeBgSize}
                          onChange={(e) => updateSetting('removeBgSize', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="auto">Auto</option>
                          <option value="preview">Preview</option>
                          <option value="full">Full</option>
                        </select>
                      </div>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          aria-label="Trim transparent background"
                          checked={batchSettings.trimTransparentBackground}
                          onChange={(e) => updateSetting('trimTransparentBackground', e.target.checked)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Trim Transparent Background</span>
                      </label>
                      
                       {batchSettings.convertToJpg && (
                        <div>
                          <label htmlFor="jpgBackgroundColor" className="block text-sm font-medium text-gray-700 mb-1">
                            JPG Background Color
                          </label>
                          <input
                            id="jpgBackgroundColor"
                            aria-label="JPG Background Color"
                            type="color"
                            value={batchSettings.jpgBackground}
                            onChange={(e) => updateSetting('jpgBackground', e.target.value)}
                            className="w-full h-10 border border-gray-300 rounded-md"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div data-testid="modal-footer" className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRetry}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            {useOriginalSettings ? 'Retry with Original Settings' : 'Retry with Modified Settings'} ({selectedCount} images)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessingSettingsModal;
