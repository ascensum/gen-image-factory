/**
 * Story 3.4 Phase 5b: Characterization baseline for decomposed SingleJobView.
 * Same style as JobManagementPanel.baseline.test.tsx – initial render, tabs, actions, modals.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SingleJobView from '../../src/renderer/components/Jobs/SingleJobView';

const mockJob = {
  id: 1,
  label: 'Test Job Alpha',
  status: 'completed',
  startedAt: '2026-02-01T10:00:00Z',
  completedAt: '2026-02-01T10:05:00Z',
  totalImages: 5,
  successfulImages: 4,
  failedImages: 1,
  configurationId: 'config-1',
};

const mockImages = [
  { id: 'img-1', executionId: 1, qcStatus: 'approved', finalImagePath: '/out/1.png', generationPrompt: 'A test', createdAt: '2026-02-01T10:01:00Z' },
  { id: 'img-2', executionId: 1, qcStatus: 'approved', finalImagePath: '/out/2.png', generationPrompt: 'B test', createdAt: '2026-02-01T10:02:00Z' },
];

const mockElectronAPI = {
  jobManagement: {
    getJobExecution: vi.fn(),
    getJobLogs: vi.fn(),
    deleteJobExecution: vi.fn(),
    rerunJobExecution: vi.fn(),
  },
  generatedImages: {
    getGeneratedImagesByExecution: vi.fn(),
  },
  getJobConfigurationById: vi.fn(),
  updateJobConfiguration: vi.fn(),
  exportJobToExcel: vi.fn(),
  calculateJobExecutionStatistics: vi.fn(),
};

// @ts-ignore
window.electronAPI = mockElectronAPI;

describe('SingleJobView Characterization Baseline', () => {
  const onBack = vi.fn();
  const onRerun = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: mockJob,
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
      images: mockImages,
    });
    mockElectronAPI.jobManagement.getJobLogs.mockResolvedValue([]);
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({
      success: true,
      configuration: { id: 'config-1', settings: {} },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('baselines initial loading then content', async () => {
    render(<SingleJobView jobId={1} onBack={onBack} onRerun={onRerun} onDelete={onDelete} />);

    expect(screen.getByRole('main', { name: /loading job details/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Job #1/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Test Job Alpha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('baselines tab navigation', async () => {
    render(<SingleJobView jobId={1} onBack={onBack} onRerun={onRerun} onDelete={onDelete} />);

    await screen.findByText('Test Job Alpha');

    const overviewTab = screen.getByRole('button', { name: /overview/i });
    const imagesTab = screen.getByRole('button', { name: /images/i });

    expect(overviewTab).toBeInTheDocument();
    expect(imagesTab).toBeInTheDocument();

    fireEvent.click(imagesTab);
    await waitFor(() => {
      expect(screen.getByLabelText(/filter images/i)).toBeInTheDocument();
    });

    fireEvent.click(overviewTab);
    await waitFor(() => {
      expect(screen.getByText('Job ID')).toBeInTheDocument();
    });
  });

  it('baselines back button', async () => {
    render(<SingleJobView jobId={1} onBack={onBack} onRerun={onRerun} onDelete={onDelete} />);

    await screen.findByText('Test Job Alpha');

    const backBtn = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backBtn);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('baselines export and delete buttons open dialogs', async () => {
    render(<SingleJobView jobId={1} onBack={onBack} onRerun={onRerun} onDelete={onDelete} />);

    await screen.findByText('Test Job Alpha');

    const exportBtn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText(/Export Job/i)).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
      expect(screen.getByText(/Delete Permanently/i)).toBeInTheDocument();
    });
  });

  it('baselines rerun button calls onRerun', async () => {
    render(<SingleJobView jobId={1} onBack={onBack} onRerun={onRerun} onDelete={onDelete} />);

    await screen.findByText('Test Job Alpha');

    const rerunBtn = screen.getByRole('button', { name: /rerun job/i });
    fireEvent.click(rerunBtn);

    expect(onRerun).toHaveBeenCalledWith(1);
  });

  it('baselines error state when job load fails', async () => {
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: false,
      error: 'Job not found',
    });

    render(<SingleJobView jobId={999} onBack={onBack} onRerun={onRerun} onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Job/i)).toBeInTheDocument();
      expect(screen.getByText(/Job not found/i)).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });
});
