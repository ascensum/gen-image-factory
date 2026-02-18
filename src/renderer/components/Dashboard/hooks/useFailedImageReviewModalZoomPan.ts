/**
 * Story 3.4 Phase 5c.4: Zoom/pan for FailedImageReviewModal.
 * Fits image only when modal first opens (session start), not when navigating to next/prev image.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseFailedImageReviewModalZoomPanOptions {
  isOpen: boolean;
  imageId: string | number | null;
}

export function useFailedImageReviewModalZoomPan({ isOpen, imageId }: UseFailedImageReviewModalZoomPanOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const wasOpenRef = useRef(false);

  const fitToContainer = useCallback(() => {
    const imgEl = imgRef.current;
    const contEl = containerRef.current;
    if (!imgEl || !contEl) return;
    const naturalW = imgEl.naturalWidth || imgEl.width;
    const naturalH = imgEl.naturalHeight || imgEl.height;
    const rect = contEl.getBoundingClientRect();
    const maxW = rect.width - 32;
    const maxH = rect.height - 32;
    if (naturalW <= 0 || naturalH <= 0 || maxW <= 0 || maxH <= 0) return;
    const s = Math.min(maxW / naturalW, maxH / naturalH, 1);
    setScale(s > 0 ? s : 1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (justOpened) {
      const id = requestAnimationFrame(fitToContainer);
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, imageId, fitToContainer]);

  const zoomBy = useCallback((delta: number, center?: { x: number; y: number }) => {
    setScale((prev) => {
      const next = Math.min(Math.max(prev + delta, 0.2), 5);
      if (center && containerRef.current) {
        const contRect = containerRef.current.getBoundingClientRect();
        const cx = center.x - contRect.left - contRect.width / 2;
        const cy = center.y - contRect.top - contRect.height / 2;
        const ratio = next / prev - 1;
        setTranslate((t) => ({ x: t.x - cx * ratio, y: t.y - cy * ratio }));
      }
      return next;
    });
  }, []);

  // Wheel zoom: must use a non-passive listener so preventDefault() is allowed (Ctrl/Cmd+wheel).
  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const direction = e.deltaY > 0 ? -0.1 : 0.1;
        zoomBy(direction, { x: e.clientX, y: e.clientY });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isOpen, imageId, zoomBy]);

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = useCallback(() => {
    // No-op: zoom is handled by the non-passive listener above to avoid passive-event preventDefault errors.
  }, []);

  const startPan: React.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  }, [translate]);

  const onPanMove: React.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTranslate({ x: translateStart.current.x + dx, y: translateStart.current.y + dy });
  }, [isPanning]);

  const endPan = useCallback(() => setIsPanning(false), []);

  const resetZoomPan = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return {
    containerRef,
    imgRef,
    scale,
    setScale,
    translate,
    setTranslate,
    isPanning,
    fitToContainer,
    zoomBy,
    handleWheel,
    startPan,
    onPanMove,
    endPan,
    resetZoomPan,
  };
}
