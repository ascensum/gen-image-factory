import React from 'react';
import {
  PROCESS_MODES,
  ASPECT_RATIOS,
  MJ_VERSIONS,
  OPENAI_MODELS
} from '../parametersSectionConstants';
import type { CostLevel } from '../parametersSectionTypes';
import { ParametersSectionCostIndicator, ParametersSectionToggleSwitch } from './ParametersSectionPrimitives';

export interface ParametersSectionBasicSettingsProps {
  processMode: string;
  aspectRatios: string[];
  mjVersion: string;
  openaiModel: string;
  pollingTimeout: number;
  pollingInterval: number;
  keywordRandom: boolean;
  isLoading?: boolean;
  onProcessModeChange?: (mode: string) => void;
  onAspectRatiosChange?: (ratios: string[]) => void;
  onMjVersionChange?: (version: string) => void;
  onOpenaiModelChange?: (model: string) => void;
  onPollingTimeoutChange?: (timeout: number) => void;
  onPollingIntervalChange?: (interval: number) => void;
  onKeywordRandomChange?: (random: boolean) => void;
  getCostLevel: (cost: number) => CostLevel;
}

export const ParametersSectionBasicSettings: React.FC<ParametersSectionBasicSettingsProps> = ({
  processMode,
  aspectRatios,
  mjVersion,
  openaiModel,
  pollingTimeout,
  pollingInterval,
  keywordRandom,
  isLoading = false,
  onProcessModeChange,
  onAspectRatiosChange,
  onMjVersionChange,
  onOpenaiModelChange,
  onPollingTimeoutChange,
  onPollingIntervalChange,
  onKeywordRandomChange,
  getCostLevel
}) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-gray-900">Basic Settings</h3>

    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Process Mode
        <ParametersSectionCostIndicator costLevel={getCostLevel(0.05)} feature="Relax" />
      </label>
      <div className="flex space-x-2">
        {PROCESS_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => onProcessModeChange?.(mode)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              processMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">Process mode affects generation speed and cost</p>
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Aspect Ratios</label>
      <div className="flex flex-wrap gap-2">
        {ASPECT_RATIOS.map((ratio) => (
          <button
            key={ratio}
            onClick={() => onAspectRatiosChange?.([ratio])}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              aspectRatios.includes(ratio) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {ratio}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">Aspect ratios determine image dimensions</p>
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">MJ Version</label>
      <div className="flex space-x-2">
        {MJ_VERSIONS.map((version) => (
          <button
            key={version}
            onClick={() => onMjVersionChange?.(version)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              mjVersion === version ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {version}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">OpenAI Model</label>
      <div className="flex space-x-2">
        {OPENAI_MODELS.map((model) => (
          <button
            key={model}
            onClick={() => onOpenaiModelChange?.(model)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              openaiModel === model ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {model}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Generation Timeout (minutes)</label>
      <input
        type="number"
        min={1}
        max={60}
        value={pollingTimeout}
        onChange={(e) => onPollingTimeoutChange?.(Number(e.target.value))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-xs text-gray-500">Used as HTTP timeout for Runware (minutes)</p>
    </div>

    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Polling Interval (minutes)</label>
      <input
        type="number"
        min={0.5}
        max={10}
        step={0.5}
        value={pollingInterval}
        onChange={(e) => onPollingIntervalChange?.(Number(e.target.value))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-xs text-gray-500">How often to check API status (0.5 = 30 seconds)</p>
    </div>

    <div className="flex items-center justify-between">
      <div>
        <label className="block text-sm font-medium text-gray-700">Keyword Random</label>
        <p className="text-xs text-gray-500">Pick keywords randomly if enabled</p>
      </div>
      <ParametersSectionToggleSwitch
        checked={keywordRandom}
        onChange={(checked) => onKeywordRandomChange?.(checked)}
        disabled={isLoading}
        aria-label="Toggle keyword random"
      />
    </div>
  </div>
);
