/**
 * Story 3.4 Phase 4: Job list data loading, filtering, sorting, pagination.
 * Extracted from JobManagementPanel.tsx (frozen).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JobExecution, JobFilters } from '../../../../types/job';

export type UIJobFilters = JobFilters & { hasPendingRetries?: boolean };

const defaultFilters: UIJobFilters = {
  status: 'all',
  dateRange: 'all',
  label: '',
  minImages: 0,
  maxImages: undefined,
  hasPendingRetries: false,
};

export function useJobList() {
  const [jobs, setJobs] = useState<JobExecution[]>([]);
  const [filters, setFilters] = useState<UIJobFilters>({ ...defaultFilters });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField] = useState<keyof JobExecution>('startedAt');
  const [sortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalJobs, setTotalJobs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    total: number;
    completed: number;
    failed: number;
    processing: number;
    pending: number;
  } | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.label && filters.label.trim() !== '') count++;
    if (typeof filters.minImages === 'number' && filters.minImages > 0) count++;
    if (typeof filters.maxImages === 'number') count++;
    if (searchQuery && searchQuery.trim() !== '') count++;
    if (filters.hasPendingRetries) count++;
    return count;
  }, [filters, searchQuery]);

  const formatDateInput = useCallback((d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : ''), []);

  const filteredJobs = useMemo(() => {
    if (!jobs.length) return [];
    let filtered = [...jobs];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.label?.toLowerCase().includes(query) ||
          job.id.toString().includes(query) ||
          job.status.toLowerCase().includes(query)
      );
    }
    if (filters.status !== 'all') {
      const sFilter = filters.status;
      if (sFilter === 'processing') {
        filtered = filtered.filter((job) => {
          const s = String((job as any).status);
          return s === 'processing' || s === 'running';
        });
      } else if (sFilter === 'pending') {
        filtered = filtered.filter((job) => {
          const s = String((job as any).status);
          return s === 'pending' || s === 'queued';
        });
      } else {
        filtered = filtered.filter((job) => String((job as any).status) === sFilter);
      }
    }
    if (filters.hasPendingRetries) {
      filtered = filtered.filter((job: any) => typeof job.pendingJobs === 'number' && job.pendingJobs > 0);
    }
    if (filters.dateRange !== 'all') {
      let startDate = new Date();
      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((job) => new Date(job.startedAt || 0) >= startDate);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          filtered = filtered.filter((job) => new Date(job.startedAt || 0) >= startDate);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          filtered = filtered.filter((job) => new Date(job.startedAt || 0) >= startDate);
          break;
      }
    }
    if ((filters.label || '').trim()) {
      const labelQuery = (filters.label || '').toLowerCase();
      filtered = filtered.filter((job) => job.label?.toLowerCase().includes(labelQuery));
    }
    const minImages = filters.minImages ?? 0;
    if (minImages > 0) filtered = filtered.filter((job) => (job.totalImages || 0) >= minImages);
    if (typeof filters.maxImages === 'number') {
      filtered = filtered.filter((job) => (job.totalImages || 0) <= (filters.maxImages as number));
    }
    return filtered;
  }, [jobs, searchQuery, filters]);

  const sortedJobs = useMemo(() => {
    if (!filteredJobs.length) return [];
    const sorted = [...filteredJobs].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      if (sortField === 'startedAt' || sortField === 'completedAt') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredJobs, sortField, sortDirection]);

  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedJobs.slice(start, start + pageSize);
  }, [sortedJobs, currentPage, pageSize]);

  const totalPages = useMemo(() => Math.ceil(sortedJobs.length / pageSize), [sortedJobs.length, pageSize]);

  const statistics = useMemo(() => {
    const fallbackCompleted = jobs.filter((j) => j.status === 'completed').length;
    const fallbackFailed = jobs.filter((j) => j.status === 'failed').length;
    const fallbackProcessing = jobs.filter((j) => {
      const s = String((j as any).status);
      return s === 'processing' || s === 'running';
    }).length;
    const fallbackPending = jobs.filter((j) => {
      const s = String((j as any).status);
      return s === 'pending' || s === 'queued';
    }).length;
    const totalImages = jobs.reduce((sum, j) => sum + (j.totalImages || 0), 0);
    return {
      totalJobs: counts?.total ?? jobs.length,
      completedJobs: counts?.completed ?? fallbackCompleted,
      failedJobs: counts?.failed ?? fallbackFailed,
      processingJobs: counts?.processing ?? fallbackProcessing,
      pendingJobs: counts?.pending ?? fallbackPending,
      totalImages,
      averageImagesPerJob: jobs.length > 0 ? totalImages / jobs.length : 0,
    };
  }, [jobs, counts]);

  const uiStats = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thisWeekStart = now - sevenDaysMs;
    const prevWeekStart = now - 2 * sevenDaysMs;
    const prevWeekEnd = thisWeekStart;
    const getTime = (d: any) => {
      if (!d) return 0;
      const t = new Date(d).getTime();
      return isNaN(t) ? 0 : t;
    };
    const thisWeekJobs = jobs.filter((j) => {
      const t = getTime((j as any).startedAt || (j as any).completedAt);
      return t >= thisWeekStart && t <= now;
    }).length;
    const prevWeekJobs = jobs.filter((j) => {
      const t = getTime((j as any).startedAt || (j as any).completedAt);
      return t >= prevWeekStart && t < prevWeekEnd;
    }).length;
    let weeklyDeltaPct = 0;
    let weeklyTrend: 'up' | 'down' | 'flat' = 'flat';
    if (prevWeekJobs > 0) {
      weeklyDeltaPct = Math.round(((thisWeekJobs - prevWeekJobs) / prevWeekJobs) * 100);
      weeklyTrend = weeklyDeltaPct > 0 ? 'up' : weeklyDeltaPct < 0 ? 'down' : 'flat';
    } else if (thisWeekJobs > 0) {
      weeklyDeltaPct = 100;
      weeklyTrend = 'up';
    }
    const failedLast24h = jobs.filter((j) => {
      if (String((j as any).status).toLowerCase() !== 'failed') return false;
      const t = getTime((j as any).completedAt || (j as any).startedAt);
      return t >= now - oneDayMs && t <= now;
    }).length;
    const completionRate = statistics.totalJobs > 0 ? Math.round(((statistics.completedJobs || 0) / statistics.totalJobs) * 100) : 0;
    return { weeklyDeltaPct, weeklyTrend, failedLast24h, completionRate };
  }, [jobs, statistics]);

  const loadJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const effectiveFilters: JobFilters = { ...(filters as JobFilters) };
      if (effectiveFilters.dateFrom && !effectiveFilters.dateTo) effectiveFilters.dateTo = effectiveFilters.dateFrom;
      else if (!effectiveFilters.dateFrom && effectiveFilters.dateTo) effectiveFilters.dateFrom = effectiveFilters.dateTo;
      const result = await (window as any).electronAPI.jobManagement.getJobExecutionsWithFilters(effectiveFilters, 1, 10000);
      if (result?.success) {
        let list: JobExecution[] = (Array.isArray((result as any).executions)
          ? (result as any).executions
          : Array.isArray((result as any).jobs)
            ? (result as any).jobs
            : Array.isArray((result as any).data)
              ? (result as any).data
              : []) as any;
        list = list.map((job: any) => {
          const raw = String(job.status || '');
          return { ...job, status: raw === 'queued' ? 'pending' : raw } as JobExecution;
        });
        try {
          const status = await (window as any).electronAPI?.jobManagement?.getJobStatus?.();
          const current = (status as any)?.currentJob;
          const stateStr = String((status as any)?.state || (current as any)?.status || '').toLowerCase();
          const execId = (current as any)?.executionId || (status as any)?.executionId;
          if (current && execId && (stateStr === 'running' || stateStr === 'processing')) {
            const idx = list.findIndex((j) => String((j as any).id) === String(execId));
            const hasRunningInList = list.some((j) => String((j as any).status).toLowerCase() === 'running');
            const fromDb = idx >= 0 ? (list[idx] as any) : null;
            let base = String(fromDb?.label || fromDb?.displayLabel || (current as any)?.label || (current as any)?.configurationName || `Job ${execId}`).trim();
            const isRerun = base.endsWith('(Rerun)');
            const display = isRerun ? base.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(execId).slice(-6)})` : base;
            const normalized: any = { ...(idx >= 0 ? (list[idx] as any) : {}), ...(current as any), status: 'running', id: execId, label: base, displayLabel: display };
            if (!normalized.startedAt) {
              const startedAtRaw = (current as any)?.startedAt || (current as any)?.startTime || (status as any)?.startTime;
              if (startedAtRaw) normalized.startedAt = new Date(startedAtRaw);
            }
            if (idx >= 0) (list as any)[idx] = normalized as JobExecution;
            else if (!hasRunningInList) list = [normalized as JobExecution, ...list];
          }
        } catch {}
        setJobs(list);
        setTotalJobs((result as any).count ?? (result as any).totalCount ?? list.length ?? 0);
      } else {
        throw new Error((result as any)?.error || 'Failed to load jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      setJobs([]);
      setTotalJobs(0);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [filters]);

  const refreshCounts = useCallback(async () => {
    try {
      const api = (window as any).electronAPI?.jobManagement;
      if (!api) return;
      const readCount = (res: any) => Number((res && (res.count ?? res.totalCount ?? res)) || 0);
      const getCount = async (status: string) => {
        try {
          if (api.getJobExecutionsCount) {
            const res = await api.getJobExecutionsCount({ status });
            const c = readCount(res);
            if (!Number.isNaN(c)) return c;
          }
        } catch {}
        try {
          const res = await api.getJobExecutionsWithFilters({ status }, 1, 1);
          return readCount(res) || (Array.isArray((res as any)?.executions) ? (res as any).executions.length : 0);
        } catch {
          return 0;
        }
      };
      const [total, completed, failed, processing, running, pending, queued, queueSize] = await Promise.all([
        getCount('all'),
        getCount('completed'),
        getCount('failed'),
        getCount('processing'),
        getCount('running'),
        getCount('pending'),
        getCount('queued'),
        (async () => {
          try {
            const res = await api.getBulkRerunQueueSize?.();
            return Number((res && res.count) || 0);
          } catch {
            return 0;
          }
        })(),
      ]);
      setCounts({ total, completed, failed, processing: processing + running, pending: Math.max(pending + queued, queueSize) });
    } catch {}
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {}, 300);
  }, []);

  const handleFiltersChange = useCallback((newFilters: UIJobFilters) => {
    setFilters(newFilters);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultFilters, dateFrom: undefined, dateTo: undefined });
    setSearchQuery('');
  }, []);

  useEffect(() => {
    loadJobs();
    refreshCounts();
  }, [loadJobs, refreshCounts]);

  useEffect(() => {
    const hasActive = jobs.some((j) => {
      const s = String((j as any).status);
      return s === 'running' || s === 'processing' || s === 'pending';
    });
    if (!hasActive) return;
    const interval = setInterval(() => {
      loadJobs(true);
      refreshCounts();
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs, refreshCounts]);

  useEffect(() => {
    const iv = setInterval(refreshCounts, 3000);
    return () => clearInterval(iv);
  }, [refreshCounts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return {
    jobs,
    filters,
    setFilters,
    searchQuery,
    currentPage,
    pageSize,
    totalJobs,
    isLoading,
    error,
    setError,
    counts,
    loadJobs,
    refreshCounts,
    filteredJobs,
    sortedJobs,
    paginatedJobs,
    totalPages,
    statistics,
    uiStats,
    activeFiltersCount,
    formatDateInput,
    handleSearch,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    clearFilters,
  };
}
