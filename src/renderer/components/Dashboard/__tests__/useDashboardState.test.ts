import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardState } from '../hooks/useDashboardState';

describe('useDashboardState', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useDashboardState());

    expect(result.current.jobStatus).toEqual({
      state: 'idle',
      progress: 0,
      currentStep: 1,
      totalSteps: 2
    });
    expect(result.current.jobHistory).toEqual([]);
    expect(result.current.generatedImages).toEqual([]);
    expect(result.current.logs).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeTab).toBe('overview');
    expect(result.current.imageViewMode).toBe('grid');
    expect(result.current.imageJobFilter).toBe('all');
    expect(result.current.imageSearchQuery).toBe('');
    expect(result.current.imageSortBy).toBe('newest');
    expect(result.current.selectedImages).toEqual(new Set());
    expect(result.current.exportJobId).toBeNull();
    expect(result.current.showSingleExportModal).toBe(false);
  });

  it('updates state via setters', () => {
    const { result } = renderHook(() => useDashboardState());

    act(() => {
      result.current.setActiveTab('image-gallery');
    });
    expect(result.current.activeTab).toBe('image-gallery');

    act(() => {
      result.current.setImageSearchQuery('test');
    });
    expect(result.current.imageSearchQuery).toBe('test');

    act(() => {
      result.current.setSelectedImages(new Set(['id1']));
    });
    expect(result.current.selectedImages).toEqual(new Set(['id1']));

    act(() => {
      result.current.setError('Something failed');
    });
    expect(result.current.error).toBe('Something failed');

    act(() => {
      result.current.setExportJobId('job-1');
      result.current.setShowSingleExportModal(true);
    });
    expect(result.current.exportJobId).toBe('job-1');
    expect(result.current.showSingleExportModal).toBe(true);
  });

  it('computes statistics from jobHistory when jobHistory has entries', () => {
    const { result } = renderHook(() => useDashboardState());
    const started = new Date('2025-01-01T10:00:00Z');
    const completed = new Date('2025-01-01T10:05:00Z');

    act(() => {
      result.current.setJobHistory([
        {
          id: 'j1',
          configurationId: 1,
          configurationName: 'Test',
          startedAt: started,
          completedAt: completed,
          status: 'completed',
          totalImages: 10,
          successfulImages: 8,
          failedImages: 2
        } as any
      ]);
    });

    expect(result.current.computedStatistics.totalJobs).toBe(1);
    expect(result.current.computedStatistics.completedJobs).toBe(1);
    expect(result.current.computedStatistics.failedJobs).toBe(0);
    expect(result.current.computedStatistics.totalImagesGenerated).toBe(8);
    expect(result.current.computedStatistics.averageExecutionTime).toBe(300); // 5 min
  });

  it('computes success rate from jobHistory', () => {
    const { result } = renderHook(() => useDashboardState());

    act(() => {
      result.current.setJobHistory([
        {
          id: 'j1',
          configurationId: 1,
          configurationName: 'Test',
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'completed',
          totalImages: 10,
          successfulImages: 5,
          failedImages: 5
        } as any
      ]);
    });

    expect(result.current.computedStatistics.successRate).toBe(50);
  });
});
