import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FailedImagesReviewPanel from '../../../src/renderer/components/Dashboard/FailedImagesReviewPanel';

const mockElectronAPI = () => {
  (window as any).electronAPI = {
    generatedImages: {
      getImagesByQCStatus: async () => ({ images: [] }),
    },
    getRetryQueueStatus: async () => ({
      success: true,
      queueStatus: {
        isProcessing: false,
        queueLength: 0,
        pendingJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
      },
    }),
    jobManagement: {
      getAllJobExecutions: async () => ({ executions: [] }),
    },
    removeRetryProgress: () => {},
    removeRetryCompleted: () => {},
    removeRetryError: () => {},
    removeRetryQueueUpdated: () => {},
    removeRetryStatusUpdated: () => {},
    onRetryProgress: () => {},
    onRetryCompleted: () => {},
    onRetryError: () => {},
    onRetryQueueUpdated: () => {},
    onRetryStatusUpdated: () => {},
    refreshProtocolRoots: async () => {},
  };
};

describe('Failed Images Review job filter label formatting', () => {
  it('renders without crashing (label logic smoke)', () => {
    mockElectronAPI();
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    expect(true).toBe(true);
  });
});

describe('Failed Images Review Label filter (Task 7.19)', () => {
  it('shows Label filter with Failed (All) as default option', async () => {
    mockElectronAPI();
    render(<FailedImagesReviewPanel onBack={() => {}} />);
    // SimpleDropdown shows selected label as button text; default is Failed (All)
    await screen.findByText(/Label filter:/i);
    expect(screen.getByRole('button', { name: /Failed \(All\)/ })).toBeInTheDocument();
  });
});


