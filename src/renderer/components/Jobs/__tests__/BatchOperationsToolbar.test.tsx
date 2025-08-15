import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import BatchOperationsToolbar from '../BatchOperationsToolbar';

const defaultProps = {
  selectedCount: 3,
  totalJobs: 10,
  onBulkRerun: vi.fn(),
  onBulkExport: vi.fn(),
  onBulkDelete: vi.fn(),
  onSelectAll: vi.fn(),
  isAllSelected: false,
  isIndeterminate: true,
  isLoading: false,
  disabled: false
};

describe('BatchOperationsToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders toolbar with selection summary', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    expect(screen.getByText('3 of 10 jobs selected')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('renders select all checkbox with correct state', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all jobs' }) as HTMLInputElement;
    expect(selectAllCheckbox.checked).toBe(false);
    expect(selectAllCheckbox.indeterminate).toBe(true);
  });

  it('handles select all checkbox changes', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all jobs' });
    fireEvent.click(selectAllCheckbox);
    
    expect(defaultProps.onSelectAll).toHaveBeenCalledWith(true);
  });

  it('shows indeterminate state when some jobs are selected', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all jobs' }) as HTMLInputElement;
    expect(selectAllCheckbox.indeterminate).toBe(true);
  });

  it('shows all selected state when all jobs are selected', () => {
    const propsWithAllSelected = {
      ...defaultProps,
      isAllSelected: true,
      isIndeterminate: false
    };
    
    render(<BatchOperationsToolbar {...propsWithAllSelected} />);
    
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all jobs' }) as HTMLInputElement;
    expect(selectAllCheckbox.checked).toBe(true);
    expect(selectAllCheckbox.indeterminate).toBe(false);
  });

  it('renders deselect button when all jobs are selected', () => {
    const propsWithAllSelected = {
      ...defaultProps,
      isAllSelected: true,
      isIndeterminate: false
    };
    
    render(<BatchOperationsToolbar {...propsWithAllSelected} />);
    
    expect(screen.getByText('Deselect')).toBeInTheDocument();
  });

  it('handles deselect all when all jobs are selected', () => {
    const propsWithAllSelected = {
      ...defaultProps,
      isAllSelected: true,
      isIndeterminate: false
    };
    
    render(<BatchOperationsToolbar {...propsWithAllSelected} />);
    
    const deselectButton = screen.getByText('Deselect');
    fireEvent.click(deselectButton);
    
    expect(defaultProps.onSelectAll).toHaveBeenCalledWith(false);
  });

  it('renders batch operation buttons', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    expect(screen.getByText('Rerun (3)')).toBeInTheDocument();
    expect(screen.getByText('Export (3)')).toBeInTheDocument();
    expect(screen.getByText('Delete (3)')).toBeInTheDocument();
  });

  it('handles bulk rerun operation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const rerunButton = screen.getByText('Rerun (3)');
    fireEvent.click(rerunButton);
    
    expect(defaultProps.onBulkRerun).toHaveBeenCalled();
  });

  it('handles bulk export operation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const exportButton = screen.getByText('Export (3)');
    fireEvent.click(exportButton);
    
    expect(defaultProps.onBulkExport).toHaveBeenCalled();
  });

  it('handles bulk delete operation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    // Should show confirmation dialog first
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    
    // Confirm deletion
    const confirmButton = screen.getByText('Delete Permanently');
    fireEvent.click(confirmButton);
    
    expect(defaultProps.onBulkDelete).toHaveBeenCalled();
  });

  it('shows confirmation dialog for delete operation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete 3 selected job/)).toBeInTheDocument();
  });

  it('handles delete confirmation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    // Open delete dialog
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    // Confirm deletion
    const confirmButton = screen.getByText('Delete Permanently');
    fireEvent.click(confirmButton);
    
    expect(defaultProps.onBulkDelete).toHaveBeenCalled();
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('handles delete cancellation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    // Open delete dialog
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    // Cancel deletion
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onBulkDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation for delete operation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const deleteButton = screen.getByText('Delete (3)');
    
    // Test Enter key
    fireEvent.keyDown(deleteButton, { key: 'Enter' });
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
  });

  it('handles keyboard navigation for delete confirmation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    // Open delete dialog
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    const confirmButton = screen.getByText('Delete Permanently');
    
    // Test Enter key
    fireEvent.keyDown(confirmButton, { key: 'Enter' });
    expect(defaultProps.onBulkDelete).toHaveBeenCalled();
  });

  it('handles keyboard navigation for delete cancellation', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    // Open delete dialog
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    const cancelButton = screen.getByText('Cancel');
    
    // Test Enter key
    fireEvent.keyDown(cancelButton, { key: 'Enter' });
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('disables buttons when no jobs are selected', () => {
    const propsWithNoSelection = {
      ...defaultProps,
      selectedCount: 0
    };
    
    render(<BatchOperationsToolbar {...propsWithNoSelection} />);
    
    const rerunButton = screen.getByRole('button', { name: 'Rerun 0 selected jobs' });
    const exportButton = screen.getByRole('button', { name: 'Export 0 selected jobs' });
    const deleteButton = screen.getByRole('button', { name: 'Delete 0 selected jobs' });
    
    expect(rerunButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it('disables buttons when loading', () => {
    const propsWithLoading = {
      ...defaultProps,
      isLoading: true
    };
    
    render(<BatchOperationsToolbar {...propsWithLoading} />);
    
    const rerunButton = screen.getByRole('button', { name: 'Rerun 3 selected jobs' });
    const exportButton = screen.getByRole('button', { name: 'Export 3 selected jobs' });
    const deleteButton = screen.getByRole('button', { name: 'Delete 3 selected jobs' });
    
    expect(rerunButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it('disables buttons when disabled prop is true', () => {
    const propsWithDisabled = {
      ...defaultProps,
      disabled: true
    };
    
    render(<BatchOperationsToolbar {...propsWithDisabled} />);
    
    const rerunButton = screen.getByRole('button', { name: 'Rerun 3 selected jobs' });
    const exportButton = screen.getByRole('button', { name: 'Export 3 selected jobs' });
    const deleteButton = screen.getByRole('button', { name: 'Delete 3 selected jobs' });
    
    expect(rerunButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it('shows loading state when processing', () => {
    const propsWithLoading = {
      ...defaultProps,
      isLoading: true
    };
    
    render(<BatchOperationsToolbar {...propsWithLoading} />);
    
    expect(screen.getByText('Processing batch operation...')).toBeInTheDocument();
    // The component shows a loading spinner and text, but doesn't have role="status"
  });

  it('shows no selection state when no jobs are selected', () => {
    const propsWithNoSelection = {
      ...defaultProps,
      selectedCount: 0
    };
    
    render(<BatchOperationsToolbar {...propsWithNoSelection} />);
    
    expect(screen.getByText('Select one or more jobs to perform batch operations.')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts help', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    expect(screen.getByText(/Keyboard shortcuts:/)).toBeInTheDocument();
    expect(screen.getByText('Ctrl+A')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('handles edge case with single job selection', () => {
    const propsWithSingleSelection = {
      ...defaultProps,
      selectedCount: 1
    };
    
    render(<BatchOperationsToolbar {...propsWithSingleSelection} />);
    
    expect(screen.getByText('1 of 10 jobs selected')).toBeInTheDocument();
    expect(screen.getByText('Rerun (1)')).toBeInTheDocument();
    expect(screen.getByText('Export (1)')).toBeInTheDocument();
    expect(screen.getByText('Delete (1)')).toBeInTheDocument();
  });

  it('handles edge case with all jobs selected', () => {
    const propsWithAllSelected = {
      ...defaultProps,
      selectedCount: 10,
      isAllSelected: true,
      isIndeterminate: false
    };
    
    render(<BatchOperationsToolbar {...propsWithAllSelected} />);
    
    expect(screen.getByText('All 10 jobs selected')).toBeInTheDocument();
  });

  it('prevents delete operation when no jobs are selected', () => {
    const propsWithNoSelection = {
      ...defaultProps,
      selectedCount: 0
    };
    
    render(<BatchOperationsToolbar {...propsWithNoSelection} />);
    
    const deleteButton = screen.getByText('Delete (0)');
    fireEvent.click(deleteButton);
    
    expect(defaultProps.onBulkDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('prevents delete operation when loading', () => {
    const propsWithLoading = {
      ...defaultProps,
      isLoading: true
    };
    
    render(<BatchOperationsToolbar {...propsWithLoading} />);
    
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    expect(defaultProps.onBulkDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('prevents delete operation when disabled', () => {
    const propsWithDisabled = {
      ...defaultProps,
      disabled: true
    };
    
    render(<BatchOperationsToolbar {...propsWithDisabled} />);
    
    const deleteButton = screen.getByText('Delete (3)');
    fireEvent.click(deleteButton);
    
    expect(defaultProps.onBulkDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('shows correct selection text for different states', () => {
    // No selection
    const { rerender } = render(<BatchOperationsToolbar {...defaultProps} selectedCount={0} />);
    expect(screen.getByText('No jobs selected')).toBeInTheDocument();
    
    // Some selection
    rerender(<BatchOperationsToolbar {...defaultProps} selectedCount={3} />);
    expect(screen.getByText('3 of 10 jobs selected')).toBeInTheDocument();
    
    // All selected
    rerender(<BatchOperationsToolbar {...defaultProps} selectedCount={10} isAllSelected={true} />);
    expect(screen.getByText('All 10 jobs selected')).toBeInTheDocument();
  });

  it('applies correct ARIA labels and descriptions', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all jobs' });
    expect(selectAllCheckbox).toHaveAttribute('aria-describedby', 'select-all-help');
    
    const rerunButton = screen.getByRole('button', { name: 'Rerun 3 selected jobs' });
    expect(rerunButton).toHaveAttribute('aria-describedby', 'rerun-help');
    
    const exportButton = screen.getByRole('button', { name: 'Export 3 selected jobs' });
    expect(exportButton).toHaveAttribute('aria-describedby', 'export-help');
    
    const deleteButton = screen.getByRole('button', { name: 'Delete 3 selected jobs' });
    expect(deleteButton).toHaveAttribute('aria-describedby', 'delete-help');
  });

  it('shows help text for operations', () => {
    render(<BatchOperationsToolbar {...defaultProps} />);
    
    expect(screen.getByText('Rerun selected jobs with their original settings')).toBeInTheDocument();
    expect(screen.getByText('Export selected jobs and their generated images')).toBeInTheDocument();
    expect(screen.getByText('Permanently delete selected jobs and their data')).toBeInTheDocument();
  });
});
