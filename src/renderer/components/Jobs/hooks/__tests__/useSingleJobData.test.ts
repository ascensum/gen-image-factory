/**
 * Story 3.4 Phase 5b: Unit tests for useSingleJobData hook.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSingleJobData } from '../useSingleJobData';

const mockExecution = {
  id: 1,
  label: 'Test Job',
  status: 'completed',
  startedAt: '2026-02-01T10:00:00Z',
  completedAt: '2026-02-01T10:05:00Z',
  configurationId: 'config-1',
  totalImages: 5,
  successfulImages: 4,
  failedImages: 1,
};

const mockElectronAPI = {
  jobManagement: {
    getJobExecution: vi.fn(),
    getJobLogs: vi.fn(),
    getJobStatus: vi.fn(),
  },
  generatedImages: {
    getGeneratedImagesByExecution: vi.fn(),
  },
  getJobConfigurationById: vi.fn(),
  calculateJobExecutionStatistics: vi.fn(),
};

(global as any).window = global.window || {};
(global as any).window.electronAPI = mockElectronAPI;

describe('useSingleJobData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: mockExecution,
    });
    mockElectronAPI.calculateJobExecutionStatistics.mockResolvedValue({
      success: true,
      statistics: {
        totalImages: 5,
        successfulImages: 4,
        failedImages: 1,
        approvedImages: 4,
        qcFailedImages: 0,
      },
    });
    mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({
      success: true,
      images: [],
    });
    mockElectronAPI.jobManagement.getJobLogs.mockResolvedValue([]);
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({
      success: true,
      configuration: { id: 'config-1', settings: {} },
    });
  });

  it('starts with loading true and job null', () => {
    mockElectronAPI.jobManagement.getJobExecution.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useSingleJobData(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.job).toBe(null);
  });

  it('loads job and sets job after getJobExecution success', async () => {
    const { result } = renderHook(() => useSingleJobData(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.job).not.toBe(null);
    expect(result.current.job?.id).toBe(1);
    expect(result.current.job?.label).toBe('Test Job');
    expect(result.current.error).toBe(null);
    expect(mockElectronAPI.jobManagement.getJobExecution).toHaveBeenCalledWith(1);
  });

  it('sets error when getJobExecution fails', async () => {
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: false,
      error: 'Not found',
    });

    const { result } = renderHook(() => useSingleJobData(999));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.job).toBe(null);
    expect(result.current.error).toBe('Not found');
  });

  it('getDisplayLabel returns job label when set', async () => {
    const { result } = renderHook(() => useSingleJobData(1));

    await waitFor(() => {
      expect(result.current.job).not.toBe(null);
    });

    expect(result.current.getDisplayLabel()).toBe('Test Job');
  });

  it('loadJobData can be called to refresh', async () => {
    const { result } = renderHook(() => useSingleJobData(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: { ...mockExecution, label: 'Updated Label' },
    });

    await act(async () => {
      await result.current.loadJobData();
    });

    expect(result.current.job?.label).toBe('Updated Label');
  });
});
