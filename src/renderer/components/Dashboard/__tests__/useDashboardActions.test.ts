import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDashboardState } from '../hooks/useDashboardState';
import { useDashboardActions } from '../hooks/useDashboardActions';

const mockJobManagement = {
  getConfiguration: vi.fn(),
  getJobHistory: vi.fn(),
  getAllJobExecutions: vi.fn(),
  getJobStatistics: vi.fn(),
  getAllGeneratedImages: vi.fn(),
  getJobLogs: vi.fn(),
  jobStart: vi.fn(),
  jobStop: vi.fn(),
  jobForceStop: vi.fn(),
  deleteJobExecution: vi.fn(),
  rerunJobExecution: vi.fn(),
  deleteGeneratedImage: vi.fn(),
  updateQCStatus: vi.fn(),
  bulkDeleteImages: vi.fn(),
};

const mockGetSettings = vi.fn();
const mockGetImagesByQCStatus = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = {
    jobManagement: mockJobManagement,
    getSettings: mockGetSettings,
    generatedImages: { getImagesByQCStatus: mockGetImagesByQCStatus },
  };
  mockJobManagement.getConfiguration.mockResolvedValue({ success: true, settings: { parameters: {} } });
  mockJobManagement.getJobHistory.mockResolvedValue([]);
  mockJobManagement.getAllJobExecutions.mockResolvedValue({ success: true, executions: [] });
  mockJobManagement.getJobStatistics.mockResolvedValue({});
  mockJobManagement.getAllGeneratedImages.mockResolvedValue([]);
  mockGetImagesByQCStatus.mockResolvedValue({ images: [] });
  mockJobManagement.getJobLogs.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ settings: { advanced: { debugMode: false } } });
});

function useDashboardActionsWithState() {
  const state = useDashboardState();
  const actions = useDashboardActions({
    ...state,
    setJobStatus: state.setJobStatus,
    setJobHistory: state.setJobHistory,
    setStatistics: state.setStatistics,
    setGeneratedImages: state.setGeneratedImages,
    setLogs: state.setLogs,
    setError: state.setError,
    setIsLoading: state.setIsLoading,
    setSelectedImages: state.setSelectedImages,
    setExportJobId: state.setExportJobId,
    setShowSingleExportModal: state.setShowSingleExportModal,
    setJobConfiguration: state.setJobConfiguration,
  });
  return { state, actions };
}

