import { useCallback } from 'react';
import type { CostCalculation, CostLevel } from '../parametersSectionTypes';

export interface UseParametersSectionCostInput {
  processMode: string;
  removeBg: boolean;
  runQualityCheck: boolean;
  runMetadataGen: boolean;
}

export function useParametersSectionCost(input: UseParametersSectionCostInput) {
  const { processMode, removeBg, runQualityCheck, runMetadataGen } = input;

  const calculateCost = useCallback((): CostCalculation => {
    let totalCost = 0;
    const breakdown: CostCalculation['breakdown'] = [];
    const baseCost = processMode === 'turbo' ? 0.15 : processMode === 'fast' ? 0.08 : 0.05;
    breakdown.push({ feature: 'Base Generation', cost: baseCost, enabled: true });
    totalCost += baseCost;
    if (removeBg) {
      breakdown.push({ feature: 'Background Removal', cost: 0.02, enabled: true });
      totalCost += 0.02;
    }
    if (runQualityCheck) {
      breakdown.push({ feature: 'Quality Check', cost: 0.01, enabled: true });
      totalCost += 0.01;
    }
    if (runMetadataGen) {
      breakdown.push({ feature: 'Metadata Generation', cost: 0.01, enabled: true });
      totalCost += 0.01;
    }
    return { totalCost, breakdown };
  }, [processMode, removeBg, runQualityCheck, runMetadataGen]);

  const costCalculation = calculateCost();

  const getCostLevel = useCallback((cost: number): CostLevel => {
    if (cost === 0) return 'free';
    if (cost < 0.05) return 'low';
    if (cost < 0.15) return 'medium';
    return 'high';
  }, []);

  return { costCalculation, getCostLevel };
}
