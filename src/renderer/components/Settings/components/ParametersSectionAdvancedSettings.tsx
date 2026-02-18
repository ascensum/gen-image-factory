import React from 'react';
import { ChevronDown } from 'lucide-react';
import { JPG_BACKGROUNDS, REMOVE_BG_SIZES } from '../parametersSectionConstants';
import {
  ParametersSectionToggleSwitch,
} from './ParametersSectionPrimitives';

export interface ParametersSectionAdvancedSettingsProps {
  isExpanded: boolean;
  onToggle: () => void;
  removeBg: boolean;
  imageConvert: boolean;
  convertToJPG: boolean;
  trimTransparentBackground: boolean;
  debugMode: boolean;
  jpgBackground: string;
  removeBgSize: string;
  jpgQuality: number;
  pngQuality: number;
  runQualityCheck: boolean;
  runMetadataGen: boolean;
  isLoading?: boolean;
  onRemoveBgChange?: (enabled: boolean) => void;
  onImageConvertChange?: (enabled: boolean) => void;
  onConvertToJpgChange?: (enabled: boolean) => void;
  onTrimTransparentBackgroundChange?: (enabled: boolean) => void;
  onDebugModeChange?: (enabled: boolean) => void;
  onJpgBackgroundChange?: (background: string) => void;
  onRemoveBgSizeChange?: (size: string) => void;
  onJpgQualityChange?: (quality: number) => void;
  onPngQualityChange?: (quality: number) => void;
  onRunQualityCheckChange?: (enabled: boolean) => void;
  onRunMetadataGenChange?: (enabled: boolean) => void;
}

export const ParametersSectionAdvancedSettings: React.FC<ParametersSectionAdvancedSettingsProps> = ({
  isExpanded,
  onToggle,
  removeBg,
  imageConvert,
  convertToJPG,
  trimTransparentBackground,
  debugMode,
  jpgBackground,
  removeBgSize,
  jpgQuality,
  pngQuality,
  runQualityCheck,
  runMetadataGen,
  isLoading = false,
  onRemoveBgChange,
  onImageConvertChange,
  onConvertToJpgChange,
  onTrimTransparentBackgroundChange,
  onDebugModeChange,
  onJpgBackgroundChange,
  onRemoveBgSizeChange,
  onJpgQualityChange,
  onPngQualityChange,
  onRunQualityCheckChange,
  onRunMetadataGenChange
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-gray-900">Advanced Settings</h3>
      <button
        onClick={onToggle}
        className="flex items-center text-sm text-gray-600 hover:text-gray-800"
      >
        {isExpanded ? 'Hide' : 'Show'} Advanced
        <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
    </div>

    {isExpanded && (
      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">Image Processing</h4>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Remove Background</label>
              <p className="text-xs text-gray-500">Remove background from generated images</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={removeBg}
              onChange={(checked) => onRemoveBgChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle remove background"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Image Conversion</label>
              <p className="text-xs text-gray-500">Apply image enhancement effects</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={imageConvert}
              onChange={(checked) => onImageConvertChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle image conversion"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Convert to JPG</label>
              <p className="text-xs text-gray-500">Convert final images to JPG format</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={convertToJPG}
              onChange={(checked) => onConvertToJpgChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle convert to JPG"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Trim Transparent Background</label>
              <p className="text-xs text-gray-500">Trim excess transparent background</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={trimTransparentBackground}
              onChange={(checked) => onTrimTransparentBackgroundChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle trim transparent background"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Debug Mode</label>
              <p className="text-xs text-gray-500">Enable detailed debug logging</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={debugMode}
              onChange={(checked) => onDebugModeChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle debug mode"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">JPG Background</label>
            <div className="flex space-x-2">
              {JPG_BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  onClick={() => onJpgBackgroundChange?.(bg)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    jpgBackground === bg ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {bg.charAt(0).toUpperCase() + bg.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Remove.bg Size</label>
            <div className="flex space-x-2">
              {REMOVE_BG_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => onRemoveBgSizeChange?.(size)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    removeBgSize === size ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">JPG Quality</label>
              <input
                type="number"
                min={1}
                max={100}
                value={jpgQuality}
                onChange={(e) => onJpgQualityChange?.(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">PNG Quality</label>
              <input
                type="number"
                min={1}
                max={100}
                value={pngQuality}
                onChange={(e) => onPngQualityChange?.(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">AI Features</h4>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Run Quality Check</label>
              <p className="text-xs text-gray-500">Enable AI quality assessment</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={runQualityCheck}
              onChange={(checked) => onRunQualityCheckChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle run quality check"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Run Metadata Generation</label>
              <p className="text-xs text-gray-500">Generate titles and tags automatically</p>
            </div>
            <ParametersSectionToggleSwitch
              checked={runMetadataGen}
              onChange={(checked) => onRunMetadataGenChange?.(checked)}
              disabled={isLoading}
              aria-label="Toggle run metadata generation"
            />
          </div>
        </div>
      </div>
    )}
  </div>
);
