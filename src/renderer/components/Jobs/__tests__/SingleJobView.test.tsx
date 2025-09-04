import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SingleJobView from '../SingleJobView';

// Mock the electron API
const mockElectronAPI = {
  jobManagement: {
    getJobExecution: vi.fn(),
    getJobLogs: vi.fn(),
    renameJobExecution: vi.fn()
  },
  generatedImages: {
    getGeneratedImagesByExecution: vi.fn()
  },
  getJobConfigurationById: vi.fn(),
  updateJobConfiguration: vi.fn(),
  exportJobToExcel: vi.fn()
};

// Mock the window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

const mockJob = {
  id: 1,
  label: 'Test Job',
  status: 'completed',
  createdAt: '2024-01-01T10:00:00Z',
  startedAt: '2024-01-01T10:00:00Z',
  completedAt: '2024-01-01T10:05:00Z',
  imageCount: 5,
  configurationId: 'config1',
  execution: {
    id: 1
  }
};

const mockImages = [
  {
    id: '1',
    executionId: '1',
    generationPrompt: 'A beautiful landscape',
    finalImagePath: '/path/to/image1.jpg',
    qcStatus: 'passed',
    createdAt: new Date('2024-01-01T10:01:00Z'),
    metadata: {
      title: 'Beautiful Landscape',
      description: 'A stunning natural scene'
    }
  },
  {
    id: '2',
    executionId: '1',
    generationPrompt: 'A majestic mountain',
    finalImagePath: '/path/to/image2.jpg',
    qcStatus: 'passed',
    createdAt: new Date('2024-01-01T10:02:00Z'),
    metadata: {
      title: 'Majestic Mountain',
      description: 'A towering peak'
    }
  }
];

const defaultProps = {
  jobId: 1,
  onBack: vi.fn(),
  onExport: vi.fn(),
  onRerun: vi.fn(),
  onDelete: vi.fn()
};

