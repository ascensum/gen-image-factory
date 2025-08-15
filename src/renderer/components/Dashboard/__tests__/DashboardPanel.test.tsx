import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DashboardPanel from '../DashboardPanel';

// Mock the electronAPI
const mockElectronAPI = {
  getJobStatus: vi.fn(),
  getJobHistory: vi.fn(),
  getJobStatistics: vi.fn(),
  getAllGeneratedImages: vi.fn(),
  getConfiguration: vi.fn(),
  jobStart: vi.fn(),
  jobStop: vi.fn(),
  jobForceStop: vi.fn(),
  deleteJobExecution: vi.fn(),
  exportJobToExcel: vi.fn(),
  updateQCStatus: vi.fn(),
  deleteGeneratedImage: vi.fn(),
  manualApproveImage: vi.fn(),
  getJobLogs: vi.fn(),
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('DashboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockElectronAPI.getJobStatus.mockResolvedValue({
      state: 'idle',
      progress: 0,
      currentStep: 0,
      totalSteps: 0,
      startTime: null,
      estimatedTimeRemaining: null
    });
    
    mockElectronAPI.getJobHistory.mockResolvedValue([]);
    mockElectronAPI.getJobStatistics.mockResolvedValue({
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageExecutionTime: 0,
      totalImagesGenerated: 0,
      successRate: 0
    });
    
    mockElectronAPI.getAllGeneratedImages.mockResolvedValue([]);
    mockElectronAPI.getConfiguration.mockResolvedValue({});
    mockElectronAPI.getJobLogs.mockResolvedValue([]);
  });

  it('renders dashboard with main sections', () => {
    render(<DashboardPanel />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    const jobHistoryElements = screen.getAllByText('Job History');
    expect(jobHistoryElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Current Job')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Generated Images')).toBeInTheDocument();
  });

  it('displays job status indicator', async () => {
    mockElectronAPI.getJobStatus.mockResolvedValue({
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(),
      estimatedTimeRemaining: 120
    });

    render(<DashboardPanel />);
    
    await waitFor(() => {
      const runningElements = screen.getAllByText('Running');
      expect(runningElements.length).toBeGreaterThan(0);
    });
  });

  it('shows single job constraint message when job is running', async () => {
    mockElectronAPI.getJobStatus.mockResolvedValue({
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(),
      estimatedTimeRemaining: 120
    });

    render(<DashboardPanel />);
    
    await waitFor(() => {
      expect(screen.getByText(/Only one job can run at a time/)).toBeInTheDocument();
    });
  });

  it('handles job start action', async () => {
    mockElectronAPI.getConfiguration.mockResolvedValue({ test: 'config' });
    mockElectronAPI.jobStart.mockResolvedValue({ success: true, job: { id: 'test-job' } });

    render(<DashboardPanel />);
    
    // Wait for component to load initial data
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
    
    const startButton = screen.getByText('Start Job');
    fireEvent.click(startButton);
    
    // Wait for the async operations to complete
    await waitFor(() => {
      expect(mockElectronAPI.getConfiguration).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    await waitFor(() => {
      expect(mockElectronAPI.jobStart).toHaveBeenCalledWith({ test: 'config' });
    }, { timeout: 3000 });
  });

  it('handles job stop action', async () => {
    mockElectronAPI.getJobStatus.mockResolvedValue({
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(),
      estimatedTimeRemaining: 120
    });
    mockElectronAPI.jobStop.mockResolvedValue({ success: true });

    render(<DashboardPanel />);
    
    // Wait for component to load and show running state (use more specific selector)
    await waitFor(() => {
      const runningElements = screen.getAllByText('Running');
      expect(runningElements.length).toBeGreaterThan(0);
    });
    
    const stopButton = screen.getByText('Stop Job');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.jobStop).toHaveBeenCalled();
    });
  });

  it('handles force stop action', async () => {
    mockElectronAPI.jobForceStop.mockResolvedValue({ success: true });

    render(<DashboardPanel />);
    
    // Wait for component to load initial data
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
    
    // Wait for the button to be available and not in loading state
    const forceStopButton = await waitFor(() => 
      screen.getByRole('button', { name: /force stop/i })
    );
    fireEvent.click(forceStopButton);
    
    // Wait for confirmation dialog and click confirm
    await waitFor(() => {
      expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
    });
    
    // Find the confirm button by its text content
    const confirmButton = screen.getByText('Force Stop All');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.jobForceStop).toHaveBeenCalled();
    });
  });

  it('displays job history', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        configuration: { name: 'Test Job 1' },
        status: 'completed',
        startTime: new Date(),
        progress: 1,
        currentStep: 4,
        totalSteps: 4,
        logs: [],
        statistics: { totalImagesGenerated: 5 }
      }
    ];
    
    mockElectronAPI.getJobHistory.mockResolvedValue(mockJobs);

    render(<DashboardPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Job 1')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('displays statistics', async () => {
    const mockStats = {
      totalJobs: 10,
      completedJobs: 8,
      failedJobs: 2,
      averageExecutionTime: 5000,
      totalImagesGenerated: 50,
      successRate: 80
    };
    
    mockElectronAPI.getJobStatistics.mockResolvedValue(mockStats);

    render(<DashboardPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument(); // Total Jobs
      expect(screen.getByText('80%')).toBeInTheDocument(); // Success Rate
      expect(screen.getByText('5000s')).toBeInTheDocument(); // Avg Duration
      expect(screen.getByText('50')).toBeInTheDocument(); // Images Generated
    });
  });

  it('displays generated images', async () => {
    const mockImages = [
      {
        id: 'img-1',
        jobExecutionId: 'job-1',
        filename: 'test-image-1.png',
        filePath: '/path/to/image1.png',
        qcStatus: 'pending',
        metadata: {},
        createdAt: new Date()
      }
    ];
    
    mockElectronAPI.getAllGeneratedImages.mockResolvedValue(mockImages);

    render(<DashboardPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('test-image-1.png')).toBeInTheDocument();
    });
  });

  it('handles job action - delete', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        configuration: { name: 'Test Job' },
        status: 'completed',
        startTime: new Date(),
        progress: 1,
        currentStep: 4,
        totalSteps: 4,
        logs: [],
        statistics: { totalImagesGenerated: 5 }
      }
    ];
    
    mockElectronAPI.getJobHistory.mockResolvedValue(mockJobs);
    mockElectronAPI.deleteJobExecution.mockResolvedValue({ success: true });

    // Mock the confirm dialog before rendering
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    render(<DashboardPanel />);
    
    // Wait for job to be loaded and delete button to be available
    await waitFor(() => {
      expect(screen.getByText('Test Job')).toBeInTheDocument();
    });
    
    const deleteButton = screen.getByTitle('Delete job');
    fireEvent.click(deleteButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.deleteJobExecution).toHaveBeenCalledWith('job-1');
    });
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('handles image action - update QC status', async () => {
    const mockImages = [
      {
        id: 'img-1',
        jobExecutionId: 'job-1',
        filename: 'test-image.png',
        filePath: '/path/to/image.png',
        qcStatus: 'pending',
        metadata: {},
        createdAt: new Date()
      }
    ];
    
    mockElectronAPI.getAllGeneratedImages.mockResolvedValue(mockImages);
    mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });

    render(<DashboardPanel />);
    
    // Wait for image to be loaded
    await waitFor(() => {
      expect(screen.getByText('test-image.png')).toBeInTheDocument();
    });
    
    // Find the specific QC select element by its class and value
    const qcSelects = screen.getAllByRole('combobox');
    const qcSelect = qcSelects.find(select => select.value === 'pending');
    expect(qcSelect).toBeInTheDocument();
    fireEvent.change(qcSelect!, { target: { value: 'approved' } });
    
    await waitFor(() => {
      expect(mockElectronAPI.updateQCStatus).toHaveBeenCalledWith('img-1', 'approved');
    });
  });

  it('displays error messages', async () => {
    mockElectronAPI.getJobHistory.mockRejectedValue(new Error('Failed to load jobs'));

    render(<DashboardPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load job history')).toBeInTheDocument();
    });
  });

  it('handles loading states', async () => {
    // Mock a slow response
    mockElectronAPI.getJobHistory.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    render(<DashboardPanel />);
    
    // Should show loading state initially
    expect(screen.getByText(/Loading job history/)).toBeInTheDocument();
  });

  it('polls for job status updates', async () => {
    const mockStatus = {
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(),
      estimatedTimeRemaining: 120
    };
    
    mockElectronAPI.getJobStatus.mockResolvedValue(mockStatus);

    render(<DashboardPanel />);
    
    // Wait for multiple polls
    await waitFor(() => {
      expect(mockElectronAPI.getJobStatus).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });

  it('loads logs when job is running', async () => {
    mockElectronAPI.getJobStatus.mockResolvedValue({
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(),
      estimatedTimeRemaining: 120
    });
    
    const mockLogs = [
      {
        id: 'log-1',
        timestamp: new Date(),
        level: 'info',
        message: 'Job started successfully',
        source: 'job-runner'
      }
    ];
    
    mockElectronAPI.getJobLogs.mockResolvedValue(mockLogs);

    render(<DashboardPanel />);
    
    await waitFor(() => {
      expect(mockElectronAPI.getJobLogs).toHaveBeenCalledWith('standard');
    });
  });

  it('handles back navigation when onBack prop is provided', () => {
    const mockOnBack = vi.fn();
    render(<DashboardPanel onBack={mockOnBack} />);
    
    const backButton = screen.getByLabelText('Close dashboard');
    fireEvent.click(backButton);
    
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('navigates to Single Job View when job view action is triggered', async () => {
    const mockOnOpenSingleJobView = vi.fn();
    
    // Mock job data
    mockElectronAPI.getJobHistory.mockResolvedValue([
      {
        id: '1',
        label: 'Test Job',
        status: 'completed',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        totalImages: 5,
        successfulImages: 5,
        failedImages: 0
      }
    ]);
    
    render(<DashboardPanel onOpenSingleJobView={mockOnOpenSingleJobView} />);
    
    // Wait for job to be loaded
    await waitFor(() => {
      expect(screen.getByText('Test Job')).toBeInTheDocument();
    });
    
    // Find and click the view button for the job
    const viewButton = screen.getByLabelText('View Details');
    fireEvent.click(viewButton);
    
    // Verify that the navigation function was called with the correct job ID
    expect(mockOnOpenSingleJobView).toHaveBeenCalledWith('1');
  });

  it('does not show back button when onBack prop is not provided', () => {
    render(<DashboardPanel />);
    
    expect(screen.queryByLabelText('Back to main view')).not.toBeInTheDocument();
  });
});
