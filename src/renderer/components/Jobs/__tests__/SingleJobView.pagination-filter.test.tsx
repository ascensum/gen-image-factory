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

const defaultProps = { jobId: 1, onBack: vi.fn(), onRerun: vi.fn(), onDelete: vi.fn() };

describe('SingleJobView pagination & filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refetches images when refreshed', async () => {
    const page1 = Array.from({ length: 20 }).map((_, i) => ({
      id: String(i + 1),
      executionId: '1',
      generationPrompt: `img-${i + 1}`,
      finalImagePath: `/path/${i + 1}.jpg`,
      qcStatus: 'passed',
      createdAt: new Date().toISOString(),
      metadata: {},
    }));
    const page2 = [
      {
        id: '21',
        executionId: '1',
        generationPrompt: 'img-21',
        finalImagePath: '/path/21.jpg',
        qcStatus: 'passed',
        createdAt: new Date().toISOString(),
        metadata: {},
      },
    ];

    const api = renderWithAPI({
      jobManagement: {
        ...baseElectronAPI().jobManagement,
        getJobExecution: vi.fn().mockResolvedValue({
          success: true,
          execution: {
            id: 1,
            status: 'completed',
            totalImages: 21,
            successfulImages: 21,
            failedImages: 0,
            createdAt: '2024-01-01T00:00:00Z',
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:05:00Z',
            configurationId: 'cfg-1',
            label: 'Job with pages',
          },
        }),
      },
      generatedImages: {
        getGeneratedImagesByExecution: vi
          .fn()
          .mockResolvedValueOnce({ success: true, images: page1 })
          .mockResolvedValueOnce({ success: true, images: page2 }),
      },
    });

    render(<SingleJobView {...defaultProps} />);

    await waitFor(() => screen.getByText('Job with pages'));
    fireEvent.click(screen.getByText('Images'));

    // initial fetch
    await waitFor(() => {
      expect(api.generatedImages.getGeneratedImagesByExecution).toHaveBeenCalledTimes(1);
    });

    // trigger refresh to fetch again
    const refreshBtn = screen.getByTitle('Refresh job data');
    fireEvent.click(refreshBtn);

    // ensure second fetch triggered
    await waitFor(() => {
      expect(api.generatedImages.getGeneratedImagesByExecution).toHaveBeenCalledTimes(2);
    });
  });

  it('applies QC status filter to image list', async () => {
    const images = [
      { id: '1', executionId: '1', generationPrompt: 'ok', finalImagePath: '/path/1.jpg', qcStatus: 'passed', createdAt: new Date().toISOString(), metadata: {} },
      { id: '2', executionId: '1', generationPrompt: 'bad', finalImagePath: '/path/2.jpg', qcStatus: 'qc_failed', createdAt: new Date().toISOString(), metadata: {} },
    ];

    const api = renderWithAPI({
      jobManagement: {
        ...baseElectronAPI().jobManagement,
        getJobExecution: vi.fn().mockResolvedValue({
          success: true,
          execution: {
            id: 1,
            status: 'completed',
            totalImages: 2,
            successfulImages: 1,
            failedImages: 1,
            createdAt: '2024-01-01T00:00:00Z',
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:05:00Z',
            configurationId: 'cfg-1',
            label: 'Job filtered',
          },
        }),
      },
      generatedImages: {
        getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images }),
      },
    });

    render(<SingleJobView {...defaultProps} />);
    await waitFor(() => screen.getByText('Job filtered'));
    fireEvent.click(screen.getByText('Images'));

    await waitFor(() => {
      expect(api.generatedImages.getGeneratedImagesByExecution).toHaveBeenCalledTimes(1);
    });

    // apply QC failed filter via select
    const qcSelect = screen.getByRole('combobox');
    fireEvent.change(qcSelect, { target: { value: 'failed_qc' } });
    expect((qcSelect as HTMLSelectElement).value).toBe('failed_qc');
  });
});
