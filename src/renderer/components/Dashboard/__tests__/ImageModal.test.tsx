import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ImageModal from '../ImageModal';
import { GeneratedImage } from '../DashboardPanel';

// Mock the image data
const mockImage: GeneratedImage = {
  id: 'img-1',
  executionId: 'job-1',
  generationPrompt: 'A beautiful landscape with mountains',
  seed: 12345,
  qcStatus: 'approved',
  qcReason: null,
  finalImagePath: '/path/to/image.jpg',
  metadata: {
    title: 'Mountain Landscape',
    description: 'A stunning view of mountain peaks',
    tags: ['landscape', 'mountains', 'nature'],
    prompt: 'Generate a beautiful landscape'
  },
  processingSettings: {
    imageEnhancement: true,
    sharpening: 5,
    saturation: 1.2,
    imageConvert: true,
    convertToJpg: true,
    jpgQuality: 85,
    removeBg: false,
    trimTransparentBackground: false
  },
  createdAt: new Date('2024-01-01T12:00:00Z')
};

describe('ImageModal', () => {
  const defaultProps = {
    image: mockImage,
    isOpen: true,
    onClose: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    hasPrevious: true,
    hasNext: true
  };

  it('renders modal when open', () => {
    render(<ImageModal {...defaultProps} />);
    
    expect(screen.getByText('Image Details')).toBeInTheDocument();
    expect(screen.getByText('A beautiful landscape with mountains')).toBeInTheDocument();
    expect(screen.getAllByText('approved')[0]).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ImageModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Image Details')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ImageModal {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('shows navigation buttons when available', () => {
    render(<ImageModal {...defaultProps} />);
    
    expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image')).toBeInTheDocument();
  });

  it('calls navigation functions', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<ImageModal {...defaultProps} onNext={onNext} onPrevious={onPrevious} />);
    
    fireEvent.click(screen.getByLabelText('Next image'));
    expect(onNext).toHaveBeenCalled();
    
    fireEvent.click(screen.getByLabelText('Previous image'));
    expect(onPrevious).toHaveBeenCalled();
  });

  it('switches between tabs', () => {
    render(<ImageModal {...defaultProps} />);
    
    // Should start on Details tab
    expect(screen.getByText('A beautiful landscape with mountains')).toBeInTheDocument();
    
    // Switch to AI Metadata tab
    fireEvent.click(screen.getByText('AI Metadata'));
    expect(screen.getByText('Mountain Landscape')).toBeInTheDocument();
    expect(screen.getByText('A stunning view of mountain peaks')).toBeInTheDocument();
    
    // Switch to Processing tab
    fireEvent.click(screen.getByText('Processing'));
    expect(screen.getByText('Image Enhancement')).toBeInTheDocument();
  });

  it('displays processing settings correctly', () => {
    render(<ImageModal {...defaultProps} />);
    
    // Switch to Processing tab
    fireEvent.click(screen.getByText('Processing'));
    
    // Check various processing settings
    expect(screen.getByText('Image Enhancement')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Sharpening
    expect(screen.getByText('1.2')).toBeInTheDocument(); // Saturation
    expect(screen.getByText('85')).toBeInTheDocument(); // JPG Quality
  });

  it('displays AI tags correctly', () => {
    render(<ImageModal {...defaultProps} />);
    
    // Switch to AI Metadata tab
    fireEvent.click(screen.getByText('AI Metadata'));
    
    expect(screen.getByText('landscape')).toBeInTheDocument();
    expect(screen.getByText('mountains')).toBeInTheDocument();
    expect(screen.getByText('nature')).toBeInTheDocument();
  });

  it('handles image with missing metadata gracefully', () => {
    const imageWithoutMetadata = { ...mockImage, metadata: undefined };
    render(<ImageModal {...defaultProps} image={imageWithoutMetadata} />);
    
    // Should still render without crashing
    expect(screen.getByText('Image Details')).toBeInTheDocument();
    expect(screen.getByText('A beautiful landscape with mountains')).toBeInTheDocument();
    
    // Switch to AI Metadata tab
    fireEvent.click(screen.getByText('AI Metadata'));
    expect(screen.getByText('No title generated')).toBeInTheDocument();
    expect(screen.getByText('No description generated')).toBeInTheDocument();
    expect(screen.getByText('No tags generated')).toBeInTheDocument();
  });

  it('closes modal on Escape key', () => {
    const onClose = vi.fn();
    render(<ImageModal {...defaultProps} onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('handles null image gracefully', () => {
    render(<ImageModal {...defaultProps} image={null} />);
    
    expect(screen.queryByText('Image Details')).not.toBeInTheDocument();
  });
});
