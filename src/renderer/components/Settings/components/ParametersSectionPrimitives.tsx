import React from 'react';
import type { CostLevel } from '../parametersSectionTypes';

export const ParametersSectionToggleSwitch: React.FC<{
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

export const ParametersSectionRangeSlider: React.FC<{
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

export const ParametersSectionCostIndicator: React.FC<{
  costLevel: CostLevel;
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
