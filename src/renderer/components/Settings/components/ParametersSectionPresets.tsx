import React from 'react';
import { PARAMETER_PRESETS } from '../parametersSectionConstants';
import type { ParameterPreset } from '../parametersSectionTypes';
import { ParametersSectionCostIndicator } from './ParametersSectionPrimitives';

export interface ParametersSectionPresetsProps {
  selectedPreset: string;
  onSelectPreset: (id: string) => void;
  onApplyPreset: (settings: ParameterPreset['settings']) => void;
}

export const ParametersSectionPresets: React.FC<ParametersSectionPresetsProps> = ({
  selectedPreset,
  onSelectPreset,
  onApplyPreset
}) => (
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
            onSelectPreset(preset.id);
            onApplyPreset(preset.settings);
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{preset.name}</h4>
            <ParametersSectionCostIndicator costLevel={preset.costLevel} estimatedCost={preset.estimatedCost} />
          </div>
          <p className="text-sm text-gray-600 mb-3">{preset.description}</p>
        </div>
      ))}
    </div>
  </div>
);
