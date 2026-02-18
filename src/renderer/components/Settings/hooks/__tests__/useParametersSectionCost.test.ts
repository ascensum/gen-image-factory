/**
 * Story 3.4 Phase 5c.8: Unit tests for useParametersSectionCost hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useParametersSectionCost } from '../useParametersSectionCost';

describe('useParametersSectionCost', () => {
  it('returns base cost only when no extras enabled', () => {
    const { result } = renderHook(() =>
      useParametersSectionCost({
        processMode: 'relax',
        removeBg: false,
        runQualityCheck: false,
        runMetadataGen: false
      })
    );
    expect(result.current.costCalculation.totalCost).toBe(0.05);
    expect(result.current.costCalculation.breakdown).toHaveLength(1);
    // 0.05 is not < 0.05 so getCostLevel returns 'medium'
    expect(result.current.getCostLevel(0.05)).toBe('medium');
    expect(result.current.getCostLevel(0.04)).toBe('low');
  });

  it('includes background removal cost when removeBg is true', () => {
    const { result } = renderHook(() =>
      useParametersSectionCost({
        processMode: 'relax',
        removeBg: true,
        runQualityCheck: false,
        runMetadataGen: false
      })
    );
    expect(result.current.costCalculation.totalCost).toBe(0.07);
    expect(result.current.costCalculation.breakdown.some((b) => b.feature === 'Background Removal')).toBe(true);
  });

  it('uses higher base cost for fast mode', () => {
    const { result } = renderHook(() =>
      useParametersSectionCost({
        processMode: 'fast',
        removeBg: false,
        runQualityCheck: false,
        runMetadataGen: false
      })
    );
    expect(result.current.costCalculation.totalCost).toBe(0.08);
  });

  it('uses highest base cost for turbo mode', () => {
    const { result } = renderHook(() =>
      useParametersSectionCost({
        processMode: 'turbo',
        removeBg: false,
        runQualityCheck: false,
        runMetadataGen: false
      })
    );
    expect(result.current.costCalculation.totalCost).toBe(0.15);
  });

  it('getCostLevel returns free for 0', () => {
    const { result } = renderHook(() =>
      useParametersSectionCost({
        processMode: 'relax',
        removeBg: false,
        runQualityCheck: false,
        runMetadataGen: false
      })
    );
    expect(result.current.getCostLevel(0)).toBe('free');
  });

  it('getCostLevel returns high for >= 0.15', () => {
    const { result } = renderHook(() =>
      useParametersSectionCost({
        processMode: 'turbo',
        removeBg: true,
        runQualityCheck: true,
        runMetadataGen: true
      })
    );
    expect(result.current.costCalculation.totalCost).toBe(0.19);
    expect(result.current.getCostLevel(result.current.costCalculation.totalCost)).toBe('high');
  });
});
