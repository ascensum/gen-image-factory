/**
 * Story 3.4 Phase 5c.3: Unit tests for useImageGalleryFilteredImages hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useImageGalleryFilteredImages } from '../useImageGalleryFilteredImages';

const baseImage = (
  id: string,
  executionId: string,
  createdAt: string,
  generationPrompt: string
) => ({
  id,
  executionId,
  generationPrompt,
  createdAt: new Date(createdAt),
  qcStatus: 'approved' as const,
});

describe('useImageGalleryFilteredImages', () => {
  it('returns all images when filter is all and no search', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z', 'Prompt A'),
      baseImage('2', 'job1', '2026-02-01T11:00:00Z', 'Prompt B'),
    ];
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images,
        jobFilter: 'all',
        searchQuery: '',
        sortBy: 'newest',
        dateFrom: null,
        dateTo: null,
      })
    );
    expect(result.current).toHaveLength(2);
    expect(result.current.map((i) => i.id)).toEqual(['2', '1']);
  });

  it('filters by job when jobFilter is set', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z', 'A'),
      baseImage('2', 'job2', '2026-02-01T11:00:00Z', 'B'),
    ];
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images,
        jobFilter: 'job1',
        searchQuery: '',
        sortBy: 'newest',
        dateFrom: null,
        dateTo: null,
      })
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('sorts by newest first', () => {
    const images = [
      baseImage('a', 'job1', '2026-02-01T09:00:00Z', 'A'),
      baseImage('b', 'job1', '2026-02-01T11:00:00Z', 'B'),
    ];
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images,
        jobFilter: 'all',
        searchQuery: '',
        sortBy: 'newest',
        dateFrom: null,
        dateTo: null,
      })
    );
    expect(result.current.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('sorts by oldest first when sortBy is oldest', () => {
    const images = [
      baseImage('a', 'job1', '2026-02-01T09:00:00Z', 'A'),
      baseImage('b', 'job1', '2026-02-01T11:00:00Z', 'B'),
    ];
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images,
        jobFilter: 'all',
        searchQuery: '',
        sortBy: 'oldest',
        dateFrom: null,
        dateTo: null,
      })
    );
    expect(result.current.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('filters by search query matching generationPrompt', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z', 'Landscape'),
      baseImage('2', 'job1', '2026-02-01T11:00:00Z', 'UniqueWord'),
    ];
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images,
        jobFilter: 'all',
        searchQuery: 'UniqueWord',
        sortBy: 'newest',
        dateFrom: null,
        dateTo: null,
      })
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('2');
  });

  it('filters by date range', () => {
    const images = [
      baseImage('1', 'job1', '2026-02-01T10:00:00Z', 'A'),
      baseImage('2', 'job1', '2026-02-03T10:00:00Z', 'B'),
      baseImage('3', 'job1', '2026-02-05T10:00:00Z', 'C'),
    ];
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images,
        jobFilter: 'all',
        searchQuery: '',
        sortBy: 'newest',
        dateFrom: '2026-02-02',
        dateTo: '2026-02-04',
      })
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('2');
  });

  it('returns empty array when images is empty', () => {
    const { result } = renderHook(() =>
      useImageGalleryFilteredImages({
        images: [],
        jobFilter: 'all',
        searchQuery: '',
        sortBy: 'newest',
        dateFrom: null,
        dateTo: null,
      })
    );
    expect(result.current).toEqual([]);
  });
});
