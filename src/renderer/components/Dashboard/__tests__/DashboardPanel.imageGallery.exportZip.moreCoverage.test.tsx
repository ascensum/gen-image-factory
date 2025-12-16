import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPanel from '../DashboardPanel';

describe('DashboardPanel image gallery export ZIP (workflow)', () => {
  let onProgress: ((data: any) => void) | null = null;
  let onCompleted: ((data: any) => void) | null = null;
  let onError: ((data: any) => void) | null = null;

  const images = [
    {
      id: 'img-1',
      executionId: '1',
      qcStatus: 'approved',
      generationPrompt: 'P1',
      finalImagePath: '/tmp/a.png',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      metadata: { title: 'T1', description: 'D1', tags: ['x'] },
    },
    {
      id: 'img-2',
      executionId: '1',
      qcStatus: 'approved',
      generationPrompt: 'P2',
      finalImagePath: '/tmp/b.png',
      createdAt: new Date('2024-01-01T10:01:00Z'),
      metadata: { title: 'T2', description: 'D2', tags: ['y'] },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Avoid polling intervals in this test
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((cb: any) => {
      void cb;
      return 0 as any;
    }) as any);
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(((id: any) => {
      void id;
    }) as any);

    const mockElectronAPI: any = {
      getSettings: vi.fn().mockResolvedValue({ settings: { advanced: { debugMode: false } } }),
      refreshProtocolRoots: vi.fn().mockResolvedValue(true),
      revealInFolder: vi.fn().mockResolvedValue(true),
      openExportsFolder: vi.fn().mockResolvedValue(true),
      getExportsFolderPath: vi.fn().mockResolvedValue({ success: true, path: '/exports' }),
      jobManagement: {
        getJobStatus: vi.fn().mockResolvedValue({ state: 'idle', progress: 0, currentStep: 1, totalSteps: 2 }),
        getJobHistory: vi.fn().mockResolvedValue([{ id: 1, label: 'Job 1', status: 'completed' }]),
        getJobStatistics: vi.fn().mockResolvedValue({
          totalJobs: 1,
          completedJobs: 1,
          failedJobs: 0,
          averageExecutionTime: 0,
          totalImagesGenerated: 2,
          successRate: 100,
        }),
        getAllGeneratedImages: vi.fn().mockResolvedValue(images),
        getJobLogs: vi.fn().mockResolvedValue([]),
      },
      generatedImages: {
        onZipExportProgress: vi.fn((cb: any) => { onProgress = cb; }),
        onZipExportCompleted: vi.fn((cb: any) => { onCompleted = cb; }),
        onZipExportError: vi.fn((cb: any) => { onError = cb; }),
        removeZipExportProgress: vi.fn(),
        removeZipExportCompleted: vi.fn(),
        removeZipExportError: vi.fn(),
        exportZip: vi.fn().mockResolvedValue({ success: true, zipPath: '/tmp/export.zip' }),
      },
    };

    Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });
  });

  afterEach(() => {
    onProgress = null;
    onCompleted = null;
    onError = null;
    vi.restoreAllMocks();
  });

  it('selects images and exports ZIP (calls exportZip and reveals folder)', async () => {
    render(<DashboardPanel />);

    // Switch to Image Gallery tab
    fireEvent.click(await screen.findByText('Image Gallery'));

    // Wait for image gallery header counts
    await waitFor(() => {
      expect(screen.getByText(/Total Images/i)).toBeInTheDocument();
    });

    // Select all
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Export button should become enabled
    const exportZipBtn = screen.getByText('Export ZIP').closest('button');
    expect(exportZipBtn).toBeEnabled();

    fireEvent.click(exportZipBtn!);

    // Modal appears
    await screen.findByText(/Export Selected Images \(2\)/i);

    // Click Export in modal
    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect((window as any).electronAPI.generatedImages.exportZip).toHaveBeenCalledWith(
        ['img-1', 'img-2'],
        true,
        undefined,
      );
    });

    // Simulate progress + completion events
    expect(onProgress).toBeTruthy();
    expect(onCompleted).toBeTruthy();

    onProgress?.({ step: 'creating-excel' });
    onCompleted?.({});

    await waitFor(() => {
      expect((window as any).electronAPI.revealInFolder).toHaveBeenCalledWith('/tmp/export.zip');
    });
  });
});
