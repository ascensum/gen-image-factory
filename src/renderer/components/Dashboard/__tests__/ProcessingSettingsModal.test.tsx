import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProcessingSettingsModal from '../ProcessingSettingsModal';

describe('ProcessingSettingsModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRetry = vi.fn();
  const selectedCount = 3;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders modal when isOpen is true', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByTestId('processing-settings-modal')).toBeInTheDocument();
      expect(screen.getByText('Retry Processing Settings')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <ProcessingSettingsModal
          isOpen={false}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.queryByTestId('processing-settings-modal')).not.toBeInTheDocument();
    });

    it('displays selected image count in title', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByText('Retry Processing Settings')).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Configure how to process\\s+${selectedCount}\\s+selected images for retry`))).toBeInTheDocument();
    });

    it('renders with correct modal structure', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByTestId('modal-header')).toBeInTheDocument();
      expect(screen.getByTestId('modal-content')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Header Section', () => {
    it('displays modal title and subtitle with image count', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByText('Retry Processing Settings')).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`Configure how to process\\s+${selectedCount}\\s+selected images for retry`))
      ).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
    });

    it('calls onClose when close button is clicked', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape key by default', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Press escape key (no handler wired on this modal)
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Settings Choice Section', () => {
    it('displays settings choice section title', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByText('Batch Processing Method')).toBeInTheDocument();
    });

    it('renders radio buttons for settings choice', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const originalRadio = screen.getByLabelText('Retry with Original Settings');
      const modifiedRadio = screen.getByText('Retry with Modified Settings').closest('label')!.querySelector('input') as HTMLInputElement;

      expect(originalRadio).toBeInTheDocument();
      expect(modifiedRadio).toBeInTheDocument();
      expect(originalRadio).toHaveAttribute('type', 'radio');
      expect(modifiedRadio).toHaveAttribute('type', 'radio');
    });

    it('selects original settings by default', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const originalRadio = screen.getByLabelText('Retry with Original Settings');
      const modifiedRadio = screen.getByText('Retry with Modified Settings').closest('label')!.querySelector('input') as HTMLInputElement;

      expect(originalRadio).toBeChecked();
      expect(modifiedRadio).not.toBeChecked();
    });

    it('switches selection when radio buttons are clicked', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const originalRadio = screen.getByLabelText('Retry with Original Settings');
      const modifiedRadio = screen.getByText('Retry with Modified Settings').closest('label')!.querySelector('input') as HTMLInputElement;

      // Initially original is selected
      expect(originalRadio).toBeChecked();
      expect(modifiedRadio).not.toBeChecked();

      // Click modified radio
      fireEvent.click(modifiedRadio);

      // Now modified should be selected
      expect(originalRadio).not.toBeChecked();
      expect(modifiedRadio).toBeChecked();
    });

    it('shows description for original settings', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByText(/original job settings \(QC, metadata, processing\)/i)).toBeInTheDocument();
    });

    it('shows description for modified settings', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByText(/new settings .* no image regeneration/i)).toBeInTheDocument();
    });
  });

  describe('Batch Processing Info', () => {
    it('displays batch processing information', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByText('Batch Processing')).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`All\\s+${selectedCount}\\s+selected images will be processed together with the same settings`, 'i'))
      ).toBeInTheDocument();
    });

    it('shows correct image count in batch info', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={5}
        />
      );

      expect(
        screen.getByText(new RegExp('Configure how to process\\s+5\\s+selected images for retry'))
      ).toBeInTheDocument();
    });
  });

  describe('Modified Settings Section', () => {
    it('shows modified settings section when modified radio is selected', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Select modified settings
      const modifiedLabel = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio = modifiedLabel?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio);

      expect(screen.getByText('Batch Processing Configuration')).toBeInTheDocument();
    });

    it('hides modified settings section when original radio is selected', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Ensure original is selected (default)
      const originalRadio = screen.getByLabelText('Retry with Original Settings');
      expect(originalRadio).toBeChecked();

      // Modified settings section should not be visible
      expect(screen.queryByText('Modified Processing Settings')).not.toBeInTheDocument();
    });

    it('displays important note about image regeneration', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Select modified settings to show the section
      const modifiedLabel1 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio1 = modifiedLabel1?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio1);

      expect(screen.getByText('Important Note')).toBeInTheDocument();
      expect(screen.getByText(/Images will NOT be regenerated/i)).toBeInTheDocument();
    });
  });

  describe('Image Enhancement Settings', () => {
    beforeEach(() => {
      // Set up modal with modified settings selected
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const modifiedLabel2 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio2 = modifiedLabel2?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio2);
    });

    it('displays image enhancement section', () => {
      expect(screen.getByText('Image Enhancement')).toBeInTheDocument();
    });

    it('renders image enhancement toggle', () => {
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      expect(enhancementToggle).toBeInTheDocument();
      expect(enhancementToggle).toHaveAttribute('type', 'checkbox');
    });

    it('shows sharpening slider when enhancement is enabled', () => {
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      
      // Enable enhancement
      fireEvent.click(enhancementToggle);
      
      expect(screen.getByText(/Sharpening Level:/, { exact: false })).toBeInTheDocument();
      expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    });

    it('shows saturation slider when enhancement is enabled', () => {
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      
      // Enable enhancement
      fireEvent.click(enhancementToggle);
      
      expect(screen.getByText(/Saturation:/, { exact: false })).toBeInTheDocument();
      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThan(1);
    });

    it('hides enhancement controls when enhancement is disabled', () => {
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      
      // Ensure enhancement is disabled
      expect(enhancementToggle).not.toBeChecked();
      
      // Enhancement controls should not be visible
      expect(screen.queryByText('Sharpening:')).not.toBeInTheDocument();
      expect(screen.queryByText('Saturation:')).not.toBeInTheDocument();
    });

    it('updates sharpening value when slider is moved', () => {
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      fireEvent.click(enhancementToggle);
      
      const sharpeningSlider = screen.getByDisplayValue('50');
      fireEvent.change(sharpeningSlider, { target: { value: '75' } });
      
      expect(sharpeningSlider).toHaveValue('75');
    });

    it('updates saturation value when slider is moved', () => {
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      fireEvent.click(enhancementToggle);
      
      const sliders = screen.getAllByRole('slider');
      const saturationSlider = sliders[1] as HTMLInputElement;
      fireEvent.change(saturationSlider, { target: { value: '2' } });
      
      expect(saturationSlider).toHaveValue('2');
    });
  });

  describe('Image Conversion Settings', () => {
    beforeEach(() => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const modifiedLabel3 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio3 = modifiedLabel3?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio3);
    });

    it('displays image conversion section', () => {
      expect(screen.getByText('Image Conversion')).toBeInTheDocument();
    });

    it('renders image conversion toggle', () => {
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      expect(conversionToggle).toBeInTheDocument();
      expect(conversionToggle).toHaveAttribute('type', 'checkbox');
    });

    it('shows JPG toggle and quality when conversion is enabled', () => {
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      
      // Enable conversion
      fireEvent.click(conversionToggle);
      
      expect(screen.getByText('Convert to JPG')).toBeInTheDocument();
      expect(screen.getByText(/JPG Quality:/, { exact: false })).toBeInTheDocument();
    });

    it('shows quality controls when conversion is enabled', () => {
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle);
      
      expect(screen.getByText(/JPG Quality:/, { exact: false })).toBeInTheDocument();
      expect(screen.getByDisplayValue('90')).toBeInTheDocument();
      // PNG quality only visible when Convert to JPG is off; not asserted here
    });

    it('switches between JPG and PNG controls by toggling Convert to JPG', () => {
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle);
      
      // Initially Convert to JPG is checked, so JPG Quality is visible
      expect(screen.getByText(/JPG Quality:/, { exact: false })).toBeInTheDocument();
      
      // Toggle off Convert to JPG to reveal PNG Quality
      const convertToJpgToggle = screen.getByText('Convert to JPG').closest('label')!.querySelector('input') as HTMLInputElement;
      fireEvent.click(convertToJpgToggle);
      
      expect(screen.getByText(/PNG Quality:/, { exact: false })).toBeInTheDocument();
    });

    it('updates JPG quality when slider is moved', () => {
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle);
      
      const jpgQualitySlider = screen.getByDisplayValue('90');
      fireEvent.change(jpgQualitySlider, { target: { value: '95' } });
      
      expect(jpgQualitySlider).toHaveValue('95');
    });

    it('updates PNG quality when slider is moved', () => {
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle);
      
      // Toggle to PNG path
      const convertToJpgToggle = screen.getByText('Convert to JPG').closest('label')!.querySelector('input') as HTMLInputElement;
      fireEvent.click(convertToJpgToggle);
      
      const pngQualitySlider = screen.getByDisplayValue('9');
      fireEvent.change(pngQualitySlider, { target: { value: '7' } });
      
      expect(pngQualitySlider).toHaveValue('7');
    });
  });

  describe('Background Processing Settings', () => {
    beforeEach(() => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const modifiedLabel4 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio4 = modifiedLabel4?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio4);
    });

    it('displays background processing section', () => {
      expect(screen.getByText('Background Processing')).toBeInTheDocument();
    });

    it('renders remove background toggle', () => {
      const removeBgToggle = screen.getByLabelText('Remove background');
      expect(removeBgToggle).toBeInTheDocument();
      expect(removeBgToggle).toHaveAttribute('type', 'checkbox');
    });

    it('shows background size input when remove background is enabled', () => {
      const removeBgToggle = screen.getByLabelText('Remove background');
      
      // Enable remove background
      fireEvent.click(removeBgToggle);
      
      expect(screen.getByText('Remove BG Size')).toBeInTheDocument();
      const sizeSelect = screen.getByLabelText('Remove BG Size');
      expect(sizeSelect).toBeInTheDocument();
    });

    it('renders trim transparent background toggle', () => {
      const removeBgToggle = screen.getByLabelText('Remove background');
      fireEvent.click(removeBgToggle);
      const trimToggle = screen.getByLabelText('Trim transparent background');
      expect(trimToggle).toBeInTheDocument();
      expect(trimToggle).toHaveAttribute('type', 'checkbox');
    });

    it('shows JPG background color input when trim is enabled', () => {
      const removeBgToggle = screen.getByLabelText('Remove background');
      fireEvent.click(removeBgToggle);
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle);
      // Convert to JPG toggle appears when conversion is enabled and defaults to checked
      const trimToggle = screen.getByLabelText('Trim transparent background');
      
      // Enable trim transparent background
      fireEvent.click(trimToggle);
      
      expect(screen.getByText('JPG Background Color')).toBeInTheDocument();
      // Color input has default value #FFFFFF (case-insensitive)
      const colorInputByLabel = screen.getByLabelText('JPG Background Color') as HTMLInputElement;
      expect(colorInputByLabel.value.toLowerCase()).toBe('#ffffff');
    });

    it('updates background size when input changes', () => {
      const removeBgToggle = screen.getByLabelText('Remove background');
      fireEvent.click(removeBgToggle);
      
      const sizeSelect = screen.getByLabelText('Remove BG Size') as HTMLSelectElement;
      fireEvent.change(sizeSelect, { target: { value: 'full' } });
      
      expect(sizeSelect).toHaveValue('full');
    });

    it('updates JPG background color when input changes', () => {
      const removeBgToggle = screen.getByLabelText('Remove background');
      fireEvent.click(removeBgToggle);
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle);
      const trimToggle = screen.getByLabelText('Trim transparent background');
      fireEvent.click(trimToggle);
      
      const colorInput = screen.getByLabelText('JPG Background Color') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: '#000000' } });
      
      expect(colorInput.value.toLowerCase()).toBe('#000000');
    });
  });

  describe('Footer Actions', () => {
    it('renders footer with action buttons', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    });

    it('shows retry button with original settings text by default', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const retryButton = screen.getByText('Retry with Original Settings (3 images)');
      expect(retryButton).toBeInTheDocument();
    });

    it('updates retry button text when modified settings are selected', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Select modified settings
      const modifiedLabel = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio = modifiedLabel?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio);

      const retryButton = screen.getByText('Retry with Modified Settings (3 images)');
      expect(retryButton).toBeInTheDocument();
    });

    it('calls onRetry with correct parameters for original settings', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const retryButton = screen.getByText('Retry with Original Settings (3 images)');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledWith(true, undefined, false);
    });

    it('calls onRetry with correct parameters for modified settings', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Select modified settings
      const modifiedLabel1 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio1 = modifiedLabel1?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio1);

      // Configure some settings
      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      fireEvent.click(enhancementToggle);

      const retryButton = screen.getByText('Retry with Modified Settings (3 images)');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledWith(false, expect.objectContaining({
        imageEnhancement: true,
        sharpening: 50,
        saturation: 100,
      }), false);
    });
  });

  describe('Form Validation', () => {
    it('validates background size format', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const modifiedLabel2 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio2 = modifiedLabel2?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio2);

      const removeBgToggle = screen.getByLabelText('Remove background');
      fireEvent.click(removeBgToggle);

      const sizeSelect = screen.getByLabelText('Remove BG Size') as HTMLSelectElement;
      fireEvent.change(sizeSelect, { target: { value: 'full' } });

      expect(sizeSelect).toHaveValue('full');
    });

    it('validates color input format', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const modifiedLabel3 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio3 = modifiedLabel3?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio3);

      const removeBgToggle2 = screen.getByLabelText('Remove background');
      fireEvent.click(removeBgToggle2);
      const conversionToggle2 = screen.getByLabelText('Enable image conversion');
      fireEvent.click(conversionToggle2);

      const trimToggle = screen.getByLabelText('Trim transparent background');
      fireEvent.click(trimToggle);

      const colorInput = screen.getByLabelText('JPG Background Color') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: '#000000' } });
      
      expect(colorInput.value.toLowerCase()).toBe('#000000');
    });
  });

  describe('Edge Cases', () => {
    it('handles single image selection', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={1}
        />
      );

      expect(screen.getByText('Batch Processing')).toBeInTheDocument();
      expect(screen.getByText('Retry with Original Settings (1 images)')).toBeInTheDocument();
    });

    it('handles large number of images', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={100}
        />
      );

      // Footer reflects 100 images
      expect(screen.getByText('Retry with Original Settings (100 images)')).toBeInTheDocument();
    });

    it('maintains settings state when switching between radio options', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      // Select modified settings and configure
      const modifiedLabel4 = screen.getByText('Retry with Modified Settings').closest('label');
      const modifiedRadio4 = modifiedLabel4?.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio4);

      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      fireEvent.click(enhancementToggle);

      const sharpeningSlider = screen.getByDisplayValue('50');
      fireEvent.change(sharpeningSlider, { target: { value: '75' } });

      // Switch back to original
      const originalRadio = screen.getByText('Retry with Original Settings').closest('label')!.querySelector('input') as HTMLInputElement;
      fireEvent.click(originalRadio);

      // Switch back to modified - settings should be preserved
      fireEvent.click(modifiedRadio4);

      expect(enhancementToggle).toBeChecked();
      expect(sharpeningSlider).toHaveValue('75');
    });
  });

  describe('Performance and Optimization', () => {
    it('renders efficiently', () => {
      const startTime = performance.now();
      
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render in under 100ms for good performance
      expect(renderTime).toBeLessThan(100);
    });

    it('handles rapid form interactions correctly', () => {
      render(
        <ProcessingSettingsModal
          isOpen={true}
          onClose={mockOnClose}
          onRetry={mockOnRetry}
          selectedCount={selectedCount}
        />
      );

      const modifiedRadio = screen.getByText('Retry with Modified Settings').closest('label')!.querySelector('input') as HTMLInputElement;
      fireEvent.click(modifiedRadio);

      const enhancementToggle = screen.getByLabelText('Enable image enhancement');
      const conversionToggle = screen.getByLabelText('Enable image conversion');
      const removeBgToggle = screen.getByLabelText('Remove background');

      // Rapid toggles
      fireEvent.click(enhancementToggle);
      fireEvent.click(conversionToggle);
      fireEvent.click(removeBgToggle);

      expect(enhancementToggle).toBeChecked();
      expect(conversionToggle).toBeChecked();
      expect(removeBgToggle).toBeChecked();
    });
  });
});
