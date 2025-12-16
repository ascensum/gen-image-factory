import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JobManagementPanel from '../JobManagementPanel';

function makeElectronApi(overrides: Partial<any> = {}) {
  const base: any = {
    jobManagement: {
      getJobExecutionsWithFilters: vi.fn(),
      getJobStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
      getJobExecutionsCount: vi.fn().mockResolvedValue({ count: 0 }),
      getBulkRerunQueueSize: vi.fn().mockResolvedValue({ count: 0 }),
      bulkRerunJobExecutions: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
      deleteJobExecution: vi.fn().mockResolvedValue({ success: true }),
      rerunJobExecution: vi.fn().mockResolvedValue({ success: true }),
      exportJobToExcel: vi.fn().mockResolvedValue({ success: true, filePath: '/tmp/x.xlsx' }),
      bulkExportJobExecutions: vi.fn().mockResolvedValue({ success: true, zipPath: '/tmp/x.zip' }),
    },
    revealInFolder: vi.fn().mockResolvedValue(true),
  };

  return {
    ...base,
    ...overrides,
    jobManagement: {
      ...base.jobManagement,
      ...(overrides as any).jobManagement,
    },
  };
}

describe('JobManagementPanel workflows (high-value)', () => {
  const job = {
    id: 1,
    label: 'My Job',
    status: 'completed',
    startedAt: '2024-01-01T10:00:00Z',
    completedAt: '2024-01-01T10:01:00Z',
    totalImages: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Keep long-lived intervals from firing during tests
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((cb: any, _ms?: any) => {
      // don't schedule
      void cb;
      return 0 as any;
    }) as any);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(((id: any) => {
      void id;
    }) as any);

    (globalThis as any).alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads jobs and renders stats + table rows', async () => {
    const electronAPI = makeElectronApi({
      jobManagement: {
        getJobExecutionsWithFilters: vi.fn().mockResolvedValue({ success: true, executions: [job], count: 1 }),
      },
    });

    Object.defineProperty(window, 'electronAPI', { value: electronAPI, writable: true });

    const onOpenSingleJob = vi.fn();
    const onBack = vi.fn();

    render(<JobManagementPanel onOpenSingleJob={onOpenSingleJob} onBack={onBack} />);

    expect(screen.getByText('Job Management')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('My Job')).toBeInTheDocument();
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    });

    // Stats should render with totals
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);

    expect(electronAPI.jobManagement.getJobExecutionsWithFilters).toHaveBeenCalled();
  });

  it('opens a single job when view action is clicked', async () => {
    const electronAPI = makeElectronApi({
      jobManagement: {
        getJobExecutionsWithFilters: vi.fn().mockResolvedValue({ success: true, executions: [job], count: 1 }),
      },
    });
    Object.defineProperty(window, 'electronAPI', { value: electronAPI, writable: true });

    const onOpenSingleJob = vi.fn();
    render(<JobManagementPanel onOpenSingleJob={onOpenSingleJob} onBack={() => {}} />);

    await screen.findByText('My Job');

    const viewBtn = screen.getByTitle('View Job Details');
    fireEvent.click(viewBtn);

    expect(onOpenSingleJob).toHaveBeenCalledWith(1);
  });

  it('selects a job and triggers bulk rerun (clears selection)', async () => {
    const getJobExecutionsWithFilters = vi
      .fn()
      .mockResolvedValueOnce({ success: true, executions: [job], count: 1 })
      .mockResolvedValue({ success: true, executions: [job], count: 1 });

    const electronAPI = makeElectronApi({
      jobManagement: {
        getJobExecutionsWithFilters,
        bulkRerunJobExecutions: vi.fn().mockResolvedValue({ success: true, message: 'started' }),
      },
    });

    Object.defineProperty(window, 'electronAPI', { value: electronAPI, writable: true });

    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);

    await screen.findByText('My Job');

    // Select first row checkbox (index 0 is header select-all)
    const rowCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(rowCheckbox);

    expect(await screen.findByText(/1 selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rerun Selected'));

    await waitFor(() => {
      expect(electronAPI.jobManagement.bulkRerunJobExecutions).toHaveBeenCalledWith([1]);
    });

    // Selection should clear after successful bulk rerun
    await waitFor(() => {
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });
  });

  it('deletes a job from row action and refreshes list', async () => {
    const getJobExecutionsWithFilters = vi
      .fn()
      .mockResolvedValueOnce({ success: true, executions: [job], count: 1 })
      .mockResolvedValueOnce({ success: true, executions: [], count: 0 });

    const deleteJobExecution = vi.fn().mockResolvedValue({ success: true });

    const electronAPI = makeElectronApi({
      jobManagement: {
        getJobExecutionsWithFilters,
        deleteJobExecution,
      },
    });

    Object.defineProperty(window, 'electronAPI', { value: electronAPI, writable: true });

    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);

    await screen.findByText('My Job');

    fireEvent.click(screen.getByTitle('Delete Job'));

    await waitFor(() => {
      expect(deleteJobExecution).toHaveBeenCalledWith(1);
      expect(getJobExecutionsWithFilters).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error state when load fails and Retry works', async () => {
    const getJobExecutionsWithFilters = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'boom' })
      .mockResolvedValueOnce({ success: true, executions: [job], count: 1 });

    const electronAPI = makeElectronApi({
      jobManagement: {
        getJobExecutionsWithFilters,
      },
    });

    Object.defineProperty(window, 'electronAPI', { value: electronAPI, writable: true });

    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
      expect(screen.getByText('boom')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await screen.findByText('My Job');
  });
});
