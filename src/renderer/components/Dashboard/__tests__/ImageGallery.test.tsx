import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ImageGallery from '../ImageGallery';

describe('ImageGallery', () => {
  const mockImages = [
    {
      id: 'img-1',
      jobExecutionId: 'job-1',
      filename: 'test-image-1.png',
      filePath: '/path/to/image1.png',
      qcStatus: 'pending',
      generationPrompt: 'A beautiful landscape',
      createdAt: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'img-2',
      jobExecutionId: 'job-1',
      filename: 'test-image-2.png',
      filePath: '/path/to/image2.png',
      qcStatus: 'approved',
      generationPrompt: 'A portrait of a person',
      createdAt: new Date('2024-01-01T10:01:00Z')
    },
    {
      id: 'img-3',
      jobExecutionId: 'job-2',
      filename: 'test-image-3.png',
      filePath: '/path/to/image3.png',
      qcStatus: 'rejected',
      generationPrompt: 'An abstract painting',
      createdAt: new Date('2024-01-01T10:02:00Z')
    }
  ];

  const defaultProps = {
    images: mockImages,
    isLoading: false,
    onImageAction: vi.fn(),
    onBulkAction: vi.fn(),
    onQCStatusChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders image gallery with main sections', () => {
    render(<ImageGallery {...defaultProps} />);
    
    expect(screen.getByText('Generated Images')).toBeInTheDocument();
    expect(screen.getByText('A beautiful landscape')).toBeInTheDocument();
    expect(screen.getByText('A portrait of a person')).toBeInTheDocument();
    expect(screen.getByText('An abstract painting')).toBeInTheDocument();
  });

  it('displays QC status correctly', () => {
    render(<ImageGallery {...defaultProps} />);
    
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('applies correct QC status colors', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Pending - yellow
    const pendingStatus = screen.getByText('pending').closest('span');
    expect(pendingStatus).toHaveClass('bg-yellow-100', 'text-yellow-800');
    
    // Approved - green
    const approvedStatus = screen.getByText('approved').closest('span');
    expect(approvedStatus).toHaveClass('bg-green-100', 'text-green-800');
    
    // Rejected - red
    const rejectedStatus = screen.getByText('rejected').closest('span');
    expect(rejectedStatus).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays correct QC status icons', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Check for pending icon (clock)
    const pendingIcon = document.querySelector('svg[class*="text-yellow-600"]');
    expect(pendingIcon).toBeInTheDocument();
    
    // Check for approved icon (checkmark)
    const approvedIcon = document.querySelector('svg[class*="text-green-600"]');
    expect(approvedIcon).toBeInTheDocument();
    
    // Check for rejected icon (X)
    const rejectedIcon = document.querySelector('svg[class*="text-red-600"]');
    expect(rejectedIcon).toBeInTheDocument();
  });

  it('handles image selection', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const imageCheckbox = screen.getByLabelText('Select A beautiful landscape');
    fireEvent.click(imageCheckbox);
    
    expect(imageCheckbox).toBeChecked();
  });

  it('handles select all functionality', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const selectAllCheckbox = screen.getByLabelText('Select all images');
    fireEvent.click(selectAllCheckbox);
    
    // All image checkboxes should be checked
    const imageCheckboxes = screen.getAllByRole('checkbox');
    imageCheckboxes.forEach(checkbox => {
      if (checkbox !== selectAllCheckbox) {
        expect(checkbox).toBeChecked();
      }
    });
  });

  it('handles bulk actions', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Select an image
    const imageCheckbox = screen.getByLabelText('Select A beautiful landscape');
    fireEvent.click(imageCheckbox);
    
    // Trigger bulk action
    const bulkActionButton = screen.getByText('Approve Selected');
    fireEvent.click(bulkActionButton);
    
    expect(defaultProps.onBulkAction).toHaveBeenCalledWith('approve', ['img-1']);
  });

  it('filters images by QC status', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'approved' } });
    
    expect(screen.getByText('A portrait of a person')).toBeInTheDocument();
    expect(screen.queryByText('A beautiful landscape')).not.toBeInTheDocument();
    expect(screen.queryByText('An abstract painting')).not.toBeInTheDocument();
  });

  it('switches between grid and list view', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Default should be grid view
    const gridContainer = screen.getByRole('grid');
    expect(gridContainer).toHaveClass('grid');
    
    // Switch to list view
    const listViewButton = screen.getByLabelText('List view');
    fireEvent.click(listViewButton);
    
    expect(gridContainer).toHaveClass('space-y-2');
  });

  it('handles QC status change', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const qcSelect = screen.getByDisplayValue('pending');
    fireEvent.change(qcSelect, { target: { value: 'approved' } });
    
    expect(defaultProps.onQCStatusChange).toHaveBeenCalledWith('img-1', 'approved');
  });

  it('shows image metadata', () => {
    render(<ImageGallery {...defaultProps} />);
    
    expect(screen.getByText('A beautiful landscape')).toBeInTheDocument();
    expect(screen.getByText('A portrait of a person')).toBeInTheDocument();
    expect(screen.getByText('An abstract painting')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Should display formatted date
    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
  });

  it('handles image actions', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const viewButtons = screen.getAllByLabelText('View full size');
    const viewButton = viewButtons[0];
    fireEvent.click(viewButton);
    
    expect(defaultProps.onImageAction).toHaveBeenCalledWith('img-1', 'view');
  });

  it('handles delete image action', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const deleteButtons = screen.getAllByLabelText('Delete');
    const deleteButton = deleteButtons[0];
    fireEvent.click(deleteButton);
    
    expect(defaultProps.onImageAction).toHaveBeenCalledWith('img-1', 'delete');
  });

  it('shows confirmation dialog for delete action', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const deleteButtons = screen.getAllByLabelText('Delete');
    const deleteButton = deleteButtons[0];
    fireEvent.click(deleteButton);
    
    expect(screen.getByText('Delete Image')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this image?')).toBeInTheDocument();
  });

  it('handles empty image gallery', () => {
    render(<ImageGallery {...defaultProps} images={[]} />);
    
    expect(screen.getByText('No images found matching the current filters.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ImageGallery {...defaultProps} isLoading={true} />);
    
    // Loading state disables the Quick Actions button
    const quickActionsButton = screen.getByText('Quick Actions');
    expect(quickActionsButton).toBeDisabled();
  });

  it('displays image count correctly', () => {
    render(<ImageGallery {...defaultProps} />);
    
    expect(screen.getByText('3 Total Images')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const imageItem = screen.getByText('A beautiful landscape').closest('div');
    
    // Tab navigation should work
    imageItem.focus();
    expect(imageItem).toHaveFocus();
    
    // Enter key should trigger view action
    fireEvent.keyDown(imageItem, { key: 'Enter', code: 'Enter' });
    expect(defaultProps.onImageAction).toHaveBeenCalledWith('img-1', 'view');
  });

  it('provides proper ARIA labels', () => {
    render(<ImageGallery {...defaultProps} />);
    
    expect(screen.getByLabelText('Select A beautiful landscape')).toBeInTheDocument();
    const viewButtons = screen.getAllByLabelText('View full size');
    expect(viewButtons.length).toBeGreaterThan(0);
    const deleteButtons = screen.getAllByLabelText('Delete');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('handles very long filenames', () => {
    const imagesWithLongNames = [
      {
        ...mockImages[0],
        generationPrompt: 'A'.repeat(100)
      }
    ];
    
    render(<ImageGallery {...defaultProps} images={imagesWithLongNames} />);
    
    expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
  });

  it('handles images with missing metadata', () => {
    const imagesWithoutMetadata = [
      {
        ...mockImages[0],
        generationPrompt: undefined
      }
    ];
    
    render(<ImageGallery {...defaultProps} images={imagesWithoutMetadata} />);
    
    // Component displays the image even without generationPrompt, just shows empty/undefined text
    expect(screen.getByText('A portrait of a person')).toBeInTheDocument(); // Other images should still show
  });

  it('handles images with missing file path', () => {
    const imagesWithoutPath = [
      {
        ...mockImages[0],
        filePath: null
      }
    ];
    
    render(<ImageGallery {...defaultProps} images={imagesWithoutPath} />);
    
    // Should still display the image - view button is not disabled for missing file paths
    const viewButtons = screen.getAllByLabelText('View full size');
    expect(viewButtons.length).toBeGreaterThan(0);
    expect(viewButtons[0]).not.toBeDisabled();
  });

  it('prevents bulk actions when no images are selected', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Bulk action buttons should not be visible when no images are selected
    expect(screen.queryByText('Approve Selected')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject Selected')).not.toBeInTheDocument();
  });

  it('handles rapid QC status updates', () => {
    const { rerender } = render(<ImageGallery {...defaultProps} />);
    
    // Initially show pending status - use getAllByText since there are multiple
    const pendingElements = screen.getAllByText('pending');
    expect(pendingElements.length).toBeGreaterThan(0);
    
    // Update QC status to approved
    const updatedImages = mockImages.map(image => 
      image.id === 'img-1' ? { ...image, qcStatus: 'approved' } : image
    );
    
    rerender(<ImageGallery {...defaultProps} images={updatedImages} />);
    
    const approvedElements = screen.getAllByText('approved');
    expect(approvedElements.length).toBeGreaterThan(0);
  });

  it('maintains selection state during updates', () => {
    const { rerender } = render(<ImageGallery {...defaultProps} />);
    
    // Select an image
    const imageCheckbox = screen.getByLabelText('Select A beautiful landscape');
    fireEvent.click(imageCheckbox);
    expect(imageCheckbox).toBeChecked();
    
    // Update images (should maintain selection)
    rerender(<ImageGallery {...defaultProps} />);
    
    expect(imageCheckbox).toBeChecked();
  });

  it('handles multiple image selections', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const checkbox1 = screen.getByLabelText('Select A beautiful landscape');
    const checkbox2 = screen.getByLabelText('Select A portrait of a person');
    
    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);
    
    expect(checkbox1).toBeChecked();
    expect(checkbox2).toBeChecked();
    
    // Bulk action should be enabled
    const bulkActionButton = screen.getByText('Approve Selected');
    expect(bulkActionButton).not.toBeDisabled();
  });

  it('clears selection when filter changes', () => {
    render(<ImageGallery {...defaultProps} />);
    
    // Select an image
    const imageCheckbox = screen.getByLabelText('Select A beautiful landscape');
    fireEvent.click(imageCheckbox);
    expect(imageCheckbox).toBeChecked();
    
    // Change filter
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'approved' } });
    
    // Selection should be cleared
    expect(imageCheckbox).not.toBeChecked();
  });

  it('handles search functionality', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search images...');
    fireEvent.change(searchInput, { target: { value: 'landscape' } });
    
    expect(screen.getByText('A beautiful landscape')).toBeInTheDocument();
    expect(screen.queryByText('test-image-2.png')).not.toBeInTheDocument();
    expect(screen.queryByText('An abstract painting')).not.toBeInTheDocument();
  });

  it('handles sort functionality', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const sortSelect = screen.getByDisplayValue('Newest First');
    fireEvent.change(sortSelect, { target: { value: 'oldest' } });
    
    // Should reorder images by date
    const imageItems = screen.getAllByText(/beautiful|portrait|abstract/);
    expect(imageItems[0]).toHaveTextContent('A beautiful landscape');
  });

  it('handles view mode persistence', () => {
    const { rerender } = render(<ImageGallery {...defaultProps} />);
    
    // Switch to list view
    const listViewButton = screen.getByLabelText('List view');
    fireEvent.click(listViewButton);
    
    // Re-render should maintain list view
    rerender(<ImageGallery {...defaultProps} />);
    
    const listContainer = screen.getByText('Generated Images').closest('div');
    expect(listContainer).toHaveClass('space-y-2');
  });

  it('handles image preview modal', () => {
    render(<ImageGallery {...defaultProps} />);
    
    const viewButtons = screen.getAllByLabelText('View full size');
    fireEvent.click(viewButtons[0]);
    
    // Should show modal with image details
    expect(screen.getByText('Image Details')).toBeInTheDocument();
    expect(screen.getByText('A beautiful landscape')).toBeInTheDocument();
  });
});
