import React from 'react';
import { Cog } from 'lucide-react';
import { Toggle } from '../../Toggle';
import type { SettingsObject } from '../../../../../types/settings';

interface SettingsTabProcessingProps {
  form: SettingsObject;
  setForm: React.Dispatch<React.SetStateAction<SettingsObject>>;
  setHasUnsavedChanges: (v: boolean) => void;
  handleInputChange: (section: string, key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleToggleChange: (section: string, key: string) => (checked: boolean) => void;
}

export function SettingsTabProcessing({
  form,
  setForm,
  setHasUnsavedChanges,
  handleInputChange,
  handleToggleChange,
}: SettingsTabProcessingProps) {
  const showRemoveBgSize = form.processing.removeBg;

  return (
    <div className="space-y-6" data-testid="processing-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Image Processing</h3>
        <Cog className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Remove Background</label>
              <p className="text-xs text-gray-500">Remove background from generated images</p>
            </div>
            <Toggle
              checked={form.processing.removeBg}
              onChange={handleToggleChange('processing', 'removeBg')}
            />
          </div>
          {showRemoveBgSize && (
            <div>
              <label htmlFor="remove-bg-size" className="block text-sm font-medium text-gray-700 mb-2">
                Remove.bg Size
              </label>
              <select
                id="remove-bg-size"
                value={form.processing.removeBgSize}
                onChange={handleInputChange('processing', 'removeBgSize')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="auto">Auto</option>
                <option value="preview">Preview</option>
                <option value="full">Full</option>
                <option value="50MP">50MP</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Size setting for Remove.bg API</p>
            </div>
          )}
          {showRemoveBgSize && (
            <div>
              <label htmlFor="remove-bg-failure-mode" className="block text-sm font-medium text-gray-700 mb-2">
                On remove.bg failure
              </label>
              <select
                id="remove-bg-failure-mode"
                value={(form.processing as any).removeBgFailureMode || 'soft'}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    processing: {
                      ...prev.processing,
                      removeBgFailureMode: e.target.value as 'soft' | 'fail',
                    },
                  }));
                  setHasUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="fail">Mark Failed (technical fail)</option>
                <option value="soft">Approve (soft fail)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Choose whether images should be auto-approved or marked failed if remove.bg fails.</p>
            </div>
          )}
          {showRemoveBgSize && (
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trim Transparent Background</label>
                <p className="text-xs text-gray-500">Trim transparent edges after background removal</p>
              </div>
              <Toggle
                checked={form.processing.trimTransparentBackground}
                onChange={handleToggleChange('processing', 'trimTransparentBackground')}
              />
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image Convert</label>
              <p className="text-xs text-gray-500">Enable image conversion and processing</p>
            </div>
            <Toggle
              checked={form.processing.imageConvert}
              onChange={handleToggleChange('processing', 'imageConvert')}
            />
          </div>
          {form.processing.imageConvert && (
            <>
              <div>
                <label htmlFor="convert-format" className="block text-sm font-medium text-gray-700 mb-2">
                  Convert format
                </label>
                <select
                  id="convert-format"
                  value={form.processing.convertToWebp ? 'webp' : form.processing.convertToJpg ? 'jpg' : 'png'}
                  onChange={(e) => {
                    const val = e.target.value as 'png' | 'jpg' | 'webp';
                    setForm((prev) => ({
                      ...prev,
                      processing: {
                        ...prev.processing,
                        convertToJpg: val === 'jpg',
                        convertToWebp: val === 'webp',
                      },
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Output format when conversion is enabled</p>
              </div>
              {form.processing.convertToJpg && (
                <>
                  <div>
                    <label htmlFor="jpg-quality" className="block text-sm font-medium text-gray-700 mb-2">
                      JPG quality (1–100)
                    </label>
                    <input
                      id="jpg-quality"
                      type="number"
                      min={1}
                      max={100}
                      value={form.processing.jpgQuality}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) {
                          setForm((prev) => ({
                            ...prev,
                            processing: { ...prev.processing, jpgQuality: Math.max(1, Math.min(100, v)) },
                          }));
                          setHasUnsavedChanges(true);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="jpg-background" className="block text-sm font-medium text-gray-700 mb-2">
                      JPG background
                    </label>
                    <select
                      id="jpg-background"
                      value={form.processing.jpgBackground}
                      onChange={handleInputChange('processing', 'jpgBackground')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="white">White</option>
                      <option value="black">Black</option>
                      <option value="transparent">Transparent</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Background for transparent areas when saving as JPG</p>
                  </div>
                </>
              )}
              {form.processing.convertToWebp && (
                <div>
                  <label htmlFor="webp-quality" className="block text-sm font-medium text-gray-700 mb-2">
                    WebP quality (1–100)
                  </label>
                  <input
                    id="webp-quality"
                    type="number"
                    min={1}
                    max={100}
                    value={form.processing.webpQuality ?? 85}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) {
                        setForm((prev) => ({
                          ...prev,
                          processing: { ...prev.processing, webpQuality: Math.max(1, Math.min(100, v)) },
                        }));
                        setHasUnsavedChanges(true);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Enhancement</label>
                  <p className="text-xs text-gray-500">Apply sharpening and saturation effects</p>
                </div>
                <Toggle
                  checked={form.processing.imageEnhancement}
                  onChange={handleToggleChange('processing', 'imageEnhancement')}
                />
              </div>
              {form.processing.imageEnhancement && (
                <>
                  <div>
                    <label htmlFor="sharpening" className="block text-sm font-medium text-gray-700 mb-2">
                      Sharpening (0–10)
                    </label>
                    <input
                      id="sharpening"
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={form.processing.sharpening}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) {
                          setForm((prev) => ({
                            ...prev,
                            processing: { ...prev.processing, sharpening: v },
                          }));
                          setHasUnsavedChanges(true);
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{form.processing.sharpening}</span>
                  </div>
                  <div>
                    <label htmlFor="saturation" className="block text-sm font-medium text-gray-700 mb-2">
                      Saturation (0–2)
                    </label>
                    <input
                      id="saturation"
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={form.processing.saturation}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) {
                          setForm((prev) => ({
                            ...prev,
                            processing: { ...prev.processing, saturation: v },
                          }));
                          setHasUnsavedChanges(true);
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{form.processing.saturation}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
