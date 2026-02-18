import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDashboardProgress } from '../hooks/useDashboardProgress';

describe('useDashboardProgress', () => {
  it('returns empty progressSteps when config is null', () => {
    const { result } = renderHook(() =>
      useDashboardProgress(null, { state: 'idle', progress: 0, currentStep: 1, totalSteps: 2 } as any, [])
    );
    expect(result.current.progressSteps).toEqual([]);
  });

  it('returns Initialization and Image Generation steps when config has processing', () => {
    const config = {
      ai: { runMetadataGen: false, runQualityCheck: false },
      processing: { removeBg: false, imageEnhancement: true },
    };
    const { result } = renderHook(() =>
      useDashboardProgress(config, { state: 'idle', progress: 0, currentStep: 1, totalSteps: 2 } as any, [])
    );

    expect(result.current.progressSteps).toHaveLength(2);
    expect(result.current.progressSteps[0].name).toBe('Initialization');
    expect(result.current.progressSteps[1].name).toBe('Image Generation');
    expect(result.current.progressSteps[1].description).toContain('Processing');
  });

  it('includes Metadata and QC in Image Generation description when config enables them', () => {
    const config = {
      ai: { runMetadataGen: true, runQualityCheck: true },
      processing: {},
    };
    const { result } = renderHook(() =>
      useDashboardProgress(config, { state: 'idle', progress: 0, currentStep: 1, totalSteps: 2 } as any, [])
    );

    const imgStep = result.current.progressSteps.find((s: any) => s.name === 'Image Generation');
    expect(imgStep).toBeDefined();
    expect(imgStep.description).toContain('Metadata');
    expect(imgStep.description).toContain('QC');
  });

  it('smartProgress returns totalGenerations and gensDone from config and jobStatus', () => {
    const config = { parameters: { count: 2, variations: 1 } };
    const jobStatus = {
      state: 'running',
      progress: 50,
      currentStep: 2,
      totalSteps: 2,
      currentJob: { totalGenerations: 2, variations: 1, gensDone: 1, executionId: 'e1' },
    } as any;
    const { result } = renderHook(() =>
      useDashboardProgress(config, jobStatus, [])
    );

    expect(result.current.smartProgress.totalGenerations).toBe(2);
    expect(result.current.smartProgress.gensDone).toBe(1);
    expect(result.current.smartProgress.overallGenerationProgress).toBe(50);
  });

  it('smartProgress uses 100% current when job state is completed', () => {
    const config = { parameters: { count: 1 } };
    const jobStatus = { state: 'completed', progress: 100 } as any;
    const { result } = renderHook(() =>
      useDashboardProgress(config, jobStatus, [])
    );

    expect(result.current.smartProgress.current).toBe(100);
    expect(result.current.smartProgress.overallGenerationProgress).toBe(100);
  });

  it('smartProgress uses currentJob.gensDone when currentJob is present', () => {
    const config = { parameters: { count: 2, variations: 2 } };
    const jobStatus = {
      state: 'running',
      currentJob: { executionId: 'e1', gensDone: 1, totalGenerations: 2, variations: 2 },
    } as any;
    const { result } = renderHook(() =>
      useDashboardProgress(config, jobStatus, [])
    );

    expect(result.current.smartProgress.gensDone).toBe(1);
    expect(result.current.smartProgress.overallGenerationProgress).toBe(50);
  });
});
