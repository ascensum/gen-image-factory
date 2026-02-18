/**
 * Story 3.4 Phase 4 / Out-of-scope: Unit tests for useJobOperations hook.
 * Same pattern as useDashboardActions, useSingleJobActions: mocked window.electronAPI.jobManagement.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useJobOperations } from '../useJobOperations';

const mockLoadJobs = vi.fn().mockResolvedValue(undefined);
const mockRefreshCounts = vi.fn().mockResolvedValue(undefined);
const mockOnOpenSingleJob = vi.fn();

const defaultOptions = {
  paginatedJobs: [
    { id: '1', status: 'completed', label: 'Job 1', startedAt: '2024-01-01T10:00:00Z' },
    { id: '2', status: 'completed', label: 'My Job (Rerun)', startedAt: '2024-01-01T11:00:00Z' }
  ] as any,
  loadJobs: mockLoadJobs,
  refreshCounts: mockRefreshCounts,
  onOpenSingleJob: mockOnOpenSingleJob
};

describe('useJobOperations', () => {
  const mockBulkRerun = vi.fn();
  const mockDeleteJobExecution = vi.fn();
  const mockRerunJobExecution = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI = {
      jobManagement: {
        bulkRerunJobExecutions: mockBulkRerun,
        deleteJobExecution: mockDeleteJobExecution,
        rerunJobExecution: mockRerunJobExecution
      }
    };
    mockBulkRerun.mockResolvedValue({ success: true });
    mockDeleteJobExecution.mockResolvedValue({ success: true });
    mockRerunJobExecution.mockResolvedValue({ success: true });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('initializes with no selection and single export type', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    expect(result.current.selectedJobs.size).toBe(0);
    expect(result.current.showExportDialog).toBe(false);
    expect(result.current.exportType).toBe('single');
    expect(result.current.exportJobId).toBe(null);
  });

  it('getDisplayLabel uses displayLabel/label/configurationName and rerun suffix (last 6 of id)', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    const job1 = { id: 'exec-xyz789', label: 'Config Name', displayLabel: 'Config Name' } as any;
    expect(result.current.getDisplayLabel(job1)).toBe('Config Name');

    const rerunJob = { id: 'exec-abc123', label: 'My Job (Rerun)' } as any;
    expect(result.current.getDisplayLabel(rerunJob)).toBe('My Job (Rerun abc123)');
  });

  it('getDisplayLabel falls back to job_<timestamp> when no label and has startedAt', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    const job = { id: 'x', startedAt: '2024-06-15T14:30:00Z' } as any;
    const label = result.current.getDisplayLabel(job);
    expect(label).toMatch(/^job_\d{8}_\d{6}$/);
  });

  it('getDisplayLabel falls back to Job <id> when no label and no valid startedAt', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    const job = { id: 99 } as any;
    expect(result.current.getDisplayLabel(job)).toBe('Job 99');
  });

  it('handleJobSelect adds and removes job from selection', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    act(() => result.current.handleJobSelect('1', true));
    expect(result.current.selectedJobs.has('1')).toBe(true);

    act(() => result.current.handleJobSelect('1', false));
    expect(result.current.selectedJobs.has('1')).toBe(false);
  });

  it('handleSelectAll selects all paginated jobs or clears', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    act(() => result.current.handleSelectAll(true));
    expect(result.current.selectedJobs.size).toBe(2);
    expect(result.current.selectedJobs.has('1')).toBe(true);
    expect(result.current.selectedJobs.has('2')).toBe(true);

    act(() => result.current.handleSelectAll(false));
    expect(result.current.selectedJobs.size).toBe(0);
  });

  it('handleBulkRerun calls bulkRerunJobExecutions, then loadJobs and refreshCounts', async () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    act(() => result.current.handleJobSelect('1', true));
    act(() => result.current.handleJobSelect('2', true));

    await act(async () => {
      await result.current.handleBulkRerun();
    });

    expect(mockBulkRerun).toHaveBeenCalledWith(['1', '2']);
    expect(mockLoadJobs).toHaveBeenCalled();
    expect(mockRefreshCounts).toHaveBeenCalled();
    expect(result.current.selectedJobs.size).toBe(0);
  });

  it('handleRerunSingle calls rerunJobExecution and loadJobs on success', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    await act(async () => {
      await result.current.handleRerunSingle('1');
    });

    expect(mockRerunJobExecution).toHaveBeenCalledWith('1');
    act(() => vi.advanceTimersByTime(1100));
    expect(mockLoadJobs).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handleDeleteSingle calls deleteJobExecution and loadJobs on success', async () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    await act(async () => {
      await result.current.handleDeleteSingle('1');
    });

    expect(mockDeleteJobExecution).toHaveBeenCalledWith('1');
    expect(mockLoadJobs).toHaveBeenCalled();
  });

  it('openExportSingle and openExportBulk set export dialog state', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    act(() => result.current.openExportSingle('1'));
    expect(result.current.showExportDialog).toBe(true);
    expect(result.current.exportType).toBe('single');
    expect(result.current.exportJobId).toBe('1');

    act(() => result.current.closeExportDialog());
    expect(result.current.showExportDialog).toBe(false);

    act(() => result.current.openExportBulk());
    expect(result.current.showExportDialog).toBe(true);
    expect(result.current.exportType).toBe('bulk');
    expect(result.current.exportJobId).toBe(null);
  });

  it('handleOpenSingleJob calls onOpenSingleJob', () => {
    const { result } = renderHook(() => useJobOperations(defaultOptions));

    act(() => result.current.handleOpenSingleJob('42'));
    expect(mockOnOpenSingleJob).toHaveBeenCalledWith('42');
  });
});
