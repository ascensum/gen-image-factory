/**
 * Story 3.4 Phase 5b: Unit tests for useSingleJobImages hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSingleJobImages } from '../useSingleJobImages';

const baseImage = {
  id: '1',
  executionId: 1,
  qcStatus: 'approved',
  finalImagePath: '/out/1.png',
  generationPrompt: 'A test',
  createdAt: '2026-02-01T10:00:00Z',
};

describe('useSingleJobImages', () => {
  it('initializes with grid view and all filter', () => {
    const { result } = renderHook(() => useSingleJobImages([], null));

    expect(result.current.viewMode).toBe('grid');
    expect(result.current.imageFilter).toBe('all');
    expect(result.current.filteredImages).toEqual([]);
  });

  it('filteredImages returns all images when filter is all', () => {
    const images = [baseImage, { ...baseImage, id: '2' }];
    const { result } = renderHook(() => useSingleJobImages(images, null));

    expect(result.current.filteredImages).toHaveLength(2);
  });

  it('filteredImages filters approved when imageFilter is approved', () => {
    const images = [
      { ...baseImage, id: '1', qcStatus: 'approved' },
      { ...baseImage, id: '2', qcStatus: 'qc_failed' },
    ];
    const { result } = renderHook(() => useSingleJobImages(images, null));

    act(() => {
      result.current.setImageFilter('approved');
    });

    expect(result.current.filteredImages).toHaveLength(1);
    expect(result.current.filteredImages[0].qcStatus).toBe('approved');
  });

  it('getImageUiStatus returns approved for approved/complete', () => {
    const { result } = renderHook(() => useSingleJobImages([], null));

    expect(result.current.getImageUiStatus('approved')).toBe('approved');
    expect(result.current.getImageUiStatus('complete')).toBe('approved');
    expect(result.current.getImageUiStatus('completed')).toBe('approved');
  });

  it('getImageUiStatus returns qc_failed for others', () => {
    const { result } = renderHook(() => useSingleJobImages([], null));

    expect(result.current.getImageUiStatus('qc_failed')).toBe('qc_failed');
    expect(result.current.getImageUiStatus('')).toBe('qc_failed');
    expect(result.current.getImageUiStatus(null)).toBe('qc_failed');
  });

  it('getImageTitle returns metadata title when present', () => {
    const images = [
      { ...baseImage, metadata: JSON.stringify({ title: 'My Image' }) },
    ];
    const { result } = renderHook(() => useSingleJobImages(images, null));

    expect(result.current.getImageTitle(images[0])).toBe('My Image');
  });

  it('getImageTitle returns Image id when no title', () => {
    const { result } = renderHook(() => useSingleJobImages([baseImage], null));

    expect(result.current.getImageTitle(baseImage)).toBe('Image 1');
  });

  it('setViewMode updates viewMode', () => {
    const { result } = renderHook(() => useSingleJobImages([], null));

    act(() => {
      result.current.setViewMode('list');
    });
    expect(result.current.viewMode).toBe('list');
  });

  it('failedProcessingCount counts qc_failed and retry_failed', () => {
    const images = [
      { ...baseImage, id: '1', qcStatus: 'approved' },
      { ...baseImage, id: '2', qcStatus: 'qc_failed' },
      { ...baseImage, id: '3', qcStatus: 'retry_failed' },
    ];
    const { result } = renderHook(() => useSingleJobImages(images, null));

    expect(result.current.failedProcessingCount).toBe(2);
  });
});
