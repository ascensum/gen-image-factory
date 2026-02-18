/**
 * Story 3.4 Phase 5c: Unit tests for useDashboardGalleryFilteredIds hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDashboardGalleryFilteredIds } from '../useDashboardGalleryFilteredIds';

describe('useDashboardGalleryFilteredIds', () => {
  const baseImage = (id: string, executionId: string, createdAt: string) => ({
    id,
    executionId,
    createdAt,
    generationPrompt: `Prompt ${id}`,
    metadata: { title: `Title ${id}` },
  });

  it('returns all ids when filter is all and no search', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z'),
      baseImage('2', 'job1', '2026-02-01T11:00:00Z'),
    ];
    const { result } = renderHook(() =>
      useDashboardGalleryFilteredIds({
        generatedImages: images,
        imageJobFilter: 'all',
        imageSearchQuery: '',
        imageSortBy: 'newest',
        imageDateFrom: '',
        imageDateTo: '',
      })
    );
    expect(result.current).toHaveLength(2);
    expect(result.current).toContain('1');
    expect(result.current).toContain('2');
  });

  it('filters by job when imageJobFilter is set', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z'),
      baseImage('2', 'job2', '2026-02-01T11:00:00Z'),
    ];
    const { result } = renderHook(() =>
      useDashboardGalleryFilteredIds({
        generatedImages: images,
        imageJobFilter: 'job1',
        imageSearchQuery: '',
        imageSortBy: 'newest',
        imageDateFrom: '',
        imageDateTo: '',
      })
    );
    expect(result.current).toEqual(['1']);
  });

  it('sorts by newest first', () => {
    const images = [
      baseImage('a', 'job1', '2026-02-01T09:00:00Z'),
      baseImage('b', 'job1', '2026-02-01T11:00:00Z'),
    ];
    const { result } = renderHook(() =>
      useDashboardGalleryFilteredIds({
        generatedImages: images,
        imageJobFilter: 'all',
        imageSearchQuery: '',
        imageSortBy: 'newest',
        imageDateFrom: '',
        imageDateTo: '',
      })
    );
    expect(result.current).toEqual(['b', 'a']);
  });

  it('filters by search query matching generationPrompt', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z'),
      { ...baseImage('2', 'job1', '2026-02-01T11:00:00Z'), generationPrompt: 'UniqueWord' },
    ];
    const { result } = renderHook(() =>
      useDashboardGalleryFilteredIds({
        generatedImages: images,
        imageJobFilter: 'all',
        imageSearchQuery: 'UniqueWord',
        imageSortBy: 'newest',
        imageDateFrom: '',
        imageDateTo: '',
      })
    );
    expect(result.current).toEqual(['2']);
  });
});
