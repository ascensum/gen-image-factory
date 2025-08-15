import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import JobTable from '../JobTable';
import { JobExecution } from '../../../../types/job';

// Mock data
const mockJobs: JobExecution[] = [
  {
    id: 1,
    label: 'Test Job 1',
    status: 'completed',
    createdAt: '2024-01-01T10:00:00Z',
    startedAt: '2024-01-01T10:00:00Z',
    completedAt: '2024-01-01T10:05:00Z',
    imageCount: 5,
    configurationId: 'config1'
  },
  {
    id: 2,
    label: 'Test Job 2',
    status: 'failed',
    createdAt: '2024-01-01T11:00:00Z',
    startedAt: '2024-01-01T11:00:00Z',
    completedAt: '2024-01-01T11:02:00Z',
    imageCount: 3,
    configurationId: 'config2'
  },
  {
    id: 3,
    label: 'Test Job 3',
    status: 'processing',
    createdAt: '2024-01-01T12:00:00Z',
    startedAt: '2024-01-01T12:00:00Z',
    completedAt: undefined,
    imageCount: 0,
    configurationId: 'config3'
  }
];

const defaultProps = {
  jobs: mockJobs,
  selectedJobs: new Set<number>(),
  onJobSelect: vi.fn(),
  onJobRename: vi.fn(),
  onSort: vi.fn(),
  sortField: 'createdAt' as keyof JobExecution,
  sortDirection: 'desc' as 'asc' | 'desc',
  currentPage: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
  pageSize: 25,
  onPageSizeChange: vi.fn()
};

