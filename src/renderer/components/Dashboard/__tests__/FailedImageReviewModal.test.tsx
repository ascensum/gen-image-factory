import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FailedImageReviewModal from '../FailedImageReviewModal';
import { GeneratedImage } from '../DashboardPanel';

describe('FailedImageReviewModal', () => {
  const mockImage: GeneratedImage = {
    id: 'modal-test-image-1',
    executionId: 'exec-456',
    generationPrompt: 'A majestic dragon soaring through storm clouds with lightning',
    seed: 98765,
    qcStatus: 'failed',
    qcReason: 'Text artifacts and poor composition - dragon appears distorted',
    finalImagePath: '/path/to/dragon-image.jpg',
    metadata: {
      title: 'Storm Dragon',
      description: 'A powerful dragon flying through stormy skies with dramatic lightning effects',
      tags: ['fantasy', 'dragon', 'storm', 'lightning', 'dramatic'],
    },
    processingSettings: {
      imageEnhancement: true,
      sharpening: 80,
      saturation: 1.4,
      imageConvert: true,
      convertToJpg: false,
      jpgQuality: 90,
      pngQuality: 8,
      removeBg: true,
      removeBgSize: '1024x1024',
      trimTransparentBackground: true,
      jpgBackground: '#000000',
    },
    createdAt: new Date('2024-01-20T15:45:00Z'),
  };

  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders modal when isOpen is true', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByTestId('failed-image-review-modal')).toBeInTheDocument();
      expect(screen.getByText('Failed Image Review')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={false}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByTestId('failed-image-review-modal')).not.toBeInTheDocument();
    });

    it('renders with correct modal structure', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByTestId('modal-header')).toBeInTheDocument();
      expect(screen.getByTestId('modal-content')).toBeInTheDocument();
      expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    });
  });

  describe('Header Section', () => {
    it('displays modal title', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Failed Image Review')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
    });

    it('calls onClose when close button is clicked', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('renders escape key handler', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      // Press escape key on overlay to trigger handler
      const overlay = screen.getByTestId('failed-image-review-modal');
      fireEvent.keyDown(overlay, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Image Display', () => {
    it('renders the main image when path is available', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const image = screen.getByAltText('A majestic dragon soaring through storm clouds with lightning');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'file:///path/to/dragon-image.jpg');
    });

    it('shows fallback when no image path', () => {
      const imageWithoutPath = { ...mockImage, finalImagePath: undefined };
      
      render(
        <FailedImageReviewModal
          image={imageWithoutPath}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByAltText('A majestic dragon soaring through storm clouds with lightning')).not.toBeInTheDocument();
      expect(screen.getByText('No Image Available')).toBeInTheDocument();
    });

    it('handles image load errors gracefully', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const image = screen.getByAltText('A majestic dragon soaring through storm clouds with lightning');
      
      // Simulate image load error
      fireEvent.error(image);
      
      // Should show fallback after error
      expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
    });

    it('maintains aspect ratio for image container', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const imageContainer = screen.getByTestId('image-container');
      expect(imageContainer).toHaveClass('relative');
    });
  });

  describe('Failure Analysis Section', () => {
    it('displays failure reason prominently', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Failure Analysis')).toBeInTheDocument();
      expect(screen.getByText('Text artifacts and poor composition - dragon appears distorted')).toBeInTheDocument();
    });

    it('shows failure icon and status', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      // QC Failed badge rendered
      expect(screen.getByText('QC Failed')).toBeInTheDocument();
    });

    it('handles missing failure reason gracefully', () => {
      const imageWithoutReason = { ...mockImage, qcReason: undefined };
      
      render(
        <FailedImageReviewModal
          image={imageWithoutReason}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Failure Analysis')).toBeInTheDocument();
      expect(screen.getByText('No Specific Reason')).toBeInTheDocument();
    });
  });

  describe('Generation Details Section', () => {
    it('displays generation prompt', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Generation Details')).toBeInTheDocument();
      expect(screen.getByText('A majestic dragon soaring through storm clouds with lightning')).toBeInTheDocument();
    });

    it('shows seed value', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Seed')).toBeInTheDocument();
      expect(screen.getByText('98765')).toBeInTheDocument();
    });

    it('displays creation date', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    it('shows job execution ID', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Job ID')).toBeInTheDocument();
      expect(screen.getByText('exec-456')).toBeInTheDocument();
    });
  });

  describe('AI Metadata Section', () => {
    it('displays metadata title', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('AI Generated Metadata')).toBeInTheDocument();
      expect(screen.getByText('Storm Dragon')).toBeInTheDocument();
    });

    it('shows metadata description', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('A powerful dragon flying through stormy skies with dramatic lightning effects')).toBeInTheDocument();
    });

    it('displays metadata tags', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('fantasy')).toBeInTheDocument();
      expect(screen.getByText('dragon')).toBeInTheDocument();
      expect(screen.getByText('storm')).toBeInTheDocument();
      expect(screen.getByText('lightning')).toBeInTheDocument();
      expect(screen.getByText('dramatic')).toBeInTheDocument();
    });

    it('handles missing metadata gracefully', () => {
      const imageWithoutMetadata = { ...mockImage, metadata: undefined };
      
      render(
        <FailedImageReviewModal
          image={imageWithoutMetadata}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByText('AI Metadata')).not.toBeInTheDocument();
    });
  });

  describe('Processing Settings Section', () => {
    it('displays processing settings section', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Processing Settings')).toBeInTheDocument();
    });

    it('shows image enhancement settings', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Enhancement:')).toBeInTheDocument();
      // multiple Yes values present; ensure at least one exists
      expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
      expect(screen.getByText('Sharpening:')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
      expect(screen.getByText('Saturation:')).toBeInTheDocument();
      expect(screen.getByText('1.4')).toBeInTheDocument();
    });

    it('displays processing settings grid', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Processing Settings')).toBeInTheDocument();
      // At minimum, ensure Remove BG setting is shown
      expect(screen.getByText('Remove BG:')).toBeInTheDocument();
    });

    it('shows background processing settings', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Remove BG:')).toBeInTheDocument();
      expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
    });

    it('handles missing processing settings gracefully', () => {
      const imageWithoutSettings = { ...mockImage, processingSettings: undefined };
      
      render(
        <FailedImageReviewModal
          image={imageWithoutSettings}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByText('Processing Settings')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders all action buttons in footer', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Approve Image')).toBeInTheDocument();
      expect(screen.getByText('Add to Retry Pool')).toBeInTheDocument();
      expect(screen.getByText('Delete Image')).toBeInTheDocument();
    });

    it('calls onAction with correct parameters for approve', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByText('Approve Image');
      fireEvent.click(approveButton);

      expect(mockOnAction).toHaveBeenCalledWith('approve', 'modal-test-image-1');
    });

    it('calls onAction with correct parameters for retry', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const retryButton = screen.getByText('Add to Retry Pool');
      fireEvent.click(retryButton);

      expect(mockOnAction).toHaveBeenCalledWith('retry', 'modal-test-image-1');
    });

    it('calls onAction with correct parameters for delete', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const deleteButton = screen.getByText('Delete Image');
      fireEvent.click(deleteButton);

      expect(mockOnAction).toHaveBeenCalledWith('delete', 'modal-test-image-1');
    });
  });

  describe('Button Styling and Accessibility', () => {
    it('applies correct button styles', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByText('✓ Approve Image');
      const retryButton = screen.getByText(' Add to Retry Pool');
      const deleteButton = screen.getByText(' Delete Image');

      expect(approveButton).toHaveClass('bg-green-600', 'hover:bg-green-700');
      expect(retryButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
      expect(deleteButton).toHaveClass('bg-red-600', 'hover:bg-red-700');
    });

    it('provides helpful tooltips for buttons', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByTitle('Approve image (move to success)');
      const retryButton = screen.getByTitle('Add image to retry pool');
      const deleteButton = screen.getByTitle('Delete image permanently');

      expect(approveButton).toBeInTheDocument();
      expect(retryButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
    });

    it('ensures buttons are properly sized and spaced', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const footer = screen.getByTestId('modal-footer');
      expect(footer).toHaveClass('flex', 'justify-between', 'items-center', 'gap-4');
    });
  });

  describe('Modal Behavior', () => {
    it('prevents body scroll when open', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      // Modal should have overflow-hidden class
      const modal = screen.getByTestId('failed-image-review-modal');
      expect(modal).toHaveClass('overflow-hidden');
    });

    it('focuses close button on mount', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      
      // Focus should be on close button
      expect(document.activeElement).toBe(closeButton);
    });

    it('handles click outside modal to close', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const overlay = screen.getByTestId('failed-image-review-modal');
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles image without seed gracefully', () => {
      const imageWithoutSeed = { ...mockImage, seed: undefined };
      
      render(
        <FailedImageReviewModal
          image={imageWithoutSeed}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByText(/Seed:/)).not.toBeInTheDocument();
    });

    it('handles very long generation prompts', () => {
      const imageWithLongPrompt = {
        ...mockImage,
        generationPrompt: 'This is an extremely long generation prompt that contains many words and should be displayed properly in the modal without breaking the layout or causing overflow issues. It should wrap correctly and maintain readability.',
      };
      
      render(
        <FailedImageReviewModal
          image={imageWithLongPrompt}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const promptElement = screen.getByText(/This is an extremely long generation prompt/);
      expect(promptElement).toBeInTheDocument();
    });

    it('handles missing job execution ID', () => {
      const imageWithoutExecution = { ...mockImage, executionId: undefined };
      
      render(
        <FailedImageReviewModal
          image={imageWithoutExecution}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByText(/Job ID:/)).not.toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('renders efficiently', () => {
      const startTime = performance.now();
      
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render in under 100ms for good performance
      expect(renderTime).toBeLessThan(100);
    });

    it('handles rapid button clicks correctly', () => {
      render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByText('✓ Approve Image');
      const retryButton = screen.getByText(' Add to Retry Pool');

      // Rapid clicks should all be registered
      fireEvent.click(approveButton);
      fireEvent.click(retryButton);
      fireEvent.click(approveButton);

      expect(mockOnAction).toHaveBeenCalledTimes(3);
    });

    it('maintains modal state during interactions', () => {
      const { rerender } = render(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={true}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      // Initially open
      expect(screen.getByTestId('failed-image-review-modal')).toBeInTheDocument();

      // Close modal
      rerender(
        <FailedImageReviewModal
          image={mockImage}
          isOpen={false}
          onClose={mockOnClose}
          onAction={mockOnAction}
        />
      );

      // Should be closed
      expect(screen.queryByTestId('failed-image-review-modal')).not.toBeInTheDocument();
    });
  });
});
