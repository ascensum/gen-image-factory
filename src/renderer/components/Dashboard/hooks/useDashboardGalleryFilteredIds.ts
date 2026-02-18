/**
 * Story 3.4 Phase 5c: Filtered image IDs for dashboard gallery (job, search, sort, date).
 * Extracted from DashboardView.tsx to keep view < 400 lines.
 */
import { useMemo } from 'react';

export interface GalleryFilterInput {
  generatedImages: Array<{ id: string; executionId?: string | number; createdAt?: string | Date; generationPrompt?: string; metadata?: unknown }>;
  imageJobFilter: string;
  imageSearchQuery: string;
  imageSortBy: string;
  imageDateFrom: string;
  imageDateTo: string;
}

export function useDashboardGalleryFilteredIds(input: GalleryFilterInput): string[] {
  return useMemo(() => {
    let images = [...input.generatedImages];
    const { imageJobFilter, imageSearchQuery, imageSortBy, imageDateFrom: dateFrom, imageDateTo: dateTo } = input;

    if (imageJobFilter !== 'all') {
      images = images.filter(img => String(img.executionId) === String(imageJobFilter));
    }

    images.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
      if (imageSortBy === 'newest') return dateB - dateA;
      if (imageSortBy === 'oldest') return dateA - dateB;
      if (imageSortBy === 'name') return (a.generationPrompt || '').localeCompare(b.generationPrompt || '');
      return 0;
    });

    const query = imageSearchQuery;
    const ids = images.filter(image => {
      if (query) {
        const q = query.toLowerCase();
        const meta = image.metadata;
        const title = (meta && typeof meta === 'object' && 'title' in meta)
          ? (typeof (meta as { title?: string }).title === 'string' ? (meta as { title: string }).title : ((meta as { title?: { en?: string } }).title as any)?.en || '')
          : '';
        const description = (meta && typeof meta === 'object' && 'description' in meta)
          ? (typeof (meta as { description?: string }).description === 'string' ? (meta as { description: string }).description : ((meta as { description?: { en?: string } }).description as any)?.en || '')
          : '';
        const tags = (meta && typeof meta === 'object' && 'tags' in meta && Array.isArray((meta as { tags?: string[] }).tags))
          ? (meta as { tags: string[] }).tags.join(' ')
          : '';
        const rawMeta = (image as { metadata?: { prompt?: string } }).metadata;
        const metaPrompt = (typeof rawMeta === 'string' ? '' : (rawMeta?.prompt || ''));
        const matches = (image.generationPrompt || '').toLowerCase().includes(q)
          || title.toLowerCase().includes(q)
          || description.toLowerCase().includes(q)
          || tags.toLowerCase().includes(q)
          || metaPrompt.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (dateFrom || dateTo) {
        if (!image.createdAt) return false;
        const d = new Date(image.createdAt as any);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const ymd = `${y}-${m}-${day}`;
        if (dateFrom && ymd < dateFrom) return false;
        if (dateTo && ymd > dateTo) return false;
      }
      return true;
    }).map(img => img.id);
    return ids;
  }, [input.generatedImages, input.imageJobFilter, input.imageSearchQuery, input.imageSortBy, input.imageDateFrom, input.imageDateTo]);
}
