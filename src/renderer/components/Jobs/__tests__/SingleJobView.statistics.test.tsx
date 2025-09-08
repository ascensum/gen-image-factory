import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
  calculateJobExecutionStatistics: vi.fn(),
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

describe('SingleJobView - Statistics (focused)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: {
        id: 1,
        label: 'Stats Job',
        status: 'completed',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:05:00Z',
        imageCount: 4,
        configurationId: 'cfg-1'
      }
    });
    mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({ success: true, images: [] });
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({ success: true, configuration: { settings: {} } });
    mockElectronAPI.calculateJobExecutionStatistics.mockResolvedValue({
      success: true,
      statistics: {
        totalImages: 4,
        successfulImages: 3,
        failedImages: 1,
        approvedImages: 2,
        qcFailedImages: 1
      }
    });
  });

  it('shows correct counts, duration and success rate with QC breakdown', async () => {
    render(<SingleJobView {...defaultProps} />);

    await waitFor(() => expect(mockElectronAPI.jobManagement.getJobExecution).toHaveBeenCalled());
    await waitFor(() => expect(mockElectronAPI.calculateJobExecutionStatistics).toHaveBeenCalledWith(1));

    // Overview labels
    expect(await screen.findByText('Total Images')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);

    expect(screen.getByText('Successful')).toBeInTheDocument();
    // one of the 3s on the page should be Successful count
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);

    const failedLabels = screen.getAllByText('Failed');
    const failedLabel = failedLabels.find(el => (el as HTMLElement).classList.contains('stats-label')) as HTMLElement;
    expect(failedLabel).toBeTruthy();
    const failedCard = failedLabel.closest('.stats-card') as HTMLElement;
    expect(failedCard.querySelector('.stats-value.failed')?.textContent?.trim()).toBe('1');

    // Duration based on 5 minutes window
    expect(screen.getByText(/5m/)).toBeInTheDocument();

    // Success rate = 3/4 = 75%
    expect(screen.getByText(/75% \(3\/4\)/)).toBeInTheDocument();

    // Breakdown (Approved vs QC Failed)
    const successLabel = screen.getAllByText('Successful').find(el => (el as HTMLElement).classList.contains('stats-label')) as HTMLElement;
    expect(successLabel).toBeTruthy();
    const successCard = successLabel.closest('.stats-card') as HTMLElement;
    expect(successCard.querySelector('.stats-value.success')?.textContent?.trim()).toBe('3');
    const approvedRow = Array.from(successCard.querySelectorAll('.breakdown-item .breakdown-label')).find(el => el.textContent?.includes('Approved:')) as HTMLElement;
    expect(approvedRow).toBeTruthy();
    const approvedValue = approvedRow.parentElement?.querySelector('.breakdown-value') as HTMLElement;
    expect(approvedValue.textContent?.trim()).toBe('2');
    const qcFailedRow = Array.from(successCard.querySelectorAll('.breakdown-item .breakdown-label')).find(el => el.textContent?.includes('QC Failed:')) as HTMLElement;
    expect(qcFailedRow).toBeTruthy();
    const qcFailedValue = qcFailedRow.parentElement?.querySelector('.breakdown-value') as HTMLElement;
    expect(qcFailedValue.textContent?.trim()).toBe('1');
  });
});


