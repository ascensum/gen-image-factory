/**
 * Story 3.4 Phase 5c.2: Unit tests for useImageModalProcessing hook.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useImageModalProcessing } from '../useImageModalProcessing';

describe('useImageModalProcessing', () => {
  const mockGetJobExecutionByImageId = vi.fn();

  beforeEach(() => {
    (window as unknown as { electronAPI?: { getJobExecutionByImageId: typeof mockGetJobExecutionByImageId } }).electronAPI = {
      getJobExecutionByImageId: mockGetJobExecutionByImageId,
    };
  });

  afterEach(() => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
    mockGetJobExecutionByImageId.mockReset();
  });

  it('returns per-image processing when modal closed and image has settings', () => {
    const { result } = renderHook(() =>
      useImageModalProcessing({
        imageId: 'img-1',
        imageProcessingSettings: { imageEnhancement: true, sharpening: 3 },
        isOpen: false,
      })
    );
    expect(result.current).toMatchObject({ imageEnhancement: true, sharpening: 3 });
  });

  it('returns empty object when no image and no snapshot', () => {
    const { result } = renderHook(() =>
      useImageModalProcessing({
        imageId: null,
        imageProcessingSettings: null,
        isOpen: true,
      })
    );
    expect(result.current).toEqual({});
  });

  it('merges snapshot processing when API returns execution', async () => {
    mockGetJobExecutionByImageId.mockResolvedValue({
      success: true,
      execution: {
        configurationSnapshot: {
          processing: { imageEnhancement: true, sharpening: 5, saturation: 1.2 },
        },
      },
    });
    const { result } = renderHook(() =>
      useImageModalProcessing({
        imageId: 'img-1',
        imageProcessingSettings: null,
        isOpen: true,
      })
    );
    await waitFor(() => {
      expect(mockGetJobExecutionByImageId).toHaveBeenCalledWith('img-1');
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({ imageEnhancement: true, sharpening: 5, saturation: 1.2 });
    });
  });

  it('clears snapshot when isOpen becomes false', async () => {
    mockGetJobExecutionByImageId.mockResolvedValue({
      success: true,
      execution: { configurationSnapshot: { processing: { sharpening: 7 } } },
    });
    const { result, rerender } = renderHook(
      (props: { imageId: string | null; imageProcessingSettings: unknown; isOpen: boolean }) =>
        useImageModalProcessing(props),
      { initialProps: { imageId: 'img-1', imageProcessingSettings: null, isOpen: true } }
    );
    await waitFor(() => {
      expect(result.current).toMatchObject({ sharpening: 7 });
    });
    rerender({ imageId: 'img-1', imageProcessingSettings: null, isOpen: false });
    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });

  it('uses per-image settings when custom retry (differ from snapshot)', async () => {
    mockGetJobExecutionByImageId.mockResolvedValue({
      success: true,
      execution: { configurationSnapshot: { processing: { sharpening: 5 } } },
    });
    const { result } = renderHook(() =>
      useImageModalProcessing({
        imageId: 'img-1',
        imageProcessingSettings: { sharpening: 10 },
        isOpen: true,
      })
    );
    await waitFor(() => {
      expect(mockGetJobExecutionByImageId).toHaveBeenCalledWith('img-1');
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({ sharpening: 10 });
    });
  });
});
