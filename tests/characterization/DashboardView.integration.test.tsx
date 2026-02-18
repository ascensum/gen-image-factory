import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the feature flag utility to ENABLE the new view
vi.mock('../../src/renderer/utils/featureFlags', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true)
}));

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

describe('DashboardView Modular Integration (Feature Flag Enabled)', () => {
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

  it('renders new DashboardView via feature flag', async () => {
    render(<DashboardPanel />);
    // Verification that we are rendering the new view could be implicit if it works
    // But to be sure, we can check for a specific class or structure if it differs slightly
    // For now, functional parity is the goal.
    
    // Check if Stats are rendered (DashboardView uses DashboardStats component)
    await waitFor(() => {
      expect(screen.getByText(/Total Jobs:/i)).toBeInTheDocument();
    });
  });

  it('handles tab switching', async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    const overviewTab = await screen.findByRole('button', { name: /Overview/i });
    const galleryTab = screen.getByRole('button', { name: /Image Gallery/i });

    expect(overviewTab).toHaveClass('active');
    
    await user.click(galleryTab);
    expect(galleryTab).toHaveClass('active');
    expect(screen.getByText('Generated Images')).toBeInTheDocument();
  });

  it('loads and displays initial data', async () => {
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

    mockElectronAPI.jobManagement.getJobHistory.mockResolvedValue(mockJobs);
    mockElectronAPI.jobManagement.getJobStatistics.mockResolvedValue(mockStats);

    render(<DashboardPanel />);

    await waitFor(() => {
      expect(screen.getByText('Job 1')).toBeInTheDocument();
      // Stats
      expect(screen.getByText('1')).toBeInTheDocument(); // Total Jobs
      expect(screen.getByText('100%')).toBeInTheDocument(); // Success Rate
    });
  });

  // Replicate other baseline tests as needed for critical paths
  it('handles job start workflow', async () => {
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
      expect(mockElectronAPI.jobManagement.jobStart).toHaveBeenCalled();
    });
  });

   it('tracks job running state and progress', async () => {
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
    
    // Mock history to have a running job
    mockElectronAPI.jobManagement.getJobHistory.mockResolvedValue([
      { id: 'job-run-1', label: 'Running Job', status: 'running', startedAt: new Date() }
    ]);

    render(<DashboardPanel />);

    await waitFor(() => {
      // Smart progress text from DashboardView -> useDashboardProgress
      // Note: Text might differ slightly if I refactored logic, but I aimed for parity
      expect(screen.getByText(/Generation Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/Completed 5 of 10 generations/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