describe('useDashboardActions', () => {
  it('loadJobHistory fetches and sets job history with normalized displayLabel', async () => {
    const jobs = [{ id: 'j1', status: 'completed', configurationName: 'Test' }];
    mockJobManagement.getAllJobExecutions.mockResolvedValue({ success: true, executions: jobs });

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.loadJobHistory();
    });

    expect(mockJobManagement.getAllJobExecutions).toHaveBeenCalledWith({ limit: 50 });
    expect(result.current.state.jobHistory).toHaveLength(1);
    expect(result.current.state.jobHistory[0].displayLabel).toBe('Test');
    expect(result.current.state.jobHistory[0].id).toBe('j1');
  });

  it('loadJobHistory normalizes rerun labels with (Rerun <last6>) and plain labels', async () => {
    const jobs = [
      { id: 'exec-abc123', status: 'completed', label: 'My Job (Rerun)', configurationName: 'My Job (Rerun)' },
      { id: 'j2', status: 'completed', configurationName: 'Other Job' }
    ];
    mockJobManagement.getAllJobExecutions.mockResolvedValue({ success: true, executions: jobs });

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.loadJobHistory();
    });

    expect(result.current.state.jobHistory).toHaveLength(2);
    expect(result.current.state.jobHistory[0].displayLabel).toBe('My Job (Rerun abc123)');
    expect(result.current.state.jobHistory[1].displayLabel).toBe('Other Job');
  });

  it('loadJobHistory uses job_<timestamp> fallback when no label but has startedAt (running rerun)', async () => {
    const jobs = [
      { id: 99, status: 'running', startedAt: '2026-02-01T14:30:00Z' }
    ];
    mockJobManagement.getAllJobExecutions.mockResolvedValue({ success: true, executions: jobs });

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.loadJobHistory();
    });

    expect(result.current.state.jobHistory).toHaveLength(1);
    expect(result.current.state.jobHistory[0].displayLabel).toMatch(/^job_\d{8}_\d{6}$/);
  });

  it('loadJobHistory sets error and empty array on failure', async () => {
    mockJobManagement.getAllJobExecutions.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.loadJobHistory();
    });

    expect(result.current.state.error).toBe('Failed to load job history');
    expect(result.current.state.jobHistory).toEqual([]);
  });

  it('loadStatistics calls getJobStatistics and sets statistics', async () => {
    const stats = { totalJobs: 5, completedJobs: 3, failedJobs: 1, averageExecutionTime: 120, totalImagesGenerated: 50, successRate: 90 };
    mockJobManagement.getJobStatistics.mockResolvedValue(stats);

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.loadStatistics();
    });

    expect(mockJobManagement.getJobStatistics).toHaveBeenCalled();
    expect(result.current.state.statistics).toEqual(stats);
  });

  it('loadGeneratedImages calls getImagesByQCStatus(approved) and sets generatedImages', async () => {
    const images = [
      { id: 'i1', qcStatus: 'approved' },
      { id: 'i2', qcStatus: 'approved' },
    ];
    mockGetImagesByQCStatus.mockResolvedValue({ images });

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.loadGeneratedImages();
    });

    expect(mockGetImagesByQCStatus).toHaveBeenCalledWith('approved', { limit: 50, offset: 0 });
    expect(result.current.state.generatedImages).toHaveLength(2);
  });

  it('handleStartJob calls getConfiguration, jobStart, then loadJobHistory and loadStatistics', async () => {
    mockJobManagement.jobStart.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.handleStartJob();
    });

    expect(mockJobManagement.getConfiguration).toHaveBeenCalled();
    expect(mockJobManagement.jobStart).toHaveBeenCalled();
    expect(mockJobManagement.getAllJobExecutions).toHaveBeenCalled();
    expect(mockJobManagement.getJobStatistics).toHaveBeenCalled();
  });

  it('handleStartJob sets error when getConfiguration fails', async () => {
    mockJobManagement.getConfiguration.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.handleStartJob();
    });

    expect(result.current.state.error).toBe('Failed to start job');
    expect(mockJobManagement.jobStart).not.toHaveBeenCalled();
  });

  it('handleStopJob calls jobStop then refresh', async () => {
    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.handleStopJob();
    });

    expect(mockJobManagement.jobStop).toHaveBeenCalled();
    expect(mockJobManagement.getAllJobExecutions).toHaveBeenCalled();
  });

  it('handleJobAction delete calls deleteJobExecution and refreshes', async () => {
    mockJobManagement.deleteJobExecution.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.handleJobAction('delete', 'job-1');
    });

    expect(mockJobManagement.deleteJobExecution).toHaveBeenCalledWith('job-1');
    expect(mockJobManagement.getAllJobExecutions).toHaveBeenCalled();
  });

  it('handleJobAction export sets exportJobId and showSingleExportModal', async () => {
    const { result } = renderHook(() => useDashboardActionsWithState());

    await act(async () => {
      await result.current.actions.handleJobAction('export', 'job-1');
    });

    expect(result.current.state.exportJobId).toBe('job-1');
    expect(result.current.state.showSingleExportModal).toBe(true);
  });

  it('handleJobAction view calls onOpenSingleJobView when provided', async () => {
    const onOpenSingleJobView = vi.fn();
    const { result } = renderHook(() => {
      const state = useDashboardState();
      const actions = useDashboardActions({
        ...state,
        setJobStatus: state.setJobStatus,
        setJobHistory: state.setJobHistory,
        setStatistics: state.setStatistics,
        setGeneratedImages: state.setGeneratedImages,
        setLogs: state.setLogs,
        setError: state.setError,
        setIsLoading: state.setIsLoading,
        setSelectedImages: state.setSelectedImages,
        setExportJobId: state.setExportJobId,
        setShowSingleExportModal: state.setShowSingleExportModal,
        setJobConfiguration: state.setJobConfiguration,
        onOpenSingleJobView,
      });
      return { actions };
    });

    await act(async () => {
      await result.current.actions.handleJobAction('view', 'job-1');
    });

    expect(onOpenSingleJobView).toHaveBeenCalledWith('job-1');
  });

  it('handleBulkAction delete calls bulkDeleteImages and clears selection', async () => {
    mockJobManagement.bulkDeleteImages.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDashboardActionsWithState());

    act(() => {
      result.current.state.setSelectedImages(new Set(['img-1']));
    });

    await act(async () => {
      await result.current.actions.handleBulkAction('delete', ['img-1']);
    });

    expect(mockJobManagement.bulkDeleteImages).toHaveBeenCalledWith(['img-1']);
    expect(result.current.state.selectedImages.size).toBe(0);
  });
});
