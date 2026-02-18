import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDashboardState } from '../hooks/useDashboardState';
import { useDashboardActions } from '../hooks/useDashboardActions';
import { useDashboardPolling } from '../hooks/useDashboardPolling';

const mockJobManagement = {
  getJobStatus: vi.fn(),
  getJobHistory: vi.fn(),
  getAllJobExecutions: vi.fn(),
  getJobStatistics: vi.fn(),
  getAllGeneratedImages: vi.fn(),
  getJobLogs: vi.fn(),
  getConfiguration: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  (window as any).electronAPI = {
    jobManagement: mockJobManagement,
    getSettings: vi.fn().mockResolvedValue({ settings: { advanced: { debugMode: false } } }),
  };
  mockJobManagement.getJobStatus.mockResolvedValue({ state: 'idle', progress: 0, currentStep: 1, totalSteps: 2 });
  mockJobManagement.getJobHistory.mockResolvedValue([]);
  mockJobManagement.getAllJobExecutions.mockResolvedValue({ success: true, executions: [] });
  mockJobManagement.getJobStatistics.mockResolvedValue({});
  mockJobManagement.getAllGeneratedImages.mockResolvedValue([]);
  mockJobManagement.getJobLogs.mockResolvedValue([]);
  mockJobManagement.getConfiguration.mockResolvedValue({ success: true, settings: {} });
});

function useDashboardWithPolling() {
  const state = useDashboardState();
  const actions = useDashboardActions({
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
  useDashboardPolling({
    jobStatus: state.jobStatus,
    jobHistory: state.jobHistory,
    setJobStatus: state.setJobStatus,
    loadJobHistory: actions.loadJobHistory,
    loadStatistics: actions.loadStatistics,
    loadGeneratedImages: actions.loadGeneratedImages,
    loadLogs: actions.loadLogs,
    loadJobConfiguration: actions.loadJobConfiguration,
  });
  return { state, actions };
}

describe('useDashboardPolling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads initial data on mount (job history, statistics, images, logs, config)', async () => {
    renderHook(() => useDashboardWithPolling());

    await act(async () => {
      await vi.advanceTimersByTime(0);
    });

    expect(mockJobManagement.getAllJobExecutions).toHaveBeenCalled();
    expect(mockJobManagement.getJobStatistics).toHaveBeenCalled();
    expect(mockJobManagement.getAllGeneratedImages).toHaveBeenCalled();
    expect(mockJobManagement.getJobLogs).toHaveBeenCalled();
    expect(mockJobManagement.getConfiguration).toHaveBeenCalled();
  });

  it('polls getJobStatus on an interval', async () => {
    mockJobManagement.getJobStatus.mockResolvedValue({ state: 'idle', progress: 0 });

    renderHook(() => useDashboardWithPolling());

    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    const callsAfterStart = mockJobManagement.getJobStatus.mock.calls.length;
    expect(callsAfterStart).toBeGreaterThanOrEqual(1);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mockJobManagement.getJobStatus.mock.calls.length).toBeGreaterThanOrEqual(callsAfterStart + 1);
  });

  it('normalizes state "error" to "failed"', async () => {
    mockJobManagement.getJobStatus.mockResolvedValue({ state: 'error', progress: 0 });

    const { result } = renderHook(() => useDashboardWithPolling());

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.state.jobStatus.state).toBe('failed');
  });

  it('when state is running, polls loadLogs and loadGeneratedImages on intervals', async () => {
    mockJobManagement.getJobStatus.mockResolvedValue({ state: 'running', progress: 50, currentStep: 2, totalSteps: 2 });

    const { result } = renderHook(() => useDashboardWithPolling());

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });

    expect(mockJobManagement.getJobLogs).toHaveBeenCalled();
    expect(mockJobManagement.getAllGeneratedImages).toHaveBeenCalled();
  });
});
