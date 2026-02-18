import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import JobManagementPanel from '../../src/renderer/components/Jobs/JobManagementPanel';

// Mock Electron API
const mockElectronAPI = {
  jobManagement: {
    getJobExecutionsWithFilters: vi.fn(),
    getJobStatus: vi.fn(),
    getJobExecutionsCount: vi.fn(),
    getBulkRerunQueueSize: vi.fn(),
    bulkRerunJobExecutions: vi.fn(),
    deleteJobExecution: vi.fn(),
    rerunJobExecution: vi.fn(),
    exportJobToExcel: vi.fn(),
    bulkExportJobExecutions: vi.fn(),
  },
  revealInFolder: vi.fn(),
};

// @ts-ignore
window.electronAPI = mockElectronAPI;

describe('JobManagementPanel Characterization Baseline', () => {
  const mockJobs = [
    { id: '1', label: 'Job Alpha', status: 'completed', startedAt: '2026-02-01T10:00:00Z', completedAt: '2026-02-01T10:05:00Z', totalImages: 5 },
    { id: '2', label: 'Job Beta', status: 'failed', startedAt: '2026-02-01T11:00:00Z', completedAt: '2026-02-01T11:10:00Z', totalImages: 3 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default implementations
    mockElectronAPI.jobManagement.getJobExecutionsWithFilters.mockResolvedValue({
      success: true,
      executions: mockJobs,
      count: 2
    });
    mockElectronAPI.jobManagement.getJobStatus.mockResolvedValue({ state: 'idle' });
    mockElectronAPI.jobManagement.getJobExecutionsCount.mockImplementation(({ status }: any) => {
      if (status === 'all') return Promise.resolve({ count: 2 });
      if (status === 'completed') return Promise.resolve({ count: 1 });
      if (status === 'failed') return Promise.resolve({ count: 1 });
      return Promise.resolve({ count: 0 });
    });
    mockElectronAPI.jobManagement.getBulkRerunQueueSize.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    cleanup();
  });

  it('baselines initial render and statistics', async () => {
    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Job Management')).toBeInTheDocument();
    });

    // Check stats cards using more specific text or containers
    const totalJobsCard = screen.getAllByText('Total Jobs').find(el => el.closest('.stats-card'));
    expect(within(totalJobsCard!.closest('.stats-card')!).getByText('2')).toBeInTheDocument();
    
    const completedCard = screen.getAllByText('Completed').find(el => el.closest('.stats-card'));
    expect(within(completedCard!.closest('.stats-card')!).getByText('1')).toBeInTheDocument();

    // Check table rows
    expect(screen.getByText('Job Alpha')).toBeInTheDocument();
    expect(screen.getByText('Job Beta')).toBeInTheDocument();
  });

  it('baselines filtering behavior', async () => {
    const user = userEvent.setup();
    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);

    await screen.findByText('Job Alpha');

    // Search filter
    const searchInput = screen.getByPlaceholderText('Search jobs...');
    await user.type(searchInput, 'Alpha');

    await waitFor(() => {
      expect(screen.getByText('Job Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Job Beta')).not.toBeInTheDocument();
    });

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /Clear all/i });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('Job Beta')).toBeInTheDocument();
    });
  });

  it('baselines sorting behavior', async () => {
    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);
    await screen.findByText('Job Alpha');

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Job Beta');
    expect(rows[2]).toHaveTextContent('Job Alpha');
  });

  it('baselines selection and bulk actions', async () => {
    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);
    await screen.findByText('Job Alpha');

    // Find checkbox specifically for Job Alpha
    const alphaRow = screen.getByText('Job Alpha').closest('tr');
    const alphaCheckbox = within(alphaRow!).getByRole('checkbox');
    fireEvent.click(alphaCheckbox);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });

    const rerunSelectedBtn = screen.getByRole('button', { name: /Rerun Selected/i });
    mockElectronAPI.jobManagement.bulkRerunJobExecutions.mockResolvedValue({ success: true });
    fireEvent.click(rerunSelectedBtn);

    await waitFor(() => {
      expect(mockElectronAPI.jobManagement.bulkRerunJobExecutions).toHaveBeenCalledWith(['1']);
    });
  });

  it('baselines individual job actions', async () => {
    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);
    await screen.findByText('Job Alpha');

    const alphaRow = screen.getByText('Job Alpha').closest('tr');
    const rerunBtn = within(alphaRow!).getByTitle('Rerun Job');
    
    mockElectronAPI.jobManagement.rerunJobExecution.mockResolvedValue({ success: true });
    fireEvent.click(rerunBtn);

    await waitFor(() => {
      expect(mockElectronAPI.jobManagement.rerunJobExecution).toHaveBeenCalledWith('1');
    });
  });

  it('baselines pagination controls', async () => {
    const manyJobs = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1), label: `Job ${i + 1}`, status: 'completed', startedAt: new Date(2026, 1, 1, 10, i).toISOString()
    }));
    mockElectronAPI.jobManagement.getJobExecutionsWithFilters.mockResolvedValue({
      success: true,
      executions: manyJobs,
      count: 30
    });

    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);

    await screen.findByText('Job 30');
    
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    const nextPageBtn = buttons.find(btn => btn.innerHTML.includes('M9 5l7 7-7 7'));
    fireEvent.click(nextPageBtn!);

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument();
      expect(screen.getByText('Job 1')).toBeInTheDocument();
    });
  });

  it('baselines keyboard shortcuts', async () => {
    render(<JobManagementPanel onOpenSingleJob={() => {}} onBack={() => {}} />);
    await screen.findByText('Job Alpha');

    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });
  });
});