import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SingleJobView from '../SingleJobView';

const mockElectronAPI = {
  jobManagement: {
    getJobExecution: vi.fn(),
    getJobLogs: vi.fn().mockResolvedValue([])
  },
  generatedImages: {
    getGeneratedImagesByExecution: vi.fn()
  },
  calculateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true, statistics: { totalImages: 0, successfulImages: 0, failedImages: 0, approvedImages: 0, qcFailedImages: 0 } }),
  getJobConfigurationById: vi.fn()
};

Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });

const defaultProps = {
  jobId: 1,
  onBack: vi.fn(),
  onExport: vi.fn(),
  onRerun: vi.fn(),
  onDelete: vi.fn()
};

describe('SingleJobView - Delete refresh (focused)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: {
        id: 1,
        label: 'Delete Test Job',
        status: 'completed',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:05:00Z',
        imageCount: 2,
        configurationId: 'cfg-1'
      }
    });
    mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({ success: true, images: [] });
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({ success: true, configuration: { settings: {} } });
  });

  it('deletes immediately and closes the confirmation modal', async () => {
    render(<SingleJobView {...defaultProps} />);

    await waitFor(() => expect(mockElectronAPI.jobManagement.getJobExecution).toHaveBeenCalled());

    // open delete modal
    const deleteBtn = screen.getByRole('button', { name: 'Delete Job' });
    fireEvent.click(deleteBtn);

    // modal appears
    expect(await screen.findByText('Confirm Deletion')).toBeInTheDocument();

    // confirm deletion
    const confirm = screen.getByRole('button', { name: 'Delete Permanently' });
    fireEvent.click(confirm);

    // callback called and modal closed
    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument());
  });
});
