import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Sliders, Zap, Image, CheckCircle, AlertCircle, ChevronDown, RotateCcw, Save } from 'lucide-react';

// Types and Interfaces
interface ParametersSectionProps {
  // Backend parameters from index.js command line options
  processMode: string;
  aspectRatios: string[];
  mjVersion: string;
  openaiModel: string;
  pollingTimeout: number;
  keywordRandom: boolean;
  removeBg: boolean;
  imageConvert: boolean;
  convertToJpg: boolean;
  trimTransparentBackground: boolean;
  debugMode: boolean;
  jpgBackground: string;
  removeBgSize: string;
  jpgQuality: number;
  pngQuality: number;
  runQualityCheck: boolean;
  runMetadataGen: boolean;
  
  // Callback functions
  onProcessModeChange?: (mode: string) => void;
  onAspectRatiosChange?: (ratios: string[]) => void;
  onMjVersionChange?: (version: string) => void;
  onOpenaiModelChange?: (model: string) => void;
  onPollingTimeoutChange?: (timeout: number) => void;
  onKeywordRandomChange?: (random: boolean) => void;
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
  isLoading?: boolean;
  error?: string | null;
}

interface ParameterPreset {
  id: string;
  name: string;
  description: string;
  settings: {
    processMode: string;
    aspectRatios: string[];
    mjVersion: string;
    openaiModel: string;
    pollingTimeout: number;
    keywordRandom: boolean;
    removeBg: boolean;
    imageConvert: boolean;
    convertToJpg: boolean;
    trimTransparentBackground: boolean;
    debugMode: boolean;
    jpgBackground: string;
    removeBgSize: string;
    jpgQuality: number;
    pngQuality: number;
    runQualityCheck: boolean;
    runMetadataGen: boolean;
  };
  estimatedCost: string;
  costLevel: 'free' | 'low' | 'medium' | 'high';
}

interface CostCalculation {
  totalCost: number;
  breakdown: Array<{
    feature: string;
    cost: number;
    enabled: boolean;
  }>;
}

// Parameter presets based on backend parameters
const PARAMETER_PRESETS: ParameterPreset[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Minimal features for quick generation',
    settings: {
      processMode: 'relax',
      aspectRatios: ['1:1'],
      mjVersion: '6.1',
      openaiModel: 'gpt-4o-mini',
      pollingTimeout: 10,
      keywordRandom: false,
      removeBg: false,
      imageConvert: false,
      convertToJpg: true,
      trimTransparentBackground: false,
      debugMode: false,
      jpgBackground: 'white',
      removeBgSize: 'auto',
      jpgQuality: 100,
      pngQuality: 100,
      runQualityCheck: false,
      runMetadataGen: false,
    },
    estimatedCost: '$0.02',
    costLevel: 'low'
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Balanced features and quality',
    settings: {
      processMode: 'fast',
      aspectRatios: ['1:1', '16:9'],
      mjVersion: '6.1',
      openaiModel: 'gpt-4o',
      pollingTimeout: 15,
      keywordRandom: true,
      removeBg: true,
      imageConvert: true,
      convertToJpg: true,
      trimTransparentBackground: false,
      debugMode: false,
      jpgBackground: 'white',
      removeBgSize: 'auto',
      jpgQuality: 100,
      pngQuality: 100,
      runQualityCheck: true,
      runMetadataGen: true,
    },
    estimatedCost: '$0.08',
    costLevel: 'medium'
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'All features enabled for best results',
    settings: {
      processMode: 'turbo',
      aspectRatios: ['1:1', '16:9', '9:16'],
      mjVersion: '6.1',
      openaiModel: 'gpt-4o',
      pollingTimeout: 20,
      keywordRandom: true,
      removeBg: true,
      imageConvert: true,
      convertToJpg: true,
      trimTransparentBackground: true,
      debugMode: true,
      jpgBackground: 'white',
      removeBgSize: 'full',
      jpgQuality: 100,
      pngQuality: 100,
      runQualityCheck: true,
      runMetadataGen: true,
    },
    estimatedCost: '$0.25',
    costLevel: 'high'
  }
];

// Available options
const PROCESS_MODES = ['relax', 'fast', 'turbo'];
const ASPECT_RATIOS = ['1:1', '16:9', '9:16'];
const MJ_VERSIONS = ['6.1', '6.0', 'niji'];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
const JPG_BACKGROUNDS = ['white', 'black'];
const REMOVE_BG_SIZES = ['auto', 'preview', 'full'];

