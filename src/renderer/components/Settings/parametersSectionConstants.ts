/**
 * Constants for ParametersSection (Story 3.4 Phase 5c.8).
 */
import type { ParameterPreset } from './parametersSectionTypes';

export const PARAMETER_PRESETS: ParameterPreset[] = [
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

export const PROCESS_MODES = ['relax', 'fast', 'turbo'];
export const ASPECT_RATIOS = ['1:1', '16:9', '9:16'];
export const MJ_VERSIONS = ['6.1', '6.0', 'niji'];
export const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
export const JPG_BACKGROUNDS = ['white', 'black'];
export const REMOVE_BG_SIZES = ['auto', 'preview', 'full'];
