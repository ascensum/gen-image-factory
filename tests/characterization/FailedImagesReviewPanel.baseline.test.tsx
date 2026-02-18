import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import FailedImagesReviewPanel from '../../src/renderer/components/Dashboard/FailedImagesReviewPanel';

// Mock Electron API
const mockElectronAPI = {
  getSettings: vi.fn(),
  getRetryQueueStatus: vi.fn(),
  retryFailedImagesBatch: vi.fn(),
  onRetryProgress: vi.fn(),
  onRetryCompleted: vi.fn(),
  onRetryError: vi.fn(),
  onRetryQueueUpdated: vi.fn(),
  onRetryStatusUpdated: vi.fn(),
  removeRetryProgress: vi.fn(),
  removeRetryCompleted: vi.fn(),
  removeRetryError: vi.fn(),
  removeRetryQueueUpdated: vi.fn(),
  removeRetryStatusUpdated: vi.fn(),
  refreshProtocolRoots: vi.fn(),
  generatedImages: {
    getImagesByQCStatus: vi.fn(),
    updateQCStatus: vi.fn(),
    deleteGeneratedImage: vi.fn(),
    manualApproveImage: vi.fn(),
  },
  jobManagement: {
    getAllJobExecutions: vi.fn(),
  },
};

// @ts-ignore
window.electronAPI = mockElectronAPI;

