/**
 * Story 3.4 Phase 5c.5: Scrollable content (batch info, method, metadata, config) for ProcessingSettingsModal.
 */
import React from 'react';
import { Toggle } from '../../Settings/Toggle';
import type { ProcessingSettings } from '../../../../types/processing';

interface ProcessingSettingsModalContentProps {
  selectedCount: number;
  useOriginalSettings: boolean;
  setUseOriginalSettings: (v: boolean) => void;
  includeMetadata: boolean;
  setIncludeMetadata: (v: boolean) => void;
  failRetryEnabled: boolean;
  setFailRetryEnabled: (v: boolean) => void;
  failOnSteps: string[];
  setFailOnSteps: (v: string[]) => void;
  batchSettings: ProcessingSettings;
  updateSetting: (key: keyof ProcessingSettings, value: unknown) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  configSectionRef: React.RefObject<HTMLDivElement | null>;
  sharpeningRef: React.RefObject<HTMLDivElement | null>;
  convertFormatRef: React.RefObject<HTMLDivElement | null>;
  removeBgSizeRef: React.RefObject<HTMLDivElement | null>;
}

const ProcessingSettingsModalContent: React.FC<ProcessingSettingsModalContentProps> = ({
  selectedCount,
  useOriginalSettings,
  setUseOriginalSettings,
  includeMetadata,
  setIncludeMetadata,
  failRetryEnabled,
  setFailRetryEnabled,
  failOnSteps,
  setFailOnSteps,
  batchSettings,
  updateSetting,
  contentRef,
  configSectionRef,
  sharpeningRef,
  convertFormatRef,
  removeBgSizeRef,
}) => {
  const showSharpening = batchSettings.imageEnhancement;
  const showSaturation = batchSettings.imageEnhancement;
  const showConvertFormat = batchSettings.imageConvert;
  const showQualitySettings = batchSettings.imageConvert;
  const showJpgQuality = batchSettings.imageConvert && batchSettings.convertToJpg;
  const showWebpQuality = batchSettings.imageConvert && (batchSettings as { convertToWebp?: boolean }).convertToWebp === true;
  const showTrimTransparent = batchSettings.removeBg;
  const showJpgBackground = batchSettings.removeBg && batchSettings.imageConvert && batchSettings.convertToJpg;

  return (
    <div
      data-testid="modal-content"
      ref={contentRef}
      className="p-6 overflow-y-auto flex-1 min-h-0 retry-modal-scroll"
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
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

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Processing Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <input
              type="radio"
              name="processingMethod"
              value="original"
              aria-label="Retry with Original Settings"
              checked={useOriginalSettings}
              onChange={() => setUseOriginalSettings(true)}
              className="text-blue-600 focus:ring-0 focus:outline-none focus-visible:outline-none mt-1.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Retry with Original Settings</div>
              <div className="text-xs text-gray-500 mt-1">
                Process all images with their original job settings (Metadata, processing)
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <input
              type="radio"
              name="processingMethod"
              value="modified"
              aria-label="Retry with Modified Settings"
              checked={!useOriginalSettings}
              onChange={() => setUseOriginalSettings(false)}
              className="text-blue-600 focus:ring-0 focus:outline-none focus-visible:outline-none mt-1.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Retry with Modified Settings</div>
              <div className="text-xs text-gray-500 mt-1">
                Process all images with new settings (Metadata, processing) — no image regeneration
              </div>
            </div>
          </label>
        </div>
      </div>

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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800 font-medium">
                    Also regenerate metadata (titles, descriptions, tags)
                  </span>
                  <Toggle checked={includeMetadata} onChange={setIncludeMetadata} />
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  This will regenerate AI-generated metadata for all selected images using the current AI model settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!useOriginalSettings && (
        <div ref={configSectionRef} className="space-y-8 scroll-mt-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="pr-4">
                <h4 className="text-sm font-medium text-gray-800">Fail Retry</h4>
                <p className="text-xs text-gray-600 mt-1">
                  When ON, selected steps will hard-fail the retry if they error. Unselected steps will soft-fail and continue. If no steps are selected, all steps soft-fail.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  When OFF, defaults apply: Remove.bg soft, Trim hard, Convert/Save hard, Metadata soft, Enhancement soft (hard only if encode/save fails).
                </p>
              </div>
              <Toggle ariaLabel="Enable Fail Retry" checked={failRetryEnabled} onChange={setFailRetryEnabled} />
            </div>
            {failRetryEnabled && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Steps that should hard-fail retry
                </label>
                <select
                  multiple
                  value={failOnSteps}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFailOnSteps(options);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  size={5}
                >
                  <option value="remove_bg">Remove Background</option>
                  <option value="trim">Trim Transparent</option>
                  <option value="enhancement">Enhancement</option>
                  <option value="convert">Convert / Save</option>
                  <option value="metadata">Metadata</option>
                </select>
              </div>
            )}
          </div>
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Important Note</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  These settings will be applied to all {selectedCount} images in the batch.
                  Images will NOT be regenerated and Quality Controlled - only metadata or/and processing will be updated.
                </p>
                <p className="text-sm text-yellow-600 mt-2">
                  <strong>Current defaults:</strong> Image conversion enabled, converting to JPG at 85% quality
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900">Batch Processing Configuration</h3>

          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800">Image Enhancement</h4>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image Enhancement</label>
                <p className="text-xs text-gray-500">Enable image enhancement effects (sharpening, saturation)</p>
              </div>
              <Toggle
                ariaLabel="Enable image enhancement"
                checked={batchSettings.imageEnhancement}
                onChange={(checked) => {
                  updateSetting('imageEnhancement', checked);
                  if (checked) setTimeout(() => sharpeningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                }}
              />
            </div>
            {showSharpening && (
              <div ref={sharpeningRef} className="scroll-mt-4">
                <label htmlFor="sharpening" className="block text-sm font-medium text-gray-700 mb-2">Sharpening Level (0-10)</label>
                <input
                  id="sharpening"
                  type="number"
                  value={batchSettings.sharpening}
                  onChange={(e) => updateSetting('sharpening', parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={0}
                  max={10}
                />
                <p className="text-xs text-gray-500 mt-1">Sharpening intensity for image enhancement</p>
              </div>
            )}
            {showSaturation && (
              <div>
                <label htmlFor="saturation" className="block text-sm font-medium text-gray-700 mb-2">Saturation Level (0.0-2.0)</label>
                <input
                  id="saturation"
                  type="number"
                  value={batchSettings.saturation}
                  onChange={(e) => updateSetting('saturation', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={0}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-gray-500 mt-1">Saturation adjustment for image enhancement</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800">Image Conversion</h4>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image Convert</label>
                <p className="text-xs text-gray-500">Enable image conversion and processing</p>
              </div>
              <Toggle
                ariaLabel="Enable image conversion"
                checked={batchSettings.imageConvert}
                onChange={(checked) => {
                  updateSetting('imageConvert', checked);
                  if (checked) setTimeout(() => convertFormatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                }}
              />
            </div>
            {showConvertFormat && (
              <div ref={convertFormatRef} className="scroll-mt-4">
                <label htmlFor="convert-format" className="block text-sm font-medium text-gray-700 mb-2">Convert Format</label>
                <select
                  id="convert-format"
                  aria-label="Convert Format"
                  value={(batchSettings as { convertToWebp?: boolean }).convertToWebp ? 'webp' : batchSettings.convertToJpg ? 'jpg' : 'png'}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateSetting('convertToWebp' as keyof ProcessingSettings, val === 'webp');
                    updateSetting('convertToJpg', val === 'jpg');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WEBP</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Convert images to this format</p>
              </div>
            )}
            {showQualitySettings && (
              <div className="space-y-4">
                {showJpgQuality && (
                  <div>
                    <label htmlFor="jpg-quality" className="block text-sm font-medium text-gray-700 mb-2">JPG Quality (1-100)</label>
                    <input
                      id="jpg-quality"
                      type="number"
                      value={batchSettings.jpgQuality}
                      onChange={(e) => updateSetting('jpgQuality', parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={1}
                      max={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">Quality setting for JPG conversion</p>
                  </div>
                )}
                {showWebpQuality && (
                  <div>
                    <label htmlFor="webp-quality" className="block text-sm font-medium text-gray-700 mb-2">WebP Quality (1-100)</label>
                    <input
                      id="webp-quality"
                      type="number"
                      value={(batchSettings as { webpQuality?: number }).webpQuality ?? 90}
                      onChange={(e) => updateSetting('webpQuality' as keyof ProcessingSettings, parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={1}
                      max={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">Quality setting for WebP conversion</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800">Background Processing</h4>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remove Background</label>
                <p className="text-xs text-gray-500">Remove background using Remove.bg API</p>
              </div>
              <Toggle
                ariaLabel="Remove background"
                checked={batchSettings.removeBg}
                onChange={(checked) => {
                  updateSetting('removeBg', checked);
                  if (checked) setTimeout(() => removeBgSizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                }}
              />
            </div>
            {batchSettings.removeBg && (
              <div ref={removeBgSizeRef} className="scroll-mt-4">
                <label htmlFor="remove-bg-size" className="block text-sm font-medium text-gray-700 mb-2">Remove BG Size</label>
                <select
                  id="remove-bg-size"
                  value={batchSettings.removeBgSize}
                  onChange={(e) => updateSetting('removeBgSize', e.target.value)}
                  className="ui-select"
                >
                  <option value="auto">Auto</option>
                  <option value="preview">Preview</option>
                  <option value="full">Full</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Size setting for background removal</p>
              </div>
            )}
            {showTrimTransparent && (
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trim Transparent Background</label>
                  <p className="text-xs text-gray-500">Remove transparent areas from images (PNG only)</p>
                </div>
                <Toggle
                  ariaLabel="Trim transparent background"
                  checked={batchSettings.trimTransparentBackground}
                  onChange={(checked) => updateSetting('trimTransparentBackground', checked)}
                />
              </div>
            )}
            {showJpgBackground && (
              <div>
                <label htmlFor="jpg-background" className="block text-sm font-medium text-gray-700 mb-2">JPG Background Color</label>
                <select
                  id="jpg-background"
                  value={batchSettings.jpgBackground}
                  onChange={(e) => updateSetting('jpgBackground', e.target.value)}
                  className="ui-select"
                >
                  <option value="#FFFFFF">White</option>
                  <option value="#000000">Black</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Background color for JPG images (required when removing background)</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingSettingsModalContent;
