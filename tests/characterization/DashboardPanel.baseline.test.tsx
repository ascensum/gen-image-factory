import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import DashboardPanel from '../../src/renderer/components/Dashboard/DashboardPanel';

// Mock Electron API
const mockElectronAPI = {
  jobManagement: {
    getJobStatus: vi.fn(),
    getJobHistory: vi.fn(),
    getJobStatistics: vi.fn(),
    getAllGeneratedImages: vi.fn(),
    getConfiguration: vi.fn(),
    jobStart: vi.fn(),
    jobStop: vi.fn(),
    jobForceStop: vi.fn(),
    deleteJobExecution: vi.fn(),
    rerunJobExecution: vi.fn(),
    exportJobToExcel: vi.fn(),
    getJobLogs: vi.fn(),
    updateQCStatus: vi.fn(),
    deleteGeneratedImage: vi.fn(),
    bulkDeleteImages: vi.fn(),
    getJobExecution: vi.fn(),
    getParentJobForRerun: vi.fn(),
  },
  generatedImages: {
    exportZip: vi.fn(),
    onZipExportProgress: vi.fn(),
    onZipExportCompleted: vi.fn(),
    onZipExportError: vi.fn(),
    removeZipExportProgress: vi.fn(),
    removeZipExportCompleted: vi.fn(),
    removeZipExportError: vi.fn(),
  },
  getSettings: vi.fn(),
  refreshProtocolRoots: vi.fn(),
  revealInFolder: vi.fn(),
  openExportsFolder: vi.fn(),
  onRetryCompleted: vi.fn(),
  removeRetryCompleted: vi.fn(),
  getJobConfigurationById: vi.fn(),
};

// @ts-ignore
window.electronAPI = mockElectronAPI;