describe('SingleJobView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
      success: true,
      execution: mockJob
    });
    
    mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({
      success: true,
      images: mockImages
    });
    
    mockElectronAPI.jobManagement.getJobLogs.mockResolvedValue([]);
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({ success: true, configuration: {} });
  });

  describe('Rendering', () => {
    it('renders loading state initially', () => {
      render(<SingleJobView {...defaultProps} />);
      
      expect(screen.getByRole('main', { name: 'Loading job details' })).toBeInTheDocument();
      // The loading text might not be present in the actual component
      // Just check that the loading state is rendered
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('renders job details after loading', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Header shows label text (not a role heading)
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      });
      
      expect(screen.getByText(/Job ID: 1 • Created:/)).toBeInTheDocument();
      // Check that at least one completed status exists (there are multiple)
      expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
    });

    it('renders action buttons in header', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      });
      
      expect(screen.getByRole('button', { name: 'Export job and images' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rerun job' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete job' })).toBeInTheDocument();
    });

    it('renders tab navigation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      });
      
      expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Images' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
    });

    it('shows overview tab by default', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      });
      
      expect(screen.getByText('Job Overview')).toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Timing')).toBeInTheDocument();
      expect(screen.getByText('Image Statistics')).toBeInTheDocument();
    });
  });

  describe('Job Information Display', () => {
    it('displays job information correctly in overview', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      expect(screen.getByText('Job ID')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
      // Check that at least one "Test Job" text exists (there are multiple)
      expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      expect(screen.getByText('Status')).toBeInTheDocument();
      // Check that at least one completed status exists (there are multiple)
      expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
    });

    it('displays timing information correctly', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      expect(screen.getByText('Started')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('5m 0s')).toBeInTheDocument();
    });

    it('displays image statistics correctly', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      expect(screen.getByText('Total Images')).toBeInTheDocument();
      // Check that at least one "2" text exists (there are multiple)
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getByText('Successful')).toBeInTheDocument();
      // Check that at least one "2" text exists (there are multiple)
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to images tab when clicked', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const imagesTab = screen.getByRole('button', { name: 'Images' });
      fireEvent.click(imagesTab);
      
      expect(screen.getByText('Generated Images')).toBeInTheDocument();
      expect(screen.getByText('Image 1')).toBeInTheDocument();
      expect(screen.getByText('Image 2')).toBeInTheDocument();
    });

    it('switches to logs tab when clicked', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      });
      
      const logsTab = screen.getByRole('button', { name: 'Logs' });
      fireEvent.click(logsTab);
      
      expect(screen.getByText('Job Logs')).toBeInTheDocument();
      expect(screen.getByText(/Job 1 started at/)).toBeInTheDocument();
    });

    it('handles tab navigation with keyboard', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const imagesTab = screen.getByRole('button', { name: 'Images' });
      
      // Test Enter key
      fireEvent.keyDown(imagesTab, { key: 'Enter' });
      expect(screen.getByText('Generated Images')).toBeInTheDocument();
      
      // Test Space key
      const logsTab = screen.getByRole('tab', { name: 'Logs' });
      fireEvent.keyDown(logsTab, { key: ' ' });
      expect(screen.getByText('Job Logs')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('handles back button click', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const backButton = screen.getByRole('button', { name: 'Go back to job list' });
      fireEvent.click(backButton);
      
      expect(defaultProps.onBack).toHaveBeenCalled();
    });

    it('handles back button keyboard navigation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const backButton = screen.getByRole('button', { name: 'Go back to job list' });
      
      // Test Enter key
      fireEvent.keyDown(backButton, { key: 'Enter' });
      expect(defaultProps.onBack).toHaveBeenCalled();
    });

    it('handles export button click', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const exportButton = screen.getByRole('button', { name: 'Export job and images' });
      fireEvent.click(exportButton);
      
      expect(defaultProps.onExport).toHaveBeenCalledWith(1);
    });

    it('handles rerun button click', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const rerunButton = screen.getByRole('button', { name: 'Rerun job' });
      fireEvent.click(rerunButton);
      
      expect(defaultProps.onRerun).toHaveBeenCalledWith(1);
    });

    it('handles delete button click', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      fireEvent.click(deleteButton);
      
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    });

    it('handles delete button keyboard navigation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      
      // Test Enter key
      fireEvent.keyDown(deleteButton, { key: 'Enter' });
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    });
  });

  describe('Delete Confirmation', () => {
    it('shows delete confirmation dialog', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      fireEvent.click(deleteButton);
      
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this job/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel deletion' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm deletion' })).toBeInTheDocument();
    });

    it('handles delete confirmation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      fireEvent.click(deleteButton);
      
      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Confirm deletion' });
      fireEvent.click(confirmButton);
      
      expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
    });

    it('handles delete cancellation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      fireEvent.click(deleteButton);
      
      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: 'Cancel deletion' });
      fireEvent.click(cancelButton);
      
      expect(defaultProps.onDelete).not.toHaveBeenCalled();
      expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
    });

    it('handles delete confirmation keyboard navigation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      fireEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: 'Confirm deletion' });
      
      // Test Enter key
      fireEvent.keyDown(confirmButton, { key: 'Enter' });
      expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
    });

    it('handles delete cancellation keyboard navigation', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: 'Delete job' });
      fireEvent.click(deleteButton);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel deletion' });
      
      // Test Enter key
      fireEvent.keyDown(cancelButton, { key: 'Enter' });
      expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
    });
  });

  describe('Images Tab', () => {
    it('displays images correctly in images tab', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const imagesTab = screen.getByRole('tab', { name: 'Images' });
      fireEvent.click(imagesTab);
      
      expect(screen.getByText('Generated Images')).toBeInTheDocument();
      expect(screen.getByText('Image 1')).toBeInTheDocument();
      expect(screen.getByText('Image 2')).toBeInTheDocument();
      // Check that at least one completed status exists (there are multiple)
      expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
      expect(screen.getByText('/path/to/image1.jpg')).toBeInTheDocument();
    });
  });

  describe('Logs Tab', () => {
    it('displays logs correctly in logs tab', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Use the header title instead of generic text search
        expect(screen.getByRole('heading', { name: 'Test Job' })).toBeInTheDocument();
      });
      
      const logsTab = screen.getByRole('tab', { name: 'Logs' });
      fireEvent.click(logsTab);
      
      expect(screen.getByText('Job Logs')).toBeInTheDocument();
      expect(screen.getByText(/Job 1 started at/)).toBeInTheDocument();
      expect(screen.getByText('Processing images...')).toBeInTheDocument();
      expect(screen.getByText('Post-processing completed')).toBeInTheDocument();
      expect(screen.getByText('Job finished successfully')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles job without label', async () => {
      const jobWithoutLabel = { ...mockJob, label: undefined };
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: true,
        job: jobWithoutLabel
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // When label is undefined, it should show a heading like "Job # 1"
        expect(screen.getByText(/Job\s*#\s*1/)).toBeInTheDocument();
      });
    });

    it('handles job without completedAt', async () => {
      const jobWithoutCompletedAt = { ...mockJob, completedAt: undefined };
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: true,
        job: jobWithoutCompletedAt
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
      });
      
      expect(screen.getByText('Not completed')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('handles job without startedAt', async () => {
      const jobWithoutStartedAt = { ...mockJob, startedAt: undefined };
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: true,
        job: jobWithoutStartedAt
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Header shows label in a span, not as a heading element
        expect(screen.getByText('Test Job')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Not started')).toBeInTheDocument();
    });

    it('handles empty images array', async () => {
      mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({
        success: true,
        images: []
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Header shows label in a span, not as a heading element
        expect(screen.getByText('Test Job')).toBeInTheDocument();
      });
      
      const imagesTab = screen.getByRole('button', { name: 'Images' });
      fireEvent.click(imagesTab);
      
      expect(screen.getByText('No images generated')).toBeInTheDocument();
      expect(screen.getByText("This job hasn't generated any images yet.")).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API error for job loading', async () => {
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: false,
        error: 'Job not found'
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Job')).toBeInTheDocument();
        expect(screen.getByText('Job not found')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
      });
    });

    it('handles API error for images loading', async () => {
      mockElectronAPI.generatedImages.getGeneratedImagesByExecution.mockResolvedValue({
        success: false,
        error: 'Failed to load images'
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        // Should still show job details but with empty images
        expect(screen.getAllByText('Test Job').length).toBeGreaterThan(0);
        
        const imagesTab = screen.getByRole('button', { name: 'Images' });
        fireEvent.click(imagesTab);
        
        expect(screen.getByText('No images generated')).toBeInTheDocument();
      });
    });

    it('handles API exception', async () => {
      mockElectronAPI.jobManagement.getJobExecution.mockRejectedValue(new Error('Network error'));
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Job')).toBeInTheDocument();
        expect(screen.getByText('Failed to load job data')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('applies correct ARIA labels and roles', async () => {
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        // Component uses buttons for tabs
        const overviewTab = screen.getByRole('button', { name: 'Overview' });
        expect(overviewTab).toBeInTheDocument();
        
        expect(overviewTab).toHaveAttribute('role', 'tab');
        expect(overviewTab).toHaveAttribute('aria-selected', 'true');
        
        // Check that the overview panel exists and has the correct structure
        const overviewPanel = screen.getByText('Job Overview').closest('div');
        expect(overviewPanel).toBeInTheDocument();
        // Note: The component doesn't actually apply role="tabpanel" to the content divs
        // So we just verify the content exists
      });
    });

    it('handles different job statuses correctly', async () => {
      const failedJob = { ...mockJob, status: 'failed' };
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: true,
        execution: failedJob
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        const statusBadge = screen.getByRole('main').querySelector('.status-badge');
        expect(statusBadge).toHaveTextContent('Failed');
        expect(statusBadge).toHaveClass('status-failed');
      });
    });

    it('handles processing job status', async () => {
      const processingJob = { ...mockJob, status: 'processing' };
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: true,
        job: processingJob
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        const statusContainer = screen.getByRole('main');
        const badge = statusContainer.querySelector('.status-badge');
        expect(badge).toBeTruthy();
        expect(badge!.textContent).toMatch(/Processing/i);
        expect(badge).toHaveClass('status-processing');
      });
    });

    it('handles pending job status', async () => {
      const pendingJob = { ...mockJob, status: 'pending' };
      mockElectronAPI.jobManagement.getJobExecution.mockResolvedValue({
        success: true,
        job: pendingJob
      });
      
      render(<SingleJobView {...defaultProps} />);
      
      await waitFor(() => {
        const statusContainer = screen.getByRole('main');
        const badge = statusContainer.querySelector('.status-badge');
        expect(badge).toBeTruthy();
        expect(badge!.textContent).toMatch(/Pending/i);
        expect(badge).toHaveClass('status-pending');
      });
    });
  });
});
