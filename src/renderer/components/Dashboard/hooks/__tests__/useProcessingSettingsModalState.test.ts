/**
 * Story 3.4 Phase 5c.5: Unit tests for useProcessingSettingsModalState hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useProcessingSettingsModalState } from '../useProcessingSettingsModalState';

describe('useProcessingSettingsModalState', () => {
  it('returns initial useOriginalSettings true and includeMetadata false', () => {
    const { result } = renderHook(() => useProcessingSettingsModalState());
    expect(result.current.useOriginalSettings).toBe(true);
    expect(result.current.includeMetadata).toBe(false);
    expect(result.current.failRetryEnabled).toBe(false);
    expect(result.current.failOnSteps).toEqual([]);
  });

  it('returns default batch settings', () => {
    const { result } = renderHook(() => useProcessingSettingsModalState());
    expect(result.current.batchSettings.imageEnhancement).toBe(false);
    expect(result.current.batchSettings.sharpening).toBe(5);
    expect(result.current.batchSettings.convertToJpg).toBe(true);
    expect(result.current.batchSettings.jpgQuality).toBe(85);
  });

  it('updateSetting updates batch settings', () => {
    const { result } = renderHook(() => useProcessingSettingsModalState());
    act(() => {
      result.current.updateSetting('sharpening', 8);
    });
    expect(result.current.batchSettings.sharpening).toBe(8);
    act(() => {
      result.current.updateSetting('imageEnhancement', true);
    });
    expect(result.current.batchSettings.imageEnhancement).toBe(true);
  });

  it('exposes refs', () => {
    const { result } = renderHook(() => useProcessingSettingsModalState());
    expect(result.current.contentRef).toBeDefined();
    expect(result.current.contentRef.current).toBeNull();
    expect(result.current.configSectionRef).toBeDefined();
    expect(result.current.sharpeningRef).toBeDefined();
    expect(result.current.convertFormatRef).toBeDefined();
    expect(result.current.removeBgSizeRef).toBeDefined();
  });

  it('setUseOriginalSettings and setFailOnSteps update state', () => {
    const { result } = renderHook(() => useProcessingSettingsModalState());
    act(() => result.current.setUseOriginalSettings(false));
    expect(result.current.useOriginalSettings).toBe(false);
    act(() => result.current.setFailOnSteps(['remove_bg', 'trim']));
    expect(result.current.failOnSteps).toEqual(['remove_bg', 'trim']);
  });
});
