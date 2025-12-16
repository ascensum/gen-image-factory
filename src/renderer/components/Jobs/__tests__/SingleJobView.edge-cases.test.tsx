import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import SingleJobView from '../SingleJobView';

const baseElectronAPI = () => ({
  jobManagement: {
    getJobExecution: vi.fn(),
    getJobLogs: vi.fn().mockResolvedValue([]),
    renameJobExecution: vi.fn(),
  },
  generatedImages: {
    getGeneratedImagesByExecution: vi.fn(),
  },
  getJobConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
  updateJobConfiguration: vi.fn(),
  exportJobToExcel: vi.fn(),
});

const renderWithAPI = (overrides: Partial<ReturnType<typeof baseElectronAPI>> = {}) => {
  const api = { ...baseElectronAPI(), ...overrides };
  // @ts-expect-error
  window.electronAPI = api;
  return api;
};

describe('SingleJobView edge cases', () => {
  const defaultProps = { jobId: 1, onBack: vi.fn(), onRerun: vi.fn(), onDelete: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error state when job load fails', async () => {
    const api = renderWithAPI({
      jobManagement: {
        ...baseElectronAPI().jobManagement,
        getJobExecution: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
      },
    });

    render(<SingleJobView {...defaultProps} />);

    expect(await screen.findByLabelText('Job error')).toBeInTheDocument();
    expect(screen.getByText(/Error Loading Job/i)).toBeInTheDocument();
    expect(api.jobManagement.getJobExecution).toHaveBeenCalled();
  });

  it('shows not found state when job is missing', async () => {
    const api = renderWithAPI({
      jobManagement: {
        ...baseElectronAPI().jobManagement,
        getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: null }),
      },
    });

    render(<SingleJobView {...defaultProps} />);

    const fallbackText = await screen.findByText(/Job Not Found|Error Loading Job/i);
    expect(fallbackText).toBeInTheDocument();
    expect(api.jobManagement.getJobExecution).toHaveBeenCalled();
  });

  it('shows no images message when images list is empty', async () => {
    renderWithAPI({
      jobManagement: {
        ...baseElectronAPI().jobManagement,
        getJobExecution: vi.fn().mockResolvedValue({
          success: true,
          execution: {
            id: 1,
            status: 'completed',
            totalImages: 0,
            successfulImages: 0,
            failedImages: 0,
            createdAt: '2024-01-01T00:00:00Z',
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:05:00Z',
            configurationId: 'cfg-1',
            label: 'Empty Job',
          },
        }),
      },
      generatedImages: {
        getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }),
      },
    });

    render(<SingleJobView {...defaultProps} />);

    // Navigate to images tab to reveal message
    await waitFor(() => screen.getByText('Overview'));
    fireEvent.click(screen.getByText('Images'));

    expect(await screen.findByText(/No images found with current filter/i)).toBeInTheDocument();
  });
});
