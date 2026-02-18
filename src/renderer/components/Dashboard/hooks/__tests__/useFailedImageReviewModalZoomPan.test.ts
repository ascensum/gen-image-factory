/**
 * Story 3.4 Phase 5c.4: Unit tests for useFailedImageReviewModalZoomPan hook.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFailedImageReviewModalZoomPan } from '../useFailedImageReviewModalZoomPan';

describe('useFailedImageReviewModalZoomPan', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = setTimeout(() => cb(16), 0) as unknown as number;
      return id;
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  it('returns initial scale 1 and translate zero', () => {
    const { result } = renderHook(() => useFailedImageReviewModalZoomPan({ isOpen: false, imageId: null }));
    expect(result.current.scale).toBe(1);
    expect(result.current.translate).toEqual({ x: 0, y: 0 });
    expect(result.current.isPanning).toBe(false);
  });

  it('exposes containerRef, imgRef, and handlers', () => {
    const { result } = renderHook(() => useFailedImageReviewModalZoomPan({ isOpen: false, imageId: null }));
    expect(result.current.containerRef).toBeDefined();
    expect(result.current.imgRef).toBeDefined();
    expect(typeof result.current.fitToContainer).toBe('function');
    expect(typeof result.current.zoomBy).toBe('function');
    expect(typeof result.current.resetZoomPan).toBe('function');
  });

  it('resetZoomPan sets scale to 1 and translate to zero', () => {
    const { result } = renderHook(() => useFailedImageReviewModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.setScale(2);
      result.current.setTranslate({ x: 10, y: 20 });
    });
    act(() => result.current.resetZoomPan());
    expect(result.current.scale).toBe(1);
    expect(result.current.translate).toEqual({ x: 0, y: 0 });
  });

  it('zoomBy clamps scale to max 5', () => {
    const { result } = renderHook(() => useFailedImageReviewModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.setScale(4.5);
      result.current.zoomBy(1);
    });
    expect(result.current.scale).toBe(5);
  });

  it('endPan sets isPanning to false', () => {
    const { result } = renderHook(() => useFailedImageReviewModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.startPan({ button: 0, clientX: 0, clientY: 0 } as React.MouseEvent<HTMLDivElement>);
    });
    expect(result.current.isPanning).toBe(true);
    act(() => result.current.endPan());
    expect(result.current.isPanning).toBe(false);
  });
});
