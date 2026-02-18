import { useState, useEffect, RefObject } from 'react';

/** Returns measured width/height of the gallery scroll container when on image-gallery tab. */
export function useGalleryContainerSize(
  activeTab: string,
  galleryScrollRef: RefObject<HTMLDivElement | null>
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = galleryScrollRef.current;
    if (!el || activeTab !== 'image-gallery') return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab, galleryScrollRef]);
  return size;
}