export const ParametersSection: React.FC<ParametersSectionProps> = ({
  processMode,
  aspectRatios,
  mjVersion,
  openaiModel,
  pollingTimeout,
  keywordRandom,
  removeBg,
  imageConvert,
  convertToJpg,
  trimTransparentBackground,
  debugMode,
  jpgBackground,
  removeBgSize,
  jpgQuality,
  pngQuality,
  runQualityCheck,
  runMetadataGen,
  onProcessModeChange,
  onAspectRatiosChange,
  onMjVersionChange,
  onOpenaiModelChange,
  onPollingTimeoutChange,
  onKeywordRandomChange,
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
  onRunMetadataGenChange,
  isLoading = false,
  error = null
}) => {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');

  // Calculate cost based on current settings
  const calculateCost = useCallback((): CostCalculation => {
    let totalCost = 0;
    const breakdown = [];

    // Base generation cost
    const baseCost = processMode === 'turbo' ? 0.15 : processMode === 'fast' ? 0.08 : 0.05;
    breakdown.push({ feature: 'Base Generation', cost: baseCost, enabled: true });
    totalCost += baseCost;

    // Background removal cost
    if (removeBg) {
      breakdown.push({ feature: 'Background Removal', cost: 0.02, enabled: true });
      totalCost += 0.02;
    }

    // Quality check cost
    if (runQualityCheck) {
      breakdown.push({ feature: 'Quality Check', cost: 0.01, enabled: true });
      totalCost += 0.01;
    }

    // Metadata generation cost
    if (runMetadataGen) {
      breakdown.push({ feature: 'Metadata Generation', cost: 0.01, enabled: true });
      totalCost += 0.01;
    }

    return { totalCost, breakdown };
  }, [processMode, removeBg, runQualityCheck, runMetadataGen]);

  const costCalculation = calculateCost();

  const getCostLevel = (cost: number): 'free' | 'low' | 'medium' | 'high' => {
    if (cost === 0) return 'free';
    if (cost < 0.05) return 'low';
    if (cost < 0.15) return 'medium';
    return 'high';
  };

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    'aria-label'?: string;
  }> = ({ checked, onChange, disabled = false, 'aria-label': ariaLabel }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const RangeSlider: React.FC<{
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    marks: string[];
    disabled?: boolean;
  }> = ({ value, onChange, min, max, step, marks, disabled = false }) => (
    <div className="space-y-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
      />
      <div className="flex justify-between text-xs text-gray-500">
        {marks.map((mark, index) => (
          <span key={index}>{mark}</span>
        ))}
      </div>
    </div>
  );

  const CostIndicator: React.FC<{
    costLevel: 'free' | 'low' | 'medium' | 'high';
    estimatedCost?: string;
    feature?: string;
  }> = ({ costLevel, estimatedCost, feature }) => {
    const getColor = () => {
      switch (costLevel) {
        case 'free': return 'text-green-600 bg-green-100';
        case 'low': return 'text-blue-600 bg-blue-100';
        case 'medium': return 'text-yellow-600 bg-yellow-100';
        case 'high': return 'text-red-600 bg-red-100';
        default: return 'text-gray-600 bg-gray-100';
      }
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColor()}`}>
        {feature && <span className="mr-1">{feature}:</span>}
        {estimatedCost || costLevel} cost
      </span>
    );
  };

  const ParameterPresets = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Parameter Presets</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PARAMETER_PRESETS.map((preset) => (
          <div
            key={preset.id}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedPreset === preset.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => {
              setSelectedPreset(preset.id);
              // Apply preset settings
              onProcessModeChange?.(preset.settings.processMode);
              onAspectRatiosChange?.(preset.settings.aspectRatios);
              onMjVersionChange?.(preset.settings.mjVersion);
              onOpenaiModelChange?.(preset.settings.openaiModel);
              onPollingTimeoutChange?.(preset.settings.pollingTimeout);
              onKeywordRandomChange?.(preset.settings.keywordRandom);
              onRemoveBgChange?.(preset.settings.removeBg);
              onImageConvertChange?.(preset.settings.imageConvert);
              onConvertToJpgChange?.(preset.settings.convertToJpg);
              onTrimTransparentBackgroundChange?.(preset.settings.trimTransparentBackground);
              onDebugModeChange?.(preset.settings.debugMode);
              onJpgBackgroundChange?.(preset.settings.jpgBackground);
              onRemoveBgSizeChange?.(preset.settings.removeBgSize);
              onJpgQualityChange?.(preset.settings.jpgQuality);
              onPngQualityChange?.(preset.settings.pngQuality);
              onRunQualityCheckChange?.(preset.settings.runQualityCheck);
              onRunMetadataGenChange?.(preset.settings.runMetadataGen);
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">{preset.name}</h4>
              <CostIndicator costLevel={preset.costLevel} estimatedCost={preset.estimatedCost} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{preset.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const BasicSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Basic Settings</h3>
      
      {/* Process Mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Process Mode
          <CostIndicator costLevel={getCostLevel(0.05)} feature="Relax" />
        </label>
        <div className="flex space-x-2">
          {PROCESS_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => onProcessModeChange?.(mode)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                processMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">Process mode affects generation speed and cost</p>
      </div>

      {/* Aspect Ratios */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Aspect Ratios
        </label>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              onClick={() => onAspectRatiosChange?.([ratio])}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                aspectRatios.includes(ratio)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">Aspect ratios determine image dimensions</p>
      </div>

      {/* MJ Version */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          MJ Version
        </label>
        <div className="flex space-x-2">
          {MJ_VERSIONS.map((version) => (
            <button
              key={version}
              onClick={() => onMjVersionChange?.(version)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mjVersion === version
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {version}
            </button>
          ))}
        </div>
      </div>

      {/* OpenAI Model */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          OpenAI Model
        </label>
        <div className="flex space-x-2">
          {OPENAI_MODELS.map((model) => (
            <button
              key={model}
              onClick={() => onOpenaiModelChange?.(model)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                openaiModel === model
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {model}
            </button>
          ))}
        </div>
      </div>

      {/* Polling Timeout */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Polling Timeout (minutes)
        </label>
        <input
          type="number"
          min="1"
          max="60"
          value={pollingTimeout}
          onChange={(e) => onPollingTimeoutChange?.(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500">Polling timeout in minutes</p>
      </div>

      {/* Keyword Random */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700">Keyword Random</label>
          <p className="text-xs text-gray-500">Pick keywords randomly if enabled</p>
        </div>
                 <ToggleSwitch
           checked={keywordRandom}
           onChange={(checked) => onKeywordRandomChange?.(checked)}
           disabled={isLoading}
           aria-label="Toggle keyword random"
         />
      </div>
    </div>
  );

  const AdvancedSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Advanced Settings</h3>
        <button
          onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-800"
        >
          {isAdvancedExpanded ? 'Hide' : 'Show'} Advanced
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isAdvancedExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isAdvancedExpanded && (
        <div className="space-y-6">
          {/* Image Processing Options */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800">Image Processing</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">Remove Background</label>
                <p className="text-xs text-gray-500">Remove background from generated images</p>
              </div>
                             <ToggleSwitch
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
              <ToggleSwitch
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
              <ToggleSwitch
                checked={convertToJpg}
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
              <ToggleSwitch
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
              <ToggleSwitch
                checked={debugMode}
                onChange={(checked) => onDebugModeChange?.(checked)}
                disabled={isLoading}
                aria-label="Toggle debug mode"
              />
            </div>

            {/* JPG Background */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">JPG Background</label>
              <div className="flex space-x-2">
                {JPG_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => onJpgBackgroundChange?.(bg)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      jpgBackground === bg
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {bg.charAt(0).toUpperCase() + bg.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Remove.bg Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Remove.bg Size</label>
              <div className="flex space-x-2">
                {REMOVE_BG_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => onRemoveBgSizeChange?.(size)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      removeBgSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">JPG Quality</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={jpgQuality}
                  onChange={(e) => onJpgQualityChange?.(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">PNG Quality</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={pngQuality}
                  onChange={(e) => onPngQualityChange?.(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* AI Features */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800">AI Features</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">Run Quality Check</label>
                <p className="text-xs text-gray-500">Enable AI quality assessment</p>
              </div>
              <ToggleSwitch
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
              <ToggleSwitch
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

  const CostSummary = () => (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Cost Estimate</h3>
      <div className="space-y-2">
        {costCalculation.breakdown.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-gray-600">{item.feature}</span>
            <span className="font-medium">${item.cost.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t pt-2 flex justify-between font-semibold">
          <span>Total Estimated Cost</span>
          <span>${costCalculation.totalCost.toFixed(2)}</span>
        </div>
      </div>
      <CostIndicator costLevel={getCostLevel(costCalculation.totalCost)} estimatedCost={`$${costCalculation.totalCost.toFixed(2)}`} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Sliders className="h-5 w-5 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900">Generation Parameters</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      <ParameterPresets />
      <BasicSettings />
      <AdvancedSettings />
      <CostSummary />

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Processing...</span>
        </div>
      )}
    </div>
  );
};