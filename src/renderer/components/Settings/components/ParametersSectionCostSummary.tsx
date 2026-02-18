import React from 'react';
import type { CostCalculation, CostLevel } from '../parametersSectionTypes';
import { ParametersSectionCostIndicator } from './ParametersSectionPrimitives';

export interface ParametersSectionCostSummaryProps {
  costCalculation: CostCalculation;
  getCostLevel: (cost: number) => CostLevel;
}

export const ParametersSectionCostSummary: React.FC<ParametersSectionCostSummaryProps> = ({
  costCalculation,
  getCostLevel
}) => (
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
    <ParametersSectionCostIndicator
      costLevel={getCostLevel(costCalculation.totalCost)}
      estimatedCost={`$${costCalculation.totalCost.toFixed(2)}`}
    />
  </div>
);
