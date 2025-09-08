import React, { useState } from 'react';
import { Toggle } from '../Settings/Toggle';
import type { ProcessingSettings } from '../../../types/processing';

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
    saturation: 1.0,
    imageConvert: true, // Enable by default for testing
    convertToJpg: true, // Convert to JPG by default
    jpgQuality: 85, // Set to 85% quality as requested
    pngQuality: 100,
    removeBg: false,
    removeBgSize: 'auto',
    trimTransparentBackground: false,
    jpgBackground: '#FFFFFF'
  });

  if (!isOpen) return null;

  const handleRetry = () => {
    console.log('🔍 ProcessingSettingsModal: handleRetry called');
    console.log('🔍 ProcessingSettingsModal: useOriginalSettings:', useOriginalSettings);
    console.log('🔍 ProcessingSettingsModal: includeMetadata:', includeMetadata);
    console.log('🔍 ProcessingSettingsModal: batchSettings keys:', Object.keys(batchSettings));
    
    if (useOriginalSettings) {
      console.log('🔍 ProcessingSettingsModal: Retrying with original settings');
      onRetry(true, undefined, includeMetadata);
    } else {
      console.log('🔍 ProcessingSettingsModal: Retrying with modified settings keys:', Object.keys(batchSettings));
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

  // Computed values for conditional rendering
  const showSharpening = batchSettings.imageEnhancement;
  const showSaturation = batchSettings.imageEnhancement;
  const showConvertFormat = batchSettings.imageConvert;
  const showQualitySettings = batchSettings.imageConvert;
  const showJpgQuality = batchSettings.imageConvert && batchSettings.convertToJpg;
  const showPngQuality = batchSettings.imageConvert && !batchSettings.convertToJpg;
  const showTrimTransparent = batchSettings.removeBg;
  const showJpgBackground = batchSettings.removeBg && batchSettings.imageConvert && batchSettings.convertToJpg;

  return (
    <div data-testid="processing-settings-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
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
          <div className="mb-8">
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
          <div className="mb-8">
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
            <div className="space-y-8">
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
                    <p className="text-sm text-yellow-600 mt-2">
                      <strong>Current defaults:</strong> Image conversion enabled, converting to JPG at 85% quality
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900">Batch Processing Configuration</h3>
              
              {/* Image Enhancement Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-800">Image Enhancement</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image Enhancement
                    </label>
                    <p className="text-xs text-gray-500">Enable image enhancement effects (sharpening, saturation)</p>
                  </div>
                  <Toggle
                    checked={batchSettings.imageEnhancement}
                    onChange={(checked) => updateSetting('imageEnhancement', checked)}
                  />
                </div>

                {/* Sharpening - only show when Image Enhancement is enabled */}
                {showSharpening && (
                  <div>
                    <label htmlFor="sharpening" className="block text-sm font-medium text-gray-700 mb-2">
                      Sharpening Level (0-10)
                    </label>
                    <input
                      id="sharpening"
                      type="number"
                      value={batchSettings.sharpening}
                      onChange={(e) => updateSetting('sharpening', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="10"
                    />
                    <p className="text-xs text-gray-500 mt-1">Sharpening intensity for image enhancement</p>
                  </div>
                )}

                {/* Saturation - only show when Image Enhancement is enabled */}
                {showSaturation && (
                  <div>
                    <label htmlFor="saturation" className="block text-sm font-medium text-gray-700 mb-2">
                      Saturation Level (0.0-2.0)
                    </label>
                    <input
                      id="saturation"
                      type="number"
                      value={batchSettings.saturation}
                      onChange={(e) => updateSetting('saturation', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0.0"
                      max="2.0"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Saturation adjustment for image enhancement</p>
                  </div>
                )}
              </div>

              {/* Image Conversion Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-800">Image Conversion</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image Convert
                    </label>
                    <p className="text-xs text-gray-500">Enable image conversion and processing</p>
                  </div>
                  <Toggle
                    checked={batchSettings.imageConvert}
                    onChange={(checked) => updateSetting('imageConvert', checked)}
                  />
                </div>

                {/* Convert Format - only show when Image Convert is enabled */}
                {showConvertFormat && (
                  <div>
                    <label htmlFor="convert-format" className="block text-sm font-medium text-gray-700 mb-2">
                      Convert Format
                    </label>
                    <select
                      id="convert-format"
                      value={batchSettings.convertToJpg ? 'jpg' : 'png'}
                      onChange={(e) => {
                        const isJpg = e.target.value === 'jpg';
                        updateSetting('convertToJpg', isJpg);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="png">PNG</option>
                      <option value="jpg">JPG</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Convert images to this format</p>
                  </div>
                )}

                {/* Quality Settings - only show when Image Convert is enabled */}
                {showQualitySettings && (
                  <div className="space-y-4">
                    {/* JPG Quality - only show when converting to JPG */}
                    {showJpgQuality && (
                      <div>
                        <label htmlFor="jpg-quality" className="block text-sm font-medium text-gray-700 mb-2">
                          JPG Quality (1-100)
                        </label>
                        <input
                          id="jpg-quality"
                          type="number"
                          value={batchSettings.jpgQuality}
                          onChange={(e) => updateSetting('jpgQuality', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="1"
                          max="100"
                        />
                        <p className="text-xs text-gray-500 mt-1">Quality setting for JPG conversion</p>
                      </div>
                    )}

                    {/* PNG Quality - only show when converting to PNG */}
                    {showPngQuality && (
                      <div>
                        <label htmlFor="png-quality" className="block text-sm font-medium text-gray-700 mb-2">
                          PNG Quality (1-100)
                        </label>
                        <input
                          id="png-quality"
                          type="number"
                          value={batchSettings.pngQuality}
                          onChange={(e) => updateSetting('pngQuality', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="1"
                          max="100"
                        />
                        <p className="text-xs text-gray-500 mt-1">PNG quality setting used by sharp (1=lowest, 100=highest)</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Background Removal Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-800">Background Processing</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Remove Background
                    </label>
                    <p className="text-xs text-gray-500">Remove background using Remove.bg API</p>
                  </div>
                  <Toggle
                    checked={batchSettings.removeBg}
                    onChange={(checked) => updateSetting('removeBg', checked)}
                  />
                </div>

                {/* Remove BG Size - only show when Remove Background is enabled */}
                {batchSettings.removeBg && (
                  <div>
                    <label htmlFor="remove-bg-size" className="block text-sm font-medium text-gray-700 mb-2">
                      Remove BG Size
                    </label>
                    <select
                      id="remove-bg-size"
                      value={batchSettings.removeBgSize}
                      onChange={(e) => updateSetting('removeBgSize', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="auto">Auto</option>
                      <option value="preview">Preview</option>
                      <option value="full">Full</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Size setting for background removal</p>
                  </div>
                )}

                {/* Trim Transparent Background - only show when Remove Background is enabled */}
                {showTrimTransparent && (
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trim Transparent Background
                      </label>
                      <p className="text-xs text-gray-500">Remove transparent areas from images (PNG only)</p>
                    </div>
                    <Toggle
                      checked={batchSettings.trimTransparentBackground}
                      onChange={(checked) => updateSetting('trimTransparentBackground', checked)}
                    />
                  </div>
                )}

                {/* JPG Background Color - only show when Remove.Bg is on, Image Convert is on, and set to JPG */}
                {showJpgBackground && (
                  <div>
                    <label htmlFor="jpg-background" className="block text-sm font-medium text-gray-700 mb-2">
                      JPG Background Color
                    </label>
                    <select
                      id="jpg-background"
                      value={batchSettings.jpgBackground}
                      onChange={(e) => updateSetting('jpgBackground', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="#FFFFFF">White</option>
                      <option value="#000000">Black</option>
                      <option value="#F0F0F0">Light Gray</option>
                      <option value="#808080">Gray</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Background color for JPG images (required when removing background)</p>
                  </div>
                )}
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
