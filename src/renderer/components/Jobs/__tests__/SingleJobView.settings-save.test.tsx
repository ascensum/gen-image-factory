import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SingleJobView from '../SingleJobView';

// Focused regression test: ensure the Edit Job Settings modal saves fields via IPC

const mockElectronAPI = {
  jobManagement: {
    getJobExecution: vi.fn(),
    getJobLogs: vi.fn().mockResolvedValue([]),
    renameJobExecution: vi.fn()
  },
  generatedImages: {
    getGeneratedImagesByExecution: vi.fn()
  },
  calculateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true, statistics: { totalImages: 0, successfulImages: 0, failedImages: 0, approvedImages: 0, qcFailedImages: 0 } }),
  getJobConfigurationById: vi.fn(),
  updateJobConfiguration: vi.fn()
};

Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });

const defaultProps = {
  jobId: 1,
  onBack: vi.fn(),
  onExport: vi.fn(),
  onRerun: vi.fn(),
  onDelete: vi.fn()
};

describe('SingleJobView - Settings Save (focused)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: {
        id: 1,
        label: 'Test Job',
        status: 'completed',
        createdAt: '2024-01-01T10:00:00Z',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:05:00Z',
        imageCount: 4,
        configurationId: 'cfg-1'
      }
    });
    mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({ success: true, images: [] });
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({ success: true, configuration: { settings: {
      apiKeys: { openai: '', piapi: '', removeBg: '' },
      filePaths: { outputDirectory: '', tempDirectory: '', systemPromptFile: '', keywordsFile: '', qualityCheckPromptFile: '', metadataPromptFile: '' },
      parameters: { processMode: 'relax', aspectRatios: ['1:1'], mjVersion: '6.1', openaiModel: '', pollingTimeout: 0, pollingInterval: 1, enablePollingTimeout: false, keywordRandom: false, count: 1 },
      processing: { removeBg: false, imageConvert: false, imageEnhancement: false, sharpening: 0, saturation: 1, convertToJpg: false, trimTransparentBackground: false, jpgBackground: 'white', jpgQuality: 100, pngQuality: 100, removeBgSize: 'auto' },
      ai: { runQualityCheck: true, runMetadataGen: true },
      advanced: { debugMode: false }
    } } });
    mockElectronAPI.updateJobConfiguration.mockResolvedValue({ success: true });
  });

  it('saves new file path and parameter fields via IPC', async () => {
    render(<SingleJobView {...defaultProps} />);

    // Wait for initial load (job+config)
    await waitFor(() => expect(mockElectronAPI.jobManagement.getJobExecution).toHaveBeenCalled());
    await waitFor(() => expect(mockElectronAPI.getJobConfigurationById).toHaveBeenCalledWith('cfg-1'));

    // Open edit modal
    const editBtn = await screen.findByTitle('Edit job settings');
    fireEvent.click(editBtn);

    // Fill new fields
    fireEvent.change(screen.getByPlaceholderText('Path to system prompt file'), { target: { value: '/abs/sys.txt' } });
    fireEvent.change(screen.getByPlaceholderText('Path to QC prompt file'), { target: { value: '/abs/qc.txt' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., gpt-4o-mini'), { target: { value: 'gpt-4o-mini' } });
    const checkboxes = screen.getAllByRole('checkbox');
    const enableTimeout = checkboxes[0] as HTMLInputElement; // Enable Polling Timeout
    if (!enableTimeout.checked) fireEvent.click(enableTimeout);
    const timeoutInput = screen.getAllByDisplayValue('0')[0] as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '45' } });

    // Save
    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => expect(mockElectronAPI.updateJobConfiguration).toHaveBeenCalled());
    const payload = mockElectronAPI.updateJobConfiguration.mock.calls[0][1];
    expect(payload.filePaths.systemPromptFile).toBe('/abs/sys.txt');
    expect(payload.filePaths.qualityCheckPromptFile).toBe('/abs/qc.txt');
    expect(payload.parameters.openaiModel).toBe('gpt-4o-mini');
    expect(payload.parameters.enablePollingTimeout).toBe(true);
    expect(payload.parameters.pollingTimeout).toBe(45);
  });
});


