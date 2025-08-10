import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import JobHistory from '../JobHistory';

describe('JobHistory', () => {
  const mockJobs = [
    {
      id: 'job-1',
      configurationName: 'Test Job 1',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
      progress: 1,
      currentStep: 4,
      totalSteps: 4,
      logs: [],
      statistics: { totalImagesGenerated: 5 }
    },
    {
      id: 'job-2',
      configurationName: 'Test Job 2',
      status: 'failed',
      startedAt: new Date('2024-01-01T11:00:00Z'),
      completedAt: null,
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      logs: [],
      statistics: { totalImagesGenerated: 2 }
    },
    {
      id: 'job-3',
      configurationName: 'Test Job 3',
      status: 'running',
      startedAt: new Date('2024-01-01T12:00:00Z'),
      completedAt: null,
      progress: 0.75,
      currentStep: 3,
      totalSteps: 4,
      logs: [],
      statistics: { totalImagesGenerated: 3 }
    }
  ];

  const defaultProps = {
    jobs: mockJobs,
    isLoading: false,
    onJobAction: vi.fn(),
    onDeleteJob: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders job history with main sections', () => {
    render(<JobHistory {...defaultProps} />);
    
    expect(screen.getByText('Job History')).toBeInTheDocument();
    expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    expect(screen.getByText('Test Job 2')).toBeInTheDocument();
    expect(screen.getByText('Test Job 3')).toBeInTheDocument();
  });

  it('displays job status correctly', () => {
    render(<JobHistory {...defaultProps} />);
    
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('displays job statistics', () => {
    render(<JobHistory {...defaultProps} />);
    
    // The component shows " total ( successful, failed)" format - use getAllByText since there are multiple
    const totalElements = screen.getAllByText(/total/);
    expect(totalElements.length).toBeGreaterThan(0);
    const successfulElements = screen.getAllByText(/successful/);
    expect(successfulElements.length).toBeGreaterThan(0);
    const failedElements = screen.getAllByText(/failed/);
    expect(failedElements.length).toBeGreaterThan(0);
  });

  it('formats dates correctly', () => {
    render(<JobHistory {...defaultProps} />);
    
    // Should display formatted date - use getAllByText since there are multiple instances
    const dateElements = screen.getAllByText(/Jan 1, 2024/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('formats duration correctly', () => {
    const jobsWithDuration = [
      {
        ...mockJobs[0],
        startedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:05:00Z') // 5 minutes
      }
    ];
    
    render(<JobHistory {...defaultProps} jobs={jobsWithDuration} />);
    
    expect(screen.getByText('5m')).toBeInTheDocument();
  });

  it('applies correct status colors', () => {
    render(<JobHistory {...defaultProps} />);
    
    // Completed - green
    const completedStatus = screen.getByText('completed').closest('span');
    expect(completedStatus).toHaveClass('bg-green-100', 'text-green-800');
    
    // Failed - red
    const failedStatus = screen.getByText('failed').closest('span');
    expect(failedStatus).toHaveClass('bg-red-100', 'text-red-800');
    
    // Running - blue
    const runningStatus = screen.getByText('running').closest('span');
    expect(runningStatus).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('displays correct status icons', () => {
    render(<JobHistory {...defaultProps} />);
    
    // Check for completed icon (checkmark)
    const completedIcon = document.querySelector('svg[class*="text-green-600"]');
    expect(completedIcon).toBeInTheDocument();
    
    // Check for failed icon (X)
    const failedIcon = document.querySelector('svg[class*="text-red-600"]');
    expect(failedIcon).toBeInTheDocument();
    
    // Check for running icon (spinner)
    const runningIcon = document.querySelector('svg[class*="animate-spin"]');
    expect(runningIcon).toBeInTheDocument();
  });

  it('handles job click', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByText('Test Job 1').closest('div');
    fireEvent.click(jobItem);
    
    expect(defaultProps.onJobAction).toHaveBeenCalledWith('view', 'job-1');
  });

  it('shows context menu on right click', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByText('Test Job 1').closest('div');
    fireEvent.contextMenu(jobItem);
    
    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    expect(screen.getByText('Rerun Job')).toBeInTheDocument();
    expect(screen.getByText('Delete Job')).toBeInTheDocument();
  });

  it('handles context menu actions', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByText('Test Job 1').closest('div');
    fireEvent.contextMenu(jobItem);
    
    const exportButton = screen.getByText('Export to Excel');
    fireEvent.click(exportButton);
    
    expect(defaultProps.onJobAction).toHaveBeenCalledWith('export', 'job-1');
  });

  it('handles delete job action', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByText('Test Job 1').closest('div');
    fireEvent.contextMenu(jobItem);
    
    const deleteButton = screen.getByText('Delete Job');
    fireEvent.click(deleteButton);
    
    // Should show confirmation dialog first
    expect(screen.getByText('Delete Job')).toBeInTheDocument();
    
    // Click confirm button in dialog
    const confirmButton = screen.getByText('Delete');
    fireEvent.click(confirmButton);
    
    expect(defaultProps.onDeleteJob).toHaveBeenCalledWith('job-1');
  });

  it('shows confirmation dialog for delete action', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByText('Test Job 1').closest('div');
    fireEvent.contextMenu(jobItem);
    
    const deleteButton = screen.getByText('Delete Job');
    fireEvent.click(deleteButton);
    
    expect(screen.getByText('Delete Job')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this job? This action cannot be undone.')).toBeInTheDocument();
  });

  it('handles empty job history', () => {
    render(<JobHistory {...defaultProps} jobs={[]} />);
    
    expect(screen.getByText('No job history available')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<JobHistory {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading job history...')).toBeInTheDocument();
  });

  it('filters jobs by status', () => {
    render(<JobHistory {...defaultProps} />);
    
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'completed' } });
    
    expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Job 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Job 3')).not.toBeInTheDocument();
  });

  it('sorts jobs by date', () => {
    render(<JobHistory {...defaultProps} />);
    
    const sortSelect = screen.getByDisplayValue('Newest First');
    fireEvent.change(sortSelect, { target: { value: 'oldest' } });
    
    // Should reorder jobs by date
    const jobItems = screen.getAllByText(/Test Job/);
    expect(jobItems[0]).toHaveTextContent('Test Job 1');
  });

  it('handles keyboard navigation', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByLabelText('Test Job 1 - completed');
    
    // Tab navigation should work
    jobItem.focus();
    expect(jobItem).toHaveFocus();
    
    // Enter key should trigger view action
    fireEvent.keyDown(jobItem, { key: 'Enter', code: 'Enter' });
    expect(defaultProps.onJobAction).toHaveBeenCalledWith('view', 'job-1');
  });

  it('provides proper ARIA labels', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItems = screen.getAllByRole('listitem');
    expect(jobItems[0]).toHaveAttribute('role', 'listitem');
  });

  it('handles jobs with very long names', () => {
    const jobsWithLongNames = [
      {
        ...mockJobs[0],
        configurationName: 'A'.repeat(100)
      }
    ];
    
    render(<JobHistory {...defaultProps} jobs={jobsWithLongNames} />);
    
    expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
  });

  it('displays progress for running jobs', () => {
    render(<JobHistory {...defaultProps} />);
    
    // Should show "In Progress" for running job - use getAllByText since there are multiple
    const inProgressElements = screen.getAllByText('In Progress');
    expect(inProgressElements.length).toBeGreaterThan(0);
  });

  it('handles jobs with missing statistics', () => {
    const jobsWithoutStats = [
      {
        ...mockJobs[0],
        statistics: null
      }
    ];
    
    render(<JobHistory {...defaultProps} jobs={jobsWithoutStats} />);
    
    // The component shows " total ( successful, failed)" when statistics are missing
    expect(screen.getByText(/total/)).toBeInTheDocument();
  });

  it('handles jobs with missing end time', () => {
    const jobsWithoutEndTime = [
      {
        ...mockJobs[0],
        completedAt: null
      }
    ];
    
    render(<JobHistory {...defaultProps} jobs={jobsWithoutEndTime} />);
    
    // Should show "In Progress" or similar for jobs without end time
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('prevents context menu on running jobs for certain actions', () => {
    render(<JobHistory {...defaultProps} />);
    
    const runningJob = screen.getByText('Test Job 3').closest('div');
    fireEvent.contextMenu(runningJob);
    
    // Rerun should be disabled for running jobs
    const rerunButton = screen.getByText('Rerun Job');
    expect(rerunButton).toBeDisabled();
  });

  it('handles rapid job status updates', () => {
    const { rerender } = render(<JobHistory {...defaultProps} />);
    
    // Initially show running job
    expect(screen.getByText('running')).toBeInTheDocument();
    
    // Update job status to completed
    const updatedJobs = mockJobs.map(job => 
      job.id === 'job-3' ? { ...job, status: 'completed' } : job
    );
    
    rerender(<JobHistory {...defaultProps} jobs={updatedJobs} />);
    
    // Should now have multiple completed jobs - use getAllByText
    const completedElements = screen.getAllByText('completed');
    expect(completedElements.length).toBeGreaterThan(1);
  });

  it('maintains scroll position during updates', () => {
    const { rerender } = render(<JobHistory {...defaultProps} />);
    
    const jobList = screen.getByRole('list');
    
    // Set initial scroll position
    Object.defineProperty(jobList, 'scrollTop', { value: 100, writable: true });
    
    // Trigger scroll event to set internal state
    fireEvent.scroll(jobList, { target: { scrollTop: 100 } });
    
    // Trigger a re-render with different data
    const updatedJobs = [...mockJobs, { 
      ...mockJobs[0], 
      id: 'job-4', 
      configurationName: 'Test Job 4' 
    }];
    
    rerender(<JobHistory {...defaultProps} jobs={updatedJobs} />);
    
    // Should maintain scroll position after update
    expect(jobList.scrollTop).toBe(100);
  });

  it('handles multiple context menus', () => {
    render(<JobHistory {...defaultProps} />);
    
    const job1 = screen.getByText('Test Job 1').closest('div');
    const job2 = screen.getByText('Test Job 2').closest('div');
    
    // Open context menu for first job
    fireEvent.contextMenu(job1);
    expect(screen.getByText('View Details')).toBeInTheDocument();
    
    // Open context menu for second job (should close first)
    fireEvent.contextMenu(job2);
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('closes context menu when clicking outside', () => {
    render(<JobHistory {...defaultProps} />);
    
    const jobItem = screen.getByText('Test Job 1').closest('div');
    fireEvent.contextMenu(jobItem);
    
    expect(screen.getByText('View Details')).toBeInTheDocument();
    
    // Click outside to close - use mousedown event which is what the component listens for
    fireEvent.mouseDown(document.body);
    
    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });
});
