/**
 * Story 3.4 Phase 5c.6: Unit tests for useJobHistoryFilteredSorted hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useJobHistoryFilteredSorted } from '../useJobHistoryFilteredSorted';

const baseJob = (id: string, status: string, startedAt: string, configurationName: string) => ({
  id,
  configurationId: 1,
  configurationName,
  startedAt: new Date(startedAt),
  completedAt: null,
  status: status as 'pending' | 'running' | 'completed' | 'failed' | 'stopped',
  totalImages: 10,
  successfulImages: 0,
  failedImages: 0,
});

describe('useJobHistoryFilteredSorted', () => {
  it('returns all jobs when statusFilter is all', () => {
    const jobs = [
      baseJob('1', 'completed', '2026-02-01T10:00:00Z', 'Job A'),
      baseJob('2', 'failed', '2026-02-01T11:00:00Z', 'Job B'),
    ];
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs, statusFilter: 'all', sortBy: 'newest' })
    );
    expect(result.current).toHaveLength(2);
    expect(result.current.map((j) => j.id)).toEqual(['2', '1']);
  });

  it('filters by status when statusFilter is set', () => {
    const jobs = [
      baseJob('1', 'completed', '2026-02-01T10:00:00Z', 'A'),
      baseJob('2', 'failed', '2026-02-01T11:00:00Z', 'B'),
    ];
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs, statusFilter: 'completed', sortBy: 'newest' })
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('sorts by newest first', () => {
    const jobs = [
      baseJob('a', 'completed', '2026-02-01T09:00:00Z', 'A'),
      baseJob('b', 'completed', '2026-02-01T11:00:00Z', 'B'),
    ];
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs, statusFilter: 'all', sortBy: 'newest' })
    );
    expect(result.current.map((j) => j.id)).toEqual(['b', 'a']);
  });

  it('puts running job first when sortBy is newest (single rerun at top)', () => {
    const jobs = [
      baseJob('newer', 'completed', '2026-02-01T12:00:00Z', 'Newer'),
      baseJob('running', 'running', '2026-02-01T11:00:00Z', 'Rerun'),
    ];
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs, statusFilter: 'all', sortBy: 'newest' })
    );
    expect(result.current[0].id).toBe('running');
    expect(result.current[0].status).toBe('running');
    expect(result.current[1].id).toBe('newer');
  });

  it('sorts by oldest first when sortBy is oldest', () => {
    const jobs = [
      baseJob('a', 'completed', '2026-02-01T09:00:00Z', 'A'),
      baseJob('b', 'completed', '2026-02-01T11:00:00Z', 'B'),
    ];
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs, statusFilter: 'all', sortBy: 'oldest' })
    );
    expect(result.current.map((j) => j.id)).toEqual(['a', 'b']);
  });

  it('sorts by name when sortBy is name', () => {
    const jobs = [
      baseJob('1', 'completed', '2026-02-01T10:00:00Z', 'Zebra'),
      baseJob('2', 'completed', '2026-02-01T10:00:00Z', 'Alpha'),
    ];
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs, statusFilter: 'all', sortBy: 'name' })
    );
    expect(result.current.map((j) => j.configurationName)).toEqual(['Alpha', 'Zebra']);
  });

  it('returns empty array when jobs is empty', () => {
    const { result } = renderHook(() =>
      useJobHistoryFilteredSorted({ jobs: [], statusFilter: 'all', sortBy: 'newest' })
    );
    expect(result.current).toEqual([]);
  });
});
