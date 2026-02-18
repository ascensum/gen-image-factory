/**
 * Story 3.4 Phase 5c.6: Filter and sort jobs for JobHistory.
 */
import { useMemo } from 'react';
import type { JobExecution } from './useDashboardState';

export interface UseJobHistoryFilteredSortedOptions {
  jobs: JobExecution[];
  statusFilter?: string;
  sortBy?: 'newest' | 'oldest' | 'name';
}

export function useJobHistoryFilteredSorted({
  jobs,
  statusFilter = 'all',
  sortBy = 'newest',
}: UseJobHistoryFilteredSortedOptions): JobExecution[] {
  return useMemo(() => {
    if (!jobs || !Array.isArray(jobs)) return [];
    const activeStatusFilter = statusFilter ?? 'all';
    const activeSortBy = sortBy ?? 'newest';

    let filtered = jobs;
    if (activeStatusFilter !== 'all') {
      filtered = filtered.filter((job) => job.status === activeStatusFilter);
    }

    const sorted = [...filtered].sort((a, b) => {
      const isRunning = (j: JobExecution) => String(j?.status).toLowerCase() === 'running';
      switch (activeSortBy) {
        case 'oldest':
          if (!a.startedAt && !b.startedAt) return 0;
          if (!a.startedAt) return 1;
          if (!b.startedAt) return -1;
          return new Date(a.startedAt as Date).getTime() - new Date(b.startedAt as Date).getTime();
        case 'newest':
          // Running jobs first so single rerun appears at top immediately
          const aRunning = isRunning(a);
          const bRunning = isRunning(b);
          if (aRunning && !bRunning) return -1;
          if (!aRunning && bRunning) return 1;
          if (!a.startedAt && !b.startedAt) return 0;
          if (!a.startedAt) return 1;
          if (!b.startedAt) return -1;
          return new Date(b.startedAt as Date).getTime() - new Date(a.startedAt as Date).getTime();
        case 'name':
          const nameA = a.configurationName || 'Unknown';
          const nameB = b.configurationName || 'Unknown';
          return nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });

    return sorted;
  }, [jobs, statusFilter, sortBy]);
}