describe('DashboardPanel Characterization Baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default implementations
    mockElectronAPI.jobManagement.getJobStatus.mockResolvedValue({
      state: 'idle',
      progress: 0,
      currentStep: 1,
      totalSteps: 2
    });
    mockElectronAPI.jobManagement.getJobHistory.mockResolvedValue([]);
    mockElectronAPI.jobManagement.getJobStatistics.mockResolvedValue({
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageExecutionTime: 0,
      totalImagesGenerated: 0,
      successRate: 0
    });
    mockElectronAPI.jobManagement.getAllGeneratedImages.mockResolvedValue([]);
    mockElectronAPI.jobManagement.getConfiguration.mockResolvedValue({ success: true, settings: {} });
    mockElectronAPI.jobManagement.getJobLogs.mockResolvedValue([]);
    mockElectronAPI.getSettings.mockResolvedValue({ settings: { advanced: { debugMode: false } } });
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({ success: true, configuration: { settings: {} } });
  });

  afterEach(() => {
    cleanup();
  });

  it('baselines initial render and data loading', async () => {
    const mockJobs = [
      { id: 'job-1', label: 'Job 1', status: 'completed', startedAt: new Date(), successfulImages: 5, totalImages: 5 }
    ];
    const mockStats = {
      totalJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      averageExecutionTime: 120,
      totalImagesGenerated: 5,
      successRate: 100
    };
    const mockImages = [
      { id: 'img-1', executionId: 'job-1', finalImagePath: 'path/1.png', generationPrompt: 'Prompt 1', qcStatus: 'approved', createdAt: new Date() }
    ];

    mockElectronAPI.jobManagement.getJobHistory.mockResolvedValue(mockJobs);
    mockElectronAPI.jobManagement.getJobStatistics.mockResolvedValue(mockStats);
    mockElectronAPI.jobManagement.getAllGeneratedImages.mockResolvedValue(mockImages);

    render(<DashboardPanel />);

    // Wait for Overview tab to be visible
    const overviewTab = await screen.findByRole('button', { name: /Overview/i });
    expect(overviewTab).toBeInTheDocument();
    
    // Check stats in header
    await waitFor(() => {
      const statsElements = screen.getAllByText(/1|100%|5|120s/);
      expect(statsElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Check Job History item
    expect(screen.getByText('Job 1')).toBeInTheDocument();
  });

  it('baselines tab switching behavior', async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    const overviewTab = await screen.findByRole('button', { name: /Overview/i });
    const galleryTab = screen.getByRole('button', { name: /Image Gallery/i });

    // Initially Overview is active
    expect(overviewTab).toHaveClass('active');
    
    // Switch to Image Gallery
    await user.click(galleryTab);
    expect(galleryTab).toHaveClass('active');
    expect(screen.getByText('Generated Images')).toBeInTheDocument();
  });

  it('baselines job start workflow', async () => {
    const user = userEvent.setup();
    mockElectronAPI.jobManagement.getConfiguration.mockResolvedValue({
      success: true,
      settings: { parameters: { label: 'New Job' } }
    });
    mockElectronAPI.jobManagement.jobStart.mockResolvedValue({ success: true });

    render(<DashboardPanel />);

    const startButton = await screen.findByRole('button', { name: /start/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(mockElectronAPI.jobManagement.getConfiguration).toHaveBeenCalled();
      expect(mockElectronAPI.jobManagement.jobStart).toHaveBeenCalled();
    });
  });

  it('baselines job running state and progress tracking', async () => {
    // Mock running state
    mockElectronAPI.jobManagement.getJobStatus.mockResolvedValue({
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 2,
      currentJob: { id: 'job-run-1', totalGenerations: 10, gensDone: 5 }
    });
    
    mockElectronAPI.jobManagement.getConfiguration.mockResolvedValue({
      success: true,
      settings: { parameters: { count: 10 } }
    });
    
    // Mock history to have a running job so it doesn't reconcile to failed
    mockElectronAPI.jobManagement.getJobHistory.mockResolvedValue([
      { id: 'job-run-1', label: 'Running Job', status: 'running', startedAt: new Date() }
    ]);

    render(<DashboardPanel />);

    // Should show progress eventually due to polling
    await waitFor(() => {
      expect(screen.getByText(/Generation Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/Completed 5 of 10 generations/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Check progress steps
    expect(screen.getByText('Initialization')).toBeInTheDocument();
    expect(screen.getByText('Image Generation')).toBeInTheDocument();
  });

  it('baselines log viewing during job execution', async () => {
    mockElectronAPI.jobManagement.getJobStatus.mockResolvedValue({
      state: 'running',
      progress: 0.1,
      currentStep: 2
    });
    
    const mockLogs = [
      { id: 'l1', timestamp: new Date(), level: 'info', message: 'Starting generation...', source: 'runner' }
    ];
    mockElectronAPI.jobManagement.getJobLogs.mockResolvedValue(mockLogs);

    render(<DashboardPanel />);

    await waitFor(() => {
      expect(screen.getByText('Starting generation...')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('baselines image gallery filtering and selection', async () => {
    const user = userEvent.setup();
    const mockImages = [
      { id: 'img-1', executionId: 'j1', finalImagePath: 'p1.png', generationPrompt: 'Sunset', qcStatus: 'approved', createdAt: new Date() },
      { id: 'img-2', executionId: 'j2', finalImagePath: 'p2.png', generationPrompt: 'Mountain', qcStatus: 'approved', createdAt: new Date() }
    ];
    mockElectronAPI.jobManagement.getAllGeneratedImages.mockResolvedValue(mockImages);

    render(<DashboardPanel />);

    const galleryTab = await screen.findByRole('button', { name: /Image Gallery/i });
    await user.click(galleryTab);

    await waitFor(() => {
      expect(screen.getByText(/Total Images/i)).toHaveTextContent(/2/);
    }, { timeout: 3000 });

    // Search filter
    const searchInput = screen.getByPlaceholderText('Search images...');
    await user.type(searchInput, 'Sunset');

    await waitFor(() => {
      expect(screen.getByText(/Select All/i)).toHaveTextContent(/0\/1/);
    });

    // Selection
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    await user.click(selectAllCheckbox);

    expect(screen.getByText(/Delete Selected \(1\)/i)).toBeInTheDocument();
  });

  it('baselines job history actions - rerun and delete', async () => {
    const mockJobs = [
      { id: 'j1', label: 'Job to action', status: 'completed', startedAt: new Date() }
    ];
    mockElectronAPI.jobManagement.getJobHistory.mockResolvedValue(mockJobs);
    
    render(<DashboardPanel />);

    // Wait for the job item to appear
    const jobItem = await screen.findByText('Job to action');
    expect(jobItem).toBeInTheDocument();

    // Find delete button
    const deleteBtn = screen.getByTitle('Delete job');
    fireEvent.click(deleteBtn);

    // Wait for custom confirmation dialog
    // Use a broad text matcher to find ANYTHING that looks like a confirm button
    const confirmDeleteBtn = await screen.findByRole('button', { name: /Delete/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockElectronAPI.jobManagement.deleteJobExecution).toHaveBeenCalledWith('j1');
    }, { timeout: 5000 });

    const rerunBtn = screen.getByTitle('Rerun job');
    fireEvent.click(rerunBtn);

    await waitFor(() => {
      expect(mockElectronAPI.jobManagement.rerunJobExecution).toHaveBeenCalledWith('j1');
    }, { timeout: 5000 });
  }, 20000);

  it('baselines export functionality', async () => {
    const user = userEvent.setup();
    const mockImages = [
      { id: 'img-1', executionId: 'j1', finalImagePath: 'p1.png', generationPrompt: 'Sunset', qcStatus: 'approved', createdAt: new Date() }
    ];
    mockElectronAPI.jobManagement.getAllGeneratedImages.mockResolvedValue(mockImages);

    render(<DashboardPanel />);
    const galleryTab = await screen.findByRole('button', { name: /Image Gallery/i });
    await user.click(galleryTab);

    await waitFor(() => {
      expect(screen.getByText(/Total Images/i)).toHaveTextContent(/1/);
    });

    const checkbox = screen.getAllByRole('checkbox')[0];
    await user.click(checkbox);

    const exportBtn = screen.getByRole('button', { name: /Export ZIP/i });
    await user.click(exportBtn);

    await screen.findByText(/Export Selected Images/i);

    const confirmExportBtn = screen.getByRole('button', { name: /^Export$/ });
    await user.click(confirmExportBtn);

    expect(mockElectronAPI.generatedImages.exportZip).toHaveBeenCalled();
  });
});
