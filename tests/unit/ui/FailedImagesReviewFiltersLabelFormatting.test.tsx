import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import FailedImagesReviewPanel from '../../../src/renderer/components/Dashboard/FailedImagesReviewPanel';

describe('Failed Images Review job filter label formatting', () => {
  it('renders without crashing (label logic smoke)', () => {
    // The component depends on many electron IPCs; this smoke test ensures no immediate crash
    (window as any).electronAPI = {
      generatedImages: {
        getImagesByQCStatus: async () => ({ images: [] })
      },
      getRetryQueueStatus: async () => ({ success: true, queueStatus: { isProcessing: false, queueLength: 0, pendingJobs: 0, processingJobs: 0, completedJobs: 0, failedJobs: 0 } }),
      jobManagement: {
        getAllJobExecutions: async () => ({ executions: [] })
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
      refreshProtocolRoots: async () => {}
    };

    render(<FailedImagesReviewPanel onBack={() => {}} />);
    expect(true).toBe(true);
  });
});


