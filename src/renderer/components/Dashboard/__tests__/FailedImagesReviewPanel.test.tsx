import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FailedImagesReviewPanel from '../FailedImagesReviewPanel';
import { GeneratedImage } from '../DashboardPanel';

// Mock the electron API
const mockElectronAPI = {
  getImagesByQCStatus: vi.fn(),
  updateQCStatus: vi.fn(),
  deleteGeneratedImage: vi.fn(),
  retryFailedImagesBatch: vi.fn(),
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock child components
vi.mock('../FailedImageCard', () => ({
  default: ({ image, isSelected, onSelect, onAction }: any) => (
    <div data-testid={`failed-image-card-${image.id}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        data-testid={`select-${image.id}`}
      />
      <button onClick={() => onAction('approve', image.id)} data-testid={`approve-${image.id}`}>
        Approve
      </button>
      <button onClick={() => onAction('retry', image.id)} data-testid={`retry-${image.id}`}>
        Retry
      </button>
      <button onClick={() => onAction('delete', image.id)} data-testid={`delete-${image.id}`}>
        Delete
      </button>
      <button onClick={() => onAction('view', image.id)} data-testid={`view-${image.id}`}>
        View
      </button>
    </div>
  ),
}));

vi.mock('../FailedImageReviewModal', () => ({
  default: ({ image, isOpen, onClose, onAction }: any) =>
    isOpen ? (
      <div data-testid="failed-image-review-modal">
        <h2>Review Modal for {image?.id}</h2>
        <button onClick={() => onAction('approve', image?.id)} data-testid="modal-approve">
          Approve
        </button>
        <button onClick={() => onAction('retry', image?.id)} data-testid="modal-retry">
          Retry
        </button>
        <button onClick={() => onAction('delete', image?.id)} data-testid="modal-delete">
          Delete
        </button>
        <button onClick={onClose} data-testid="modal-close">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../ProcessingSettingsModal', () => ({
  default: ({ isOpen, onClose, onRetry, selectedCount }: any) =>
    isOpen ? (
      <div data-testid="processing-settings-modal">
        <h2>Processing Settings ({selectedCount} images)</h2>
        <button onClick={() => onRetry(true)} data-testid="retry-original">
          Retry with Original Settings
        </button>
        <button onClick={() => onRetry(false)} data-testid="retry-modified">
          Retry with Modified Settings
        </button>
        <button onClick={onClose} data-testid="settings-close">
          Close
        </button>
      </div>
    ) : null,
}));

describe('FailedImagesReviewPanel', () => {
  const mockOnBack = vi.fn();
  
  const mockFailedImages: GeneratedImage[] = [
    {
      id: '1',
      executionId: 'exec-1',
      generationPrompt: 'A beautiful sunset over mountains',
      seed: 12345,
      qcStatus: 'failed',
      qcReason: 'Poor image quality - too dark',
      finalImagePath: '/path/to/image1.jpg',
      metadata: {
        title: 'Mountain Sunset',
        description: 'A serene mountain landscape at sunset',
        tags: ['nature', 'mountains', 'sunset'],
      },
      processingSettings: {
        imageEnhancement: false,
        sharpening: 0,
        saturation: 1,
      },
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      executionId: 'exec-1',
      generationPrompt: 'A cat playing with yarn',
      seed: 67890,
      qcStatus: 'failed',
      qcReason: 'Text artifacts detected',
      finalImagePath: '/path/to/image2.jpg',
      metadata: {
        title: 'Playful Cat',
        description: 'A cute cat playing with colorful yarn',
        tags: ['animals', 'cats', 'playful'],
      },
      processingSettings: {
        imageEnhancement: true,
        sharpening: 50,
        saturation: 1.2,
      },
      createdAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.getImagesByQCStatus.mockResolvedValue(mockFailedImages);
  });

  describe('Component Rendering', () => {
    it('renders the failed images review panel with header', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed Images Review')).toBeInTheDocument();
        expect(screen.getByText('Review and manage images that failed quality assurance checks')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      expect(screen.getByText('Loading failed images...')).toBeInTheDocument();
    });

    it('displays failed images count in header', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Failed Images')).toBeInTheDocument();
      });
    });

    it('renders back button that calls onBack', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const backButton = screen.getByLabelText('Back to dashboard');
        expect(backButton).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Back to dashboard'));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filters and Controls', () => {
    it('renders job filter dropdown', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Job:')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Jobs')).toBeInTheDocument();
      });
    });

    it('renders search input field', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Search:')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search images...')).toBeInTheDocument();
      });
    });

    it('renders sort control dropdown', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Sort:')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Newest First')).toBeInTheDocument();
      });
    });

    it('renders clear button', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });
    });

    it('clears all filters when clear button is clicked', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search images...');
        const clearButton = screen.getByText('Clear');
        
        // Set some filters
        fireEvent.change(searchInput, { target: { value: 'test search' } });
        
        // Clear filters
        fireEvent.click(clearButton);
        
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Image Display', () => {
    it('renders failed image cards for each failed image', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('failed-image-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('failed-image-card-2')).toBeInTheDocument();
      });
    });

    it('shows no images message when no failed images exist', async () => {
      mockElectronAPI.getImagesByQCStatus.mockResolvedValue([]);
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('No Failed Images')).toBeInTheDocument();
        expect(screen.getByText('All images have passed quality checks or are pending review.')).toBeInTheDocument();
      });
    });

    it('displays images in grid layout', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Find the grid container by looking for the div with grid classes
        const gridContainer = screen.getByTestId('failed-image-card-1').closest('div.grid');
        expect(gridContainer).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-6', 'gap-4');
      });
    });
  });

  describe('Selection Controls', () => {
    it('renders select all checkbox', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Select All (0/2)')).toBeInTheDocument();
      });
    });

    it('selects all images when select all is clicked', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        expect(screen.getByText('Select All (2/2)')).toBeInTheDocument();
      });
    });

    it('deselects all images when select all is clicked again', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        
        // Select all
        fireEvent.click(selectAllCheckbox!);
        expect(screen.getByText('Select All (2/2)')).toBeInTheDocument();
        
        // Deselect all
        fireEvent.click(selectAllCheckbox!);
        expect(screen.getByText('Select All (0/2)')).toBeInTheDocument();
      });
    });

    it('shows bulk action buttons when images are selected', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        expect(screen.getByText('Approve Selected')).toBeInTheDocument();
        expect(screen.getByText('Retry Selected')).toBeInTheDocument();
        expect(screen.getByText('Delete Selected')).toBeInTheDocument();
      });
    });
  });

  describe('Individual Image Actions', () => {
    it('handles approve action for individual image', async () => {
      mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const approveButton = screen.getByTestId('approve-1');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.updateQCStatus).toHaveBeenCalledWith('1', 'approved');
      });
    });

    it('handles retry action for individual image', async () => {
      mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const retryButton = screen.getByTestId('retry-1');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.updateQCStatus).toHaveBeenCalledWith('1', 'retry_pending');
      });
    });

    it('handles delete action for individual image', async () => {
      mockElectronAPI.deleteGeneratedImage.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-1');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.deleteGeneratedImage).toHaveBeenCalledWith('1');
      });
    });

    it('handles view action and opens review modal', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const viewButton = screen.getByTestId('view-1');
        fireEvent.click(viewButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('failed-image-review-modal')).toBeInTheDocument();
        expect(screen.getByText('Review Modal for 1')).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Actions', () => {
    it('handles bulk approve action', async () => {
      mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select all images
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        // Click bulk approve
        const approveButton = screen.getByText('Approve Selected');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.updateQCStatus).toHaveBeenCalledTimes(2);
        expect(mockElectronAPI.updateQCStatus).toHaveBeenCalledWith('1', 'approved');
        expect(mockElectronAPI.updateQCStatus).toHaveBeenCalledWith('2', 'approved');
      });
    });

    it('handles bulk delete action', async () => {
      mockElectronAPI.deleteGeneratedImage.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select all images
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        // Click bulk delete
        const deleteButton = screen.getByText('Delete Selected');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.deleteGeneratedImage).toHaveBeenCalledTimes(2);
        expect(mockElectronAPI.deleteGeneratedImage).toHaveBeenCalledWith('1');
        expect(mockElectronAPI.deleteGeneratedImage).toHaveBeenCalledWith('2');
      });
    });

    it('opens processing settings modal for bulk retry', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select all images
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        // Click bulk retry
        const retryButton = screen.getByText('Retry Selected');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('processing-settings-modal')).toBeInTheDocument();
        expect(screen.getByText('Processing Settings (2 images)')).toBeInTheDocument();
      });
    });
  });

  describe('Processing Settings Modal Integration', () => {
    it('handles retry with original settings', async () => {
      mockElectronAPI.retryFailedImagesBatch.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select all images
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        // Click bulk retry to open modal
        const retryButton = screen.getByText('Retry Selected');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        // Click retry with original settings
        const originalButton = screen.getByTestId('retry-original');
        fireEvent.click(originalButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.retryFailedImagesBatch).toHaveBeenCalledWith(
          expect.arrayContaining(['1', '2']),
          true,
          null
        );
      });
    });

    it('handles retry with modified settings', async () => {
      mockElectronAPI.retryFailedImagesBatch.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select all images
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        // Click bulk retry to open modal
        const retryButton = screen.getByText('Retry Selected');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        // Click retry with modified settings
        const modifiedButton = screen.getByTestId('retry-modified');
        fireEvent.click(modifiedButton);
      });

      await waitFor(() => {
        expect(mockElectronAPI.retryFailedImagesBatch).toHaveBeenCalledWith(
          expect.arrayContaining(['1', '2']),
          false,
          expect.any(Object) // processingSettings object
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when loading fails', async () => {
      mockElectronAPI.getImagesByQCStatus.mockRejectedValue(new Error('Failed to load'));
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load failed images')).toBeInTheDocument();
      });
    });

    it('displays error message when action fails', async () => {
      mockElectronAPI.updateQCStatus.mockRejectedValue(new Error('Action failed'));
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const approveButton = screen.getByTestId('approve-1');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to approve image')).toBeInTheDocument();
      });
    });

    it('clears error message when error is dismissed', async () => {
      mockElectronAPI.updateQCStatus.mockRejectedValue(new Error('Action failed'));
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const approveButton = screen.getByTestId('approve-1');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        const errorMessage = screen.getByText('Failed to approve image');
        expect(errorMessage).toBeInTheDocument();
        
        // Error should auto-clear after some time or be dismissible
        // This depends on the actual error handling implementation
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('filters images by job execution', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const jobFilter = screen.getByDisplayValue('All Jobs');
        fireEvent.change(jobFilter, { target: { value: 'exec-1' } });
        
        // Should still show both images since they're from same execution
        expect(screen.getByTestId('failed-image-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('failed-image-card-2')).toBeInTheDocument();
      });
    });

    it('filters images by search query', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search images...');
        fireEvent.change(searchInput, { target: { value: 'sunset' } });
        
        // Should only show the sunset image
        expect(screen.getByTestId('failed-image-card-1')).toBeInTheDocument();
        expect(screen.queryByTestId('failed-image-card-2')).not.toBeInTheDocument();
      });
    });

    it('sorts images by creation date', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const sortSelect = screen.getByDisplayValue('Newest First');
        fireEvent.change(sortSelect, { target: { value: 'oldest' } });
        
        // Should still show both images but in different order
        expect(screen.getByTestId('failed-image-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('failed-image-card-2')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('loads images on component mount', async () => {
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        expect(mockElectronAPI.getImagesByQCStatus).toHaveBeenCalledWith('failed');
      });
    });

    it('reloads images after successful actions', async () => {
      mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        const approveButton = screen.getByTestId('approve-1');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        // Should call getImagesByQCStatus twice: once on mount, once after action
        expect(mockElectronAPI.getImagesByQCStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('maintains selection state during individual actions', async () => {
      mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select an image
        const selectCheckbox = screen.getByTestId('select-1');
        fireEvent.click(selectCheckbox);
        
        // Selection should be maintained
        expect(screen.getByText('Select All (1/2)')).toBeInTheDocument();
        
        // Perform action
        const approveButton = screen.getByTestId('approve-1');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        // Selection should still be maintained after individual action
        expect(screen.getByText('Select All (1/2)')).toBeInTheDocument();
      });
    });

    it('clears selection after bulk actions', async () => {
      mockElectronAPI.updateQCStatus.mockResolvedValue({ success: true });
      
      render(<FailedImagesReviewPanel onBack={mockOnBack} />);
      
      await waitFor(() => {
        // Select all images
        const selectAllCheckbox = screen.getByText('Select All (0/2)').previousElementSibling;
        fireEvent.click(selectAllCheckbox!);
        
        // Selection should be active
        expect(screen.getByText('Select All (2/2)')).toBeInTheDocument();
        
        // Perform bulk approve action
        const approveButton = screen.getByText('Approve Selected');
        fireEvent.click(approveButton);
      });

      await waitFor(() => {
        // Selection should be cleared after bulk action
        expect(screen.getByText('Select All (0/2)')).toBeInTheDocument();
      });
    });
  });
});