describe('FailedImagesReviewPanel Characterization Baseline', () => {
  const mockImages = [
    { id: '1', executionId: 'job-1', generationPrompt: 'Prompt A', qcStatus: 'qc_failed', qcReason: 'Reason A', createdAt: new Date('2026-02-01T10:00:00Z') },
    { id: '2', executionId: 'job-2', generationPrompt: 'Prompt B', qcStatus: 'qc_failed', qcReason: 'Reason B', createdAt: new Date('2026-02-01T11:00:00Z') }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default implementations
    mockElectronAPI.getRetryQueueStatus.mockResolvedValue({
      success: true,
      queueStatus: {
        isProcessing: false,
        queueLength: 0,
        pendingJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        failedJobs: 0
      }
    });
    mockElectronAPI.generatedImages.getImagesByQCStatus.mockResolvedValue({ success: true, images: [] });
    // Specific status mock
    mockElectronAPI.generatedImages.getImagesByQCStatus.mockImplementation((status: string) => {
      if (status === 'qc_failed') return Promise.resolve({ success: true, images: mockImages });
      if (status === 'approved') return Promise.resolve({ success: true, images: [] });
      return Promise.resolve({ success: true, images: [] });
    });
    mockElectronAPI.jobManagement.getAllJobExecutions.mockResolvedValue({ success: true, executions: [
      { id: 'job-1', label: 'Job Alpha' },
      { id: 'job-2', label: 'Job Beta' }
    ]});
  });

  afterEach(() => {
    cleanup();
  });

  it('baselines initial render and image loading', async () => {
    render(<FailedImagesReviewPanel onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Failed Images Review')).toBeInTheDocument();
    });

    // Check tabs counts - find the specific button for "Failed" tab exactly
    const failedTab = screen.getByRole('button', { name: /^Failed 2$/i });
    expect(failedTab).toBeInTheDocument();

    // Check images rendered in grid
    expect(screen.getByText('Prompt A')).toBeInTheDocument();
    expect(screen.getByText('Prompt B')).toBeInTheDocument();
  });

  it('baselines tab switching behavior', async () => {
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Prompt A')).toBeInTheDocument());

    const retryPendingTab = screen.getByRole('button', { name: /Retry Pending 0/i });
    fireEvent.click(retryPendingTab);

    await waitFor(() => {
      expect(screen.getByText(/No Retry Pending/i)).toBeInTheDocument();
    });

    const failedTab = screen.getByRole('button', { name: /^Failed 2$/i });
    fireEvent.click(failedTab);
    expect(screen.getByText('Prompt A')).toBeInTheDocument();
  });

  it('baselines search and filtering', async () => {
    const user = userEvent.setup();
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Prompt A')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search images...');
    await user.type(searchInput, 'Prompt A');

    await waitFor(() => {
      expect(screen.getByText('Prompt A')).toBeInTheDocument();
      expect(screen.queryByText('Prompt B')).not.toBeInTheDocument();
    });
  });

  it('baselines sorting behavior', async () => {
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Prompt A')).toBeInTheDocument());

    // Newest first is default. Prompt B (11:00) > Prompt A (10:00)
    const cardB = screen.getByTestId('failed-image-card-2');
    const cardA = screen.getByTestId('failed-image-card-1');
    
    // Sort select
    const sortSelect = screen.getByRole('combobox');
    fireEvent.change(sortSelect, { target: { value: 'oldest' } });
    
    await waitFor(() => {
      const images = screen.getAllByTestId(/failed-image-card-/);
      expect(images[0]).toHaveAttribute('data-testid', 'failed-image-card-1');
    });
  });

  it('baselines selection and bulk actions', async () => {
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Prompt A')).toBeInTheDocument());

    // Find the Select All checkbox by its label text neighbor
    const selectAllSpan = screen.getByText(/Select All/i);
    const selectAllCheckbox = within(selectAllSpan.parentElement!).getByRole('checkbox');
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText(/Select All \(2\/2\)/i)).toBeInTheDocument();

    const approveBulkBtn = screen.getByRole('button', { name: /Approve Selected/i });
    mockElectronAPI.generatedImages.manualApproveImage.mockResolvedValue({ success: true });
    fireEvent.click(approveBulkBtn);

    await waitFor(() => {
      expect(mockElectronAPI.generatedImages.manualApproveImage).toHaveBeenCalledTimes(2);
    });
  });

  it('baselines individual image actions', async () => {
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Prompt A')).toBeInTheDocument());

    const card1 = screen.getByTestId('failed-image-card-1');
    const approveBtn = within(card1).getByRole('button', { name: /Approve/i });
    
    mockElectronAPI.generatedImages.manualApproveImage.mockResolvedValue({ success: true });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockElectronAPI.generatedImages.manualApproveImage).toHaveBeenCalledWith('1');
    });
  });

  it('baselines retry workflow with modal', async () => {
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Prompt A')).toBeInTheDocument());

    // Select image 1
    const checkbox1 = screen.getByTestId('select-1');
    fireEvent.click(checkbox1);

    // Click Retry Selected
    const retryBtn = screen.getByRole('button', { name: /Retry Selected/i });
    fireEvent.click(retryBtn);

    // Should open modal
    await screen.findByText(/Retry Processing Settings/i);
    
    const confirmRetryBtn = screen.getByRole('button', { name: /Retry with Original Settings/i });
    mockElectronAPI.retryFailedImagesBatch.mockResolvedValue({ success: true });
    fireEvent.click(confirmRetryBtn);

    await waitFor(() => {
      expect(mockElectronAPI.retryFailedImagesBatch).toHaveBeenCalled();
    });
  });

  it('baselines retry queue status bar', async () => {
    mockElectronAPI.getRetryQueueStatus.mockResolvedValue({
      success: true,
      queueStatus: {
        isProcessing: true,
        queueLength: 5,
        pendingJobs: 3,
        processingJobs: 1,
        completedJobs: 1,
        failedJobs: 0,
        currentJob: { id: 'retry-job-99', status: 'processing', imageCount: 1, settings: 'original', metadata: true, createdAt: new Date() }
      }
    });

    render(<FailedImagesReviewPanel onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Retry Queue Status')).toBeInTheDocument();
      expect(screen.getByText('Currently Processing')).toBeInTheDocument();
      // Use more specific matchers for counts
      expect(screen.getByText('3')).toBeInTheDocument(); // pending
      expect(screen.getByText('1', { selector: '.text-blue-600' })).toBeInTheDocument(); // processing
    });
  });
});
