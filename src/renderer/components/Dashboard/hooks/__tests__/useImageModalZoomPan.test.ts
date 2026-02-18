/**
 * Story 3.4 Phase 5c.2: Unit tests for useImageModalZoomPan hook.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useImageModalZoomPan } from '../useImageModalZoomPan';

describe('useImageModalZoomPan', () => {
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
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    expect(result.current.scale).toBe(1);
    expect(result.current.translate).toEqual({ x: 0, y: 0 });
    expect(result.current.isPanning).toBe(false);
  });

  it('exposes containerRef and imgRef', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    expect(result.current.containerRef).toBeDefined();
    expect(result.current.imgRef).toBeDefined();
    expect(result.current.containerRef.current).toBeNull();
    expect(result.current.imgRef.current).toBeNull();
  });

  it('resetZoomPan sets scale to 1 and translate to zero', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.setScale(2);
      result.current.setTranslate({ x: 10, y: 20 });
    });
    expect(result.current.scale).toBe(2);
    expect(result.current.translate).toEqual({ x: 10, y: 20 });
    act(() => {
      result.current.resetZoomPan();
    });
    expect(result.current.scale).toBe(1);
    expect(result.current.translate).toEqual({ x: 0, y: 0 });
  });

  it('zoomBy increases scale within bounds', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.zoomBy(0.5);
    });
    expect(result.current.scale).toBe(1.5);
    act(() => {
      result.current.zoomBy(0.5);
    });
    expect(result.current.scale).toBe(2);
  });

  it('zoomBy clamps scale to max 5', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.setScale(4.5);
      result.current.zoomBy(1);
    });
    expect(result.current.scale).toBe(5);
  });

  it('zoomBy clamps scale to min 0.2', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.setScale(0.5);
      result.current.zoomBy(-0.5);
    });
    expect(result.current.scale).toBe(0.2);
  });

  it('endPan sets isPanning to false', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.startPan({ button: 0, clientX: 0, clientY: 0 } as React.MouseEvent<HTMLDivElement>);
    });
    expect(result.current.isPanning).toBe(true);
    act(() => {
      result.current.endPan();
    });
    expect(result.current.isPanning).toBe(false);
  });

  it('startPan ignores non-left click', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    act(() => {
      result.current.startPan({ button: 1, clientX: 0, clientY: 0 } as React.MouseEvent<HTMLDivElement>);
    });
    expect(result.current.isPanning).toBe(false);
  });

  it('exposes fitToContainer, zoomBy, handleWheel, onPanMove', () => {
    const { result } = renderHook(() => useImageModalZoomPan({ isOpen: false, imageId: null }));
    expect(typeof result.current.fitToContainer).toBe('function');
    expect(typeof result.current.zoomBy).toBe('function');
    expect(typeof result.current.handleWheel).toBe('function');
    expect(typeof result.current.onPanMove).toBe('function');
  });
});
