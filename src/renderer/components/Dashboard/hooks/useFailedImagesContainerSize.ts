import { useState, useEffect, RefObject } from 'react';

/** Returns measured width/height of the Failed Images list scroll container. */
export function useFailedImagesContainerSize(
  scrollContainerRef: RefObject<HTMLDivElement | null>
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollContainerRef]);
  return size;
}
