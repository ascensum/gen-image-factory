/**
 * Story 3.4 Phase 5c.3: Filter and sort images for ImageGallery.
 * Extracted from ImageGallery.tsx to keep container < 400 lines.
 */
import { useMemo } from 'react';
import type { GeneratedImageWithStringId } from '../../../../types/generatedImage';

export type ImageGalleryImage = GeneratedImageWithStringId;

export function parseImageGalleryMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  return {};
}

export interface UseImageGalleryFilteredImagesOptions {
  images: GeneratedImageWithStringId[];
  jobFilter: string;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'name';
  dateFrom: string | null;
  dateTo: string | null;
}

export function useImageGalleryFilteredImages({
  images,
  jobFilter,
  searchQuery,
  sortBy,
  dateFrom,
  dateTo,
}: UseImageGalleryFilteredImagesOptions): GeneratedImageWithStringId[] {
  return useMemo(() => {
    if (!images || !Array.isArray(images)) return [];

    const filtered = images.filter((image: GeneratedImageWithStringId) => {
      if (jobFilter !== 'all' && image.executionId != jobFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const meta = parseImageGalleryMetadata(image.metadata);
        const matchesPrompt = image.generationPrompt.toLowerCase().includes(query);
        const metaPrompt = typeof meta?.prompt === 'string' ? meta.prompt.toLowerCase() : '';
        const matchesMetadataPrompt = (metaPrompt as string).includes(query);
        const title = typeof meta?.title === 'string' ? meta.title : (meta?.title as { en?: string })?.en || '';
        const matchesTitle = (title as string).toLowerCase().includes(query);
        const description = typeof meta?.description === 'string' ? meta.description : (meta?.description as { en?: string })?.en || '';
        const matchesDescription = (description as string).toLowerCase().includes(query);
        const tags = Array.isArray(meta?.tags) ? (meta.tags as string[]).join(' ').toLowerCase() : '';
        const matchesTags = tags.includes(query);
        if (!matchesPrompt && !matchesMetadataPrompt && !matchesTitle && !matchesDescription && !matchesTags) {
          return false;
        }
      }

      if (dateFrom || dateTo) {
        if (!image.createdAt) return false;
        const d = new Date(image.createdAt as string | Date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const createdYmd = `${y}-${m}-${day}`;
        if (dateFrom && createdYmd < dateFrom) return false;
        if (dateTo && createdYmd > dateTo) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.createdAt ? new Date(b.createdAt as string | Date).getTime() : 0) - (a.createdAt ? new Date(a.createdAt as string | Date).getTime() : 0);
        case 'oldest':
          return (a.createdAt ? new Date(a.createdAt as string | Date).getTime() : 0) - (b.createdAt ? new Date(b.createdAt as string | Date).getTime() : 0);
        case 'name':
          return a.generationPrompt.localeCompare(b.generationPrompt);
        default:
          return 0;
      }
    });

    return sorted;
  }, [images, jobFilter, searchQuery, sortBy, dateFrom, dateTo]);
}
