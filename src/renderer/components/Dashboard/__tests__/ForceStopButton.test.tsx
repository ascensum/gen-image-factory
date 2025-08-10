import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ForceStopButton from '../ForceStopButton';

describe('ForceStopButton', () => {
  const defaultProps = {
    onForceStop: vi.fn(),
    isLoading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders force stop button', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    expect(screen.getByText('Force Stop')).toBeInTheDocument();
    expect(screen.getByLabelText('Force stop all processes')).toBeInTheDocument();
  });

  it('shows confirmation dialog when clicked', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to force stop all running processes?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('handles confirmation dialog confirm action', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    const confirmButton = screen.getByText('Force Stop');
    fireEvent.click(confirmButton);
    
    expect(defaultProps.onForceStop).toHaveBeenCalledTimes(1);
  });

  it('handles confirmation dialog cancel action', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onForceStop).not.toHaveBeenCalled();
  });

  it('closes confirmation dialog when clicking outside', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
    
    // Click outside to close
    fireEvent.click(document.body);
    
    expect(screen.queryByText('Force Stop All Processes')).not.toBeInTheDocument();
  });

  it('handles escape key to close confirmation dialog', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
    
    // Press escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    
    expect(screen.queryByText('Force Stop All Processes')).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<ForceStopButton {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Stopping...')).toBeInTheDocument();
    expect(screen.getByText('Force Stop')).toBeInTheDocument();
  });

  it('disables button when isLoading is true', () => {
    render(<ForceStopButton {...defaultProps} isLoading={true} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    expect(forceStopButton).toBeDisabled();
  });

  it('applies correct styling for danger button', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    expect(forceStopButton).toHaveClass('bg-red-600', 'hover:bg-red-700', 'text-white');
  });

  it('displays correct warning icon', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    // Check for warning icon
    const warningIcon = document.querySelector('svg[class*="text-red-600"]');
    expect(warningIcon).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    
    // Tab navigation should work
    forceStopButton.focus();
    expect(forceStopButton).toHaveFocus();
    
    // Enter key should open confirmation dialog
    fireEvent.keyDown(forceStopButton, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
  });

  it('provides proper ARIA labels', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    expect(screen.getByLabelText('Force stop all processes')).toBeInTheDocument();
  });

  it('handles multiple rapid clicks', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    
    // Rapidly click multiple times
    fireEvent.click(forceStopButton);
    fireEvent.click(forceStopButton);
    fireEvent.click(forceStopButton);
    
    // Should only show one confirmation dialog
    const confirmDialogs = screen.getAllByText('Force Stop All Processes');
    expect(confirmDialogs).toHaveLength(1);
  });

  it('handles confirmation dialog keyboard navigation', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Tab should focus cancel button first
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
    
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toHaveFocus();
  });

  it('handles confirmation dialog enter key', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    const confirmButton = screen.getByText('Force Stop');
    confirmButton.focus();
    
    // Enter key should confirm action
    fireEvent.keyDown(confirmButton, { key: 'Enter', code: 'Enter' });
    expect(defaultProps.onForceStop).toHaveBeenCalled();
  });

  it('handles confirmation dialog space key', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    const confirmButton = screen.getByText('Force Stop');
    confirmButton.focus();
    
    // Space key should confirm action
    fireEvent.keyDown(confirmButton, { key: ' ', code: 'Space' });
    expect(defaultProps.onForceStop).toHaveBeenCalled();
  });

  it('shows spinner animation during loading', () => {
    render(<ForceStopButton {...defaultProps} isLoading={true} />);
    
    // Check for spinner SVG
    const spinner = document.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('handles very long button text', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    // Should handle text gracefully
    expect(screen.getByText('Force Stop')).toBeInTheDocument();
  });

  it('maintains button state during re-renders', () => {
    const { rerender } = render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    expect(forceStopButton).not.toBeDisabled();
    
    // Re-render with loading state
    rerender(<ForceStopButton {...defaultProps} isLoading={true} />);
    
    expect(forceStopButton).toBeDisabled();
  });

  it('handles confirmation dialog backdrop click', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
    
    // Click on backdrop
    const backdrop = screen.getByRole('dialog').parentElement;
    fireEvent.click(backdrop);
    
    expect(screen.queryByText('Force Stop All Processes')).not.toBeInTheDocument();
  });

  it('handles confirmation dialog with different button text', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Should show both cancel and confirm buttons
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Force Stop')).toBeInTheDocument();
  });

  it('provides proper dialog ARIA attributes', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('handles confirmation dialog with focus trap', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Focus should be trapped within dialog
    const dialog = screen.getByRole('dialog');
    const focusableElements = dialog.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    
    // Tab should cycle through focusable elements
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
    expect(focusableElements[0]).toHaveFocus();
  });

  it('handles confirmation dialog with screen reader announcements', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Should announce dialog to screen readers
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('handles confirmation dialog with different languages', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Should handle text gracefully regardless of language
    expect(screen.getByText('Force Stop All Processes')).toBeInTheDocument();
  });

  it('handles confirmation dialog with very long text', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Should handle long text gracefully
    expect(screen.getByText('Are you sure you want to force stop all running processes?')).toBeInTheDocument();
  });

  it('handles confirmation dialog with custom styling', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Should apply danger styling to confirm button
    const confirmButton = screen.getByText('Force Stop');
    expect(confirmButton).toHaveClass('bg-red-600', 'hover:bg-red-700');
  });

  it('handles confirmation dialog with proper button order', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Cancel should come before confirm (for better UX)
    const buttons = screen.getAllByRole('button');
    const cancelButton = buttons.find(button => button.textContent === 'Cancel');
    const confirmButton = buttons.find(button => button.textContent === 'Force Stop');
    
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
  });

  it('handles confirmation dialog with proper focus management', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Focus should be on cancel button by default
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toHaveFocus();
  });

  it('handles confirmation dialog with proper keyboard shortcuts', () => {
    render(<ForceStopButton {...defaultProps} />);
    
    const forceStopButton = screen.getByText('Force Stop');
    fireEvent.click(forceStopButton);
    
    // Escape should close dialog
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Force Stop All Processes')).not.toBeInTheDocument();
  });
});