describe('JobTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders job table with correct headers', () => {
    render(<JobTable {...defaultProps} />);
    
    expect(screen.getByText('Job Executions')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders all jobs in the table', () => {
    render(<JobTable {...defaultProps} />);
    
    expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    expect(screen.getByText('Test Job 2')).toBeInTheDocument();
    expect(screen.getByText('Test Job 3')).toBeInTheDocument();
  });

  it('displays job status badges with correct colors', () => {
    render(<JobTable {...defaultProps} />);
    
    const completedStatus = screen.getByText('completed');
    const failedStatus = screen.getByText('failed');
    const processingStatus = screen.getByText('processing');
    
    expect(completedStatus).toHaveClass('text-green-600', 'bg-green-100');
    expect(failedStatus).toHaveClass('text-red-600', 'bg-red-100');
    expect(processingStatus).toHaveClass('text-blue-600', 'bg-blue-100');
  });

  it('handles job selection correctly', () => {
    render(<JobTable {...defaultProps} />);
    
    const firstJobCheckbox = screen.getAllByRole('checkbox')[1]; // First job checkbox (index 0 is select all)
    fireEvent.click(firstJobCheckbox);
    
    expect(defaultProps.onJobSelect).toHaveBeenCalledWith(1, true);
  });

  it('handles select all functionality', () => {
    render(<JobTable {...defaultProps} />);
    
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(selectAllCheckbox);
    
    expect(defaultProps.onJobSelect).toHaveBeenCalledWith(1, true);
    expect(defaultProps.onJobSelect).toHaveBeenCalledWith(2, true);
    expect(defaultProps.onJobSelect).toHaveBeenCalledWith(3, true);
  });

  it('shows indeterminate state when some jobs are selected', () => {
    const selectedJobs = new Set([1, 2]);
    render(<JobTable {...defaultProps} selectedJobs={selectedJobs} />);
    
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(selectAllCheckbox.indeterminate).toBe(true);
  });

  it('handles inline editing of job labels', async () => {
    render(<JobTable {...defaultProps} />);
    
    // Click edit button for first job
    const editButtons = screen.getAllByLabelText(/Edit label for job/);
    fireEvent.click(editButtons[0]);
    
    // Should show edit input
    const editInput = screen.getByDisplayValue('Test Job 1');
    expect(editInput).toBeInTheDocument();
    
    // Type new label
    fireEvent.change(editInput, { target: { value: 'Updated Job 1' } });
    
    // Click save button
    const saveButton = screen.getByLabelText('Save label');
    fireEvent.click(saveButton);
    
    expect(defaultProps.onJobRename).toHaveBeenCalledWith(1, 'Updated Job 1');
  });

  it('handles inline editing cancellation', () => {
    render(<JobTable {...defaultProps} />);
    
    // Start editing
    const editButtons = screen.getAllByLabelText(/Edit label for job/);
    fireEvent.click(editButtons[0]);
    
    // Should show edit input
    const editInput = screen.getByDisplayValue('Test Job 1');
    expect(editInput).toBeInTheDocument();
    
    // Click cancel button
    const cancelButton = screen.getByLabelText('Cancel editing');
    fireEvent.click(cancelButton);
    
    // Should hide edit input
    expect(screen.queryByDisplayValue('Test Job 1')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation in inline editing', async () => {
    render(<JobTable {...defaultProps} />);
    
    // Start editing
    const editButtons = screen.getAllByLabelText(/Edit label for job/);
    fireEvent.click(editButtons[0]);
    
    const editInput = screen.getByDisplayValue('Test Job 1');
    
    // Test Enter key saves
    fireEvent.change(editInput, { target: { value: 'Updated Job 1' } });
    fireEvent.keyDown(editInput, { key: 'Enter' });
    
    expect(defaultProps.onJobRename).toHaveBeenCalledWith(1, 'Updated Job 1');
  });

  it('handles sorting when clicking column headers', () => {
    render(<JobTable {...defaultProps} />);
    
    const labelHeader = screen.getByText('Label');
    fireEvent.click(labelHeader);
    
    expect(defaultProps.onSort).toHaveBeenCalledWith('label', 'asc');
  });

  it('toggles sort direction when clicking same column', () => {
    const propsWithAscSort = {
      ...defaultProps,
      sortField: 'label' as keyof JobExecution,
      sortDirection: 'asc' as 'asc' | 'desc'
    };
    
    render(<JobTable {...propsWithAscSort} />);
    
    const labelHeader = screen.getByText('Label');
    fireEvent.click(labelHeader);
    
    expect(defaultProps.onSort).toHaveBeenCalledWith('label', 'desc');
  });

  it('displays sort indicators correctly', () => {
    const propsWithAscSort = {
      ...defaultProps,
      sortField: 'label' as keyof JobExecution,
      sortDirection: 'asc' as 'asc' | 'desc'
    };
    
    render(<JobTable {...propsWithAscSort} />);
    
    // Should show up arrow for ascending sort
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('handles pagination correctly', () => {
    const propsWithMultiplePages = {
      ...defaultProps,
      totalPages: 3,
      currentPage: 2
    };
    
    render(<JobTable {...propsWithMultiplePages} />);
    
    // Should show page numbers - use more specific selectors
    const page1Button = screen.getByLabelText('Go to page 1');
    const page2Button = screen.getByLabelText('Go to page 2');
    const page3Button = screen.getByLabelText('Go to page 3');
    
    expect(page1Button).toBeInTheDocument();
    expect(page2Button).toBeInTheDocument();
    expect(page3Button).toBeInTheDocument();
    
    // Current page should be highlighted
    expect(page2Button).toHaveClass('bg-blue-600', 'text-white');
  });

  it('handles page size changes', () => {
    render(<JobTable {...defaultProps} />);
    
    const pageSizeSelect = screen.getByLabelText('Items per page');
    fireEvent.change(pageSizeSelect, { target: { value: '50' } });
    
    expect(defaultProps.onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('formats dates correctly', () => {
    render(<JobTable {...defaultProps} />);
    
    // Should format dates to locale string - use more specific selector
    const dateCells = screen.getAllByText('1/1/2024');
    expect(dateCells.length).toBeGreaterThan(0);
    expect(dateCells[0]).toBeInTheDocument();
  });

  it('formats duration correctly', () => {
    render(<JobTable {...defaultProps} />);
    
    // Completed job should show duration
    expect(screen.getByText('5m')).toBeInTheDocument();
    
    // Processing job should show "In Progress"
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('displays image count correctly', () => {
    render(<JobTable {...defaultProps} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('handles empty jobs array', () => {
    render(<JobTable {...defaultProps} jobs={[]} />);
    
    // Should still render table structure
    expect(screen.getByText('Job Executions')).toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 0 jobs on page 1 of 1')).toBeInTheDocument();
  });

  it('applies correct styling for selected jobs', () => {
    const selectedJobs = new Set([1]);
    render(<JobTable {...defaultProps} selectedJobs={selectedJobs} />);
    
    const firstJobRow = screen.getByText('Test Job 1').closest('tr');
    expect(firstJobRow).toHaveClass('bg-blue-50');
  });

  it('handles keyboard navigation for pagination', () => {
    const propsWithMultiplePages = {
      ...defaultProps,
      totalPages: 3,
      currentPage: 2
    };
    
    render(<JobTable {...propsWithMultiplePages} />);
    
    const page1Button = screen.getByLabelText('Go to page 1');
    fireEvent.keyDown(page1Button, { key: 'Enter' });
    
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);
  });

  it('prevents invalid page navigation', () => {
    render(<JobTable {...defaultProps} />);
    
    const prevButton = screen.getByText('Previous');
    fireEvent.click(prevButton);
    
    // Should not call onPageChange for invalid page
    expect(defaultProps.onPageChange).not.toHaveBeenCalled();
  });

  it('shows correct pagination info', () => {
    render(<JobTable {...defaultProps} />);
    
    expect(screen.getByText('Showing 3 of 3 jobs on page 1 of 1')).toBeInTheDocument();
  });

  it('handles large page sizes correctly', () => {
    const propsWithLargePageSize = {
      ...defaultProps,
      pageSize: 100
    };
    
    render(<JobTable {...propsWithLargePageSize} />);
    
    const pageSizeSelect = screen.getByLabelText('Items per page') as HTMLSelectElement;
    expect(pageSizeSelect.value).toBe('100');
  });
});
