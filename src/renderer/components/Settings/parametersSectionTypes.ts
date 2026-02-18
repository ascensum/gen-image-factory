/**
 * Types for ParametersSection (Story 3.4 Phase 5c.8).
 */

export interface ParametersSectionProps {
  processMode: string;
  aspectRatios: string[];
  mjVersion: string;
  openaiModel: string;
  pollingTimeout: number;
  pollingInterval?: number;
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
  onProcessModeChange?: (mode: string) => void;
  onAspectRatiosChange?: (ratios: string[]) => void;
  onMjVersionChange?: (version: string) => void;
  onOpenaiModelChange?: (model: string) => void;
  onPollingTimeoutChange?: (timeout: number) => void;
  onPollingIntervalChange?: (interval: number) => void;
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

export interface ParameterPresetSettings {
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
}

export type CostLevel = 'free' | 'low' | 'medium' | 'high';

export interface ParameterPreset {
  id: string;
  name: string;
  description: string;
  settings: ParameterPresetSettings;
  estimatedCost: string;
  costLevel: CostLevel;
}

export interface CostCalculation {
  totalCost: number;
  breakdown: Array<{
    feature: string;
    cost: number;
    enabled: boolean;
  }>;
}
