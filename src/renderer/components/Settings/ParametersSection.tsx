import React, { useState, useCallback } from 'react';
import { Sliders, AlertCircle } from 'lucide-react';
import type { ParametersSectionProps, ParameterPreset } from './parametersSectionTypes';
import { useParametersSectionCost } from './hooks/useParametersSectionCost';
import { ParametersSectionPresets } from './components/ParametersSectionPresets';
import { ParametersSectionBasicSettings } from './components/ParametersSectionBasicSettings';
import { ParametersSectionAdvancedSettings } from './components/ParametersSectionAdvancedSettings';
import { ParametersSectionCostSummary } from './components/ParametersSectionCostSummary';

export type { ParametersSectionProps } from './parametersSectionTypes';

export const ParametersSection: React.FC<ParametersSectionProps> = ({
  processMode,
  aspectRatios,
  mjVersion,
  openaiModel,
  pollingTimeout,
  pollingInterval: pollingIntervalProp,
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
  onPollingIntervalChange,
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
  const pollingInterval = typeof pollingIntervalProp === 'number' ? pollingIntervalProp : 1;

  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');

  const { costCalculation, getCostLevel } = useParametersSectionCost({
    processMode,
    removeBg,
    runQualityCheck,
    runMetadataGen
  });

  const handleApplyPreset = useCallback(
    (settings: ParameterPreset['settings']) => {
      onProcessModeChange?.(settings.processMode);
      onAspectRatiosChange?.(settings.aspectRatios);
      onMjVersionChange?.(settings.mjVersion);
      onOpenaiModelChange?.(settings.openaiModel);
      onPollingTimeoutChange?.(settings.pollingTimeout);
      onKeywordRandomChange?.(settings.keywordRandom);
      onRemoveBgChange?.(settings.removeBg);
      onImageConvertChange?.(settings.imageConvert);
      onConvertToJpgChange?.(settings.convertToJpg);
      onTrimTransparentBackgroundChange?.(settings.trimTransparentBackground);
      onDebugModeChange?.(settings.debugMode);
      onJpgBackgroundChange?.(settings.jpgBackground);
      onRemoveBgSizeChange?.(settings.removeBgSize);
      onJpgQualityChange?.(settings.jpgQuality);
      onPngQualityChange?.(settings.pngQuality);
      onRunQualityCheckChange?.(settings.runQualityCheck);
      onRunMetadataGenChange?.(settings.runMetadataGen);
    },
    [
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
      onRunMetadataGenChange
    ]
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

      <ParametersSectionPresets
        selectedPreset={selectedPreset}
        onSelectPreset={setSelectedPreset}
        onApplyPreset={handleApplyPreset}
      />
      <ParametersSectionBasicSettings
        processMode={processMode}
        aspectRatios={aspectRatios}
        mjVersion={mjVersion}
        openaiModel={openaiModel}
        pollingTimeout={pollingTimeout}
        pollingInterval={pollingInterval}
        keywordRandom={keywordRandom}
        isLoading={isLoading}
        onProcessModeChange={onProcessModeChange}
        onAspectRatiosChange={onAspectRatiosChange}
        onMjVersionChange={onMjVersionChange}
        onOpenaiModelChange={onOpenaiModelChange}
        onPollingTimeoutChange={onPollingTimeoutChange}
        onPollingIntervalChange={onPollingIntervalChange}
        onKeywordRandomChange={onKeywordRandomChange}
        getCostLevel={getCostLevel}
      />
      <ParametersSectionAdvancedSettings
        isExpanded={isAdvancedExpanded}
        onToggle={() => setIsAdvancedExpanded((v) => !v)}
        removeBg={removeBg}
        imageConvert={imageConvert}
        convertToJPG={convertToJpg}
        trimTransparentBackground={trimTransparentBackground}
        debugMode={debugMode}
        jpgBackground={jpgBackground}
        removeBgSize={removeBgSize}
        jpgQuality={jpgQuality}
        pngQuality={pngQuality}
        runQualityCheck={runQualityCheck}
        runMetadataGen={runMetadataGen}
        isLoading={isLoading}
        onRemoveBgChange={onRemoveBgChange}
        onImageConvertChange={onImageConvertChange}
        onConvertToJpgChange={onConvertToJpgChange}
        onTrimTransparentBackgroundChange={onTrimTransparentBackgroundChange}
        onDebugModeChange={onDebugModeChange}
        onJpgBackgroundChange={onJpgBackgroundChange}
        onRemoveBgSizeChange={onRemoveBgSizeChange}
        onJpgQualityChange={onJpgQualityChange}
        onPngQualityChange={onPngQualityChange}
        onRunQualityCheckChange={onRunQualityCheckChange}
        onRunMetadataGenChange={onRunMetadataGenChange}
      />
      <ParametersSectionCostSummary costCalculation={costCalculation} getCostLevel={getCostLevel} />

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-2 text-gray-600">Processing...</span>
        </div>
      )}
    </div>
  );
};
