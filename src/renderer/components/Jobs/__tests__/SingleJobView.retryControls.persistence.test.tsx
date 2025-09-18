import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SingleJobView from '../SingleJobView';

declare global {
  interface Window { electronAPI?: any; }
}

describe('SingleJobView - retry controls in edit modal persist', () => {
  it('updates job configuration with retry attempts/backoff', async () => {
    const jobId = 123;
    window.electronAPI = {
      jobManagement: {
        getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: jobId, label: 'L', status: 'completed', configurationId: 1, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() } }),
        getJobLogs: vi.fn().mockResolvedValue([])
      },
      generatedImages: { getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }) },
      getJobConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: { settings: { parameters: { processMode: 'relax', aspectRatios: ['1:1'], count: 1, enablePollingTimeout: false }, processing: {}, ai: {} } } }),
      updateJobConfiguration: vi.fn().mockResolvedValue({ success: true })
    };

    render(<SingleJobView jobId={jobId} onBack={() => {}} onExport={() => {}} onRerun={() => {}} onDelete={() => {}} />);

    // Open edit modal
    fireEvent.click(await screen.findByText('Edit'));

    // Set retry fields
    const attempts = await screen.findByLabelText('Generation Retry Attempts');
    fireEvent.change(attempts, { target: { value: '2' } });
    const backoff = await screen.findByLabelText('Retry Backoff (ms)');
    fireEvent.change(backoff, { target: { value: '400' } });

    // Save
    fireEvent.click(screen.getByText('Save Settings'));

    const call = window.electronAPI.updateJobConfiguration.mock.calls[0][1];
    expect(call.parameters.generationRetryAttempts).toBe(2);
    expect(call.parameters.generationRetryBackoffMs).toBe(400);
  });
});


