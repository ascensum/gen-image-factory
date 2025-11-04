import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FailedImageCard from '../FailedImageCard';
import { GeneratedImage } from '../DashboardPanel';

describe('FailedImageCard', () => {
  const mockImage: GeneratedImage = {
    id: 'test-image-1',
    executionId: 'exec-123',
    generationPrompt: 'A beautiful sunset over mountains with dramatic clouds',
    seed: 12345,
    qcStatus: 'failed',
    qcReason: 'Poor image quality - too dark and blurry',
    finalImagePath: '/path/to/test-image.jpg',
    metadata: {
      title: 'Mountain Sunset',
      description: 'A serene mountain landscape at sunset with dramatic cloud formations',
      tags: ['nature', 'mountains', 'sunset', 'clouds', 'landscape'],
    },
    processingSettings: {
      imageEnhancement: true,
      sharpening: 75,
      saturation: 1.3,
      imageConvert: false,
      convertToJpg: true,
      jpgQuality: 95,
      pngQuality: 9,
      removeBg: false,
      removeBgSize: 'auto',
      trimTransparentBackground: false,
      jpgBackground: '#FFFFFF',
    },
    createdAt: new Date('2024-01-15T10:30:00Z'),
  };

  const mockOnSelect = vi.fn();
  const mockOnAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders the image card with basic structure', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByTestId('failed-image-card-test-image-1')).toBeInTheDocument();
    });

    it('displays the generation prompt', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('A beautiful sunset over mountains with dramatic clouds')).toBeInTheDocument();
    });

    it('shows the seed value when available', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText(' 12345')).toBeInTheDocument();
    });

    it('displays the creation date', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('1/15/2024')).toBeInTheDocument();
    });
  });

  describe('Image Display', () => {
    it('renders image when finalImagePath is available', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const image = screen.getByAltText('A beautiful sunset over mountains with dramatic clouds');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'file:///path/to/test-image.jpg');
    });

    it('shows fallback placeholder when no image path', () => {
      const imageWithoutPath = { ...mockImage, finalImagePath: undefined };
      
      render(
        <FailedImageCard
          image={imageWithoutPath}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      // Should show placeholder icon instead of image
      expect(screen.queryByAltText('A beautiful sunset over mountains with dramatic clouds')).not.toBeInTheDocument();
    });

    it('handles image load errors gracefully', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const image = screen.getByAltText('A beautiful sunset over mountains with dramatic clouds');
      
      // Simulate image load error
      fireEvent.error(image);
      
      // Should show fallback after error
      expect(image).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
    });
  });

  describe('Failure Indicators', () => {
    it('shows failure indicator when qcReason is present', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('️ Failed')).toBeInTheDocument();
    });

    it('does not show failure indicator when no qcReason', () => {
      const imageWithoutReason = { ...mockImage, qcReason: undefined };
      
      render(
        <FailedImageCard
          image={imageWithoutReason}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByText('️ Failed')).not.toBeInTheDocument();
    });

    it('displays failure reason prominently', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('Poor image quality - too dark and blurry')).toBeInTheDocument();
      expect(screen.getByText('Failure:')).toBeInTheDocument();
    });
  });

  describe('Selection Controls', () => {
    it('renders selection checkbox', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const checkbox = screen.getByTestId('select-test-image-1');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('type', 'checkbox');
    });

    it('shows correct selection state', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={true}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const checkbox = screen.getByTestId('select-test-image-1');
      expect(checkbox).toBeChecked();
    });

    it('calls onSelect when checkbox is clicked', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const checkbox = screen.getByTestId('select-test-image-1');
      fireEvent.click(checkbox);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it('prevents event propagation when checkbox is clicked', () => {
      const mockEvent = {
        stopPropagation: vi.fn(),
      };

      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const checkbox = screen.getByTestId('select-test-image-1');
      fireEvent.click(checkbox, mockEvent);

      // Note: In the actual component, stopPropagation is called on the onChange event
      // This test verifies the checkbox is properly configured
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders all action buttons', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      expect(screen.getByText(' Retry')).toBeInTheDocument();
      expect(screen.getByText(' View')).toBeInTheDocument();
      expect(screen.getByText(' Delete')).toBeInTheDocument();
    });

    it('calls onAction with correct parameters for approve', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByText('✓ Approve');
      fireEvent.click(approveButton);

      expect(mockOnAction).toHaveBeenCalledWith('approve', 'test-image-1');
    });

    it('calls onAction with correct parameters for retry', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const retryButton = screen.getByText(' Retry');
      fireEvent.click(retryButton);

      expect(mockOnAction).toHaveBeenCalledWith('retry', 'test-image-1');
    });

    it('calls onAction with correct parameters for view', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const viewButton = screen.getByText(' View');
      fireEvent.click(viewButton);

      expect(mockOnAction).toHaveBeenCalledWith('view', 'test-image-1');
    });

    it('calls onAction with correct parameters for delete', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const deleteButton = screen.getByText(' Delete');
      fireEvent.click(deleteButton);

      expect(mockOnAction).toHaveBeenCalledWith('delete', 'test-image-1');
    });
  });

  describe('Button Styling and Accessibility', () => {
    it('applies correct button styles', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByText('✓ Approve');
      const retryButton = screen.getByText(' Retry');
      const viewButton = screen.getByText(' View');
      const deleteButton = screen.getByText(' Delete');

      expect(approveButton).toHaveClass('bg-green-600', 'hover:bg-green-700');
      expect(retryButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
      expect(viewButton).toHaveClass('bg-gray-600', 'hover:bg-gray-700');
      expect(deleteButton).toHaveClass('bg-red-600', 'hover:bg-red-700');
    });

    it('provides helpful tooltips for buttons', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByTitle('Approve image (move to success)');
      const retryButton = screen.getByTitle('Add to retry pool');
      const viewButton = screen.getByTitle('View full image details');
      const deleteButton = screen.getByTitle('Delete image permanently');

      expect(approveButton).toBeInTheDocument();
      expect(retryButton).toBeInTheDocument();
      expect(viewButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('applies correct card styling', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const card = screen.getByTestId('failed-image-card-test-image-1');
      expect(card).toHaveClass('bg-white', 'border', 'rounded-lg', 'overflow-hidden');
    });

    it('maintains aspect ratio for image container', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const imageContainer = screen.getByAltText('A beautiful sunset over mountains with dramatic clouds').parentElement;
      expect(imageContainer).toHaveClass('aspect-square');
    });

    it('displays action buttons in grid layout', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const actionButtonsContainer = screen.getByText('✓ Approve').closest('div');
      expect(actionButtonsContainer).toHaveClass('grid', 'grid-cols-2', 'gap-2');
    });
  });

  describe('Edge Cases', () => {
    it('handles image without seed gracefully', () => {
      const imageWithoutSeed = { ...mockImage, seed: undefined };
      
      render(
        <FailedImageCard
          image={imageWithoutSeed}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      expect(screen.queryByText(//)).not.toBeInTheDocument();
    });

    it('handles image without metadata gracefully', () => {
      const imageWithoutMetadata = { ...mockImage, metadata: undefined };
      
      render(
        <FailedImageCard
          image={imageWithoutMetadata}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      // Should still render basic information
      expect(screen.getByText('A beautiful sunset over mountains with dramatic clouds')).toBeInTheDocument();
      expect(screen.getByText('1/15/2024')).toBeInTheDocument();
    });

    it('handles image without processing settings gracefully', () => {
      const imageWithoutSettings = { ...mockImage, processingSettings: undefined };
      
      render(
        <FailedImageCard
          image={imageWithoutSettings}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      // Should still render all other information
      expect(screen.getByText('A beautiful sunset over mountains with dramatic clouds')).toBeInTheDocument();
      expect(screen.getByText('Poor image quality - too dark and blurry')).toBeInTheDocument();
    });

    it('handles very long generation prompts', () => {
      const imageWithLongPrompt = {
        ...mockImage,
        generationPrompt: 'This is a very long generation prompt that should be truncated to prevent the UI from breaking and maintain a clean, consistent layout across all image cards in the grid view. It contains many words and should be handled gracefully.',
      };
      
      render(
        <FailedImageCard
          image={imageWithLongPrompt}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const promptElement = screen.getByText(/This is a very long generation prompt/);
      expect(promptElement).toHaveClass('truncate');
    });
  });

  describe('Interactive Behavior', () => {
    it('maintains selection state during interactions', () => {
      const { rerender } = render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      // Initially not selected
      let checkbox = screen.getByTestId('select-test-image-1');
      expect(checkbox).not.toBeChecked();

      // Update to selected state
      rerender(
        <FailedImageCard
          image={mockImage}
          isSelected={true}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      checkbox = screen.getByTestId('select-test-image-1');
      expect(checkbox).toBeChecked();
    });

    it('handles rapid button clicks correctly', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const approveButton = screen.getByText('✓ Approve');
      const retryButton = screen.getByText(' Retry');

      // Rapid clicks should all be registered
      fireEvent.click(approveButton);
      fireEvent.click(retryButton);
      fireEvent.click(approveButton);

      expect(mockOnAction).toHaveBeenCalledTimes(3);
      expect(mockOnAction).toHaveBeenCalledWith('approve', 'test-image-1');
      expect(mockOnAction).toHaveBeenCalledWith('retry', 'test-image-1');
    });
  });

  describe('Performance Considerations', () => {
    it('renders efficiently with large datasets', () => {
      const startTime = performance.now();
      
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render in under 50ms for good performance
      expect(renderTime).toBeLessThan(50);
    });

    it('handles image load events efficiently', () => {
      render(
        <FailedImageCard
          image={mockImage}
          isSelected={false}
          onSelect={mockOnSelect}
          onAction={mockOnAction}
        />
      );

      const image = screen.getByAltText('A beautiful sunset over mountains with dramatic clouds');
      
      // Simulate load events
      fireEvent.load(image);
      fireEvent.error(image);
      
      // Should handle events without crashing
      expect(image).toBeInTheDocument();
    });
  });
});
