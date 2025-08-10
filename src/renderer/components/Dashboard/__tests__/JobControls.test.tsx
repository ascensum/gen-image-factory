import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import JobControls from '../JobControls';

describe('JobControls', () => {
  const defaultProps = {
    jobStatus: 'idle' as const,
    onStartJob: vi.fn(),
    onStopJob: vi.fn(),
    isLoading: false
  };

  it('renders start and stop buttons', () => {
    render(<JobControls {...defaultProps} />);
    
    expect(screen.getByText('Start Job')).toBeInTheDocument();
    expect(screen.getByText('Stop Job')).toBeInTheDocument();
  });

  it('displays correct job status indicator', () => {
    render(<JobControls {...defaultProps} />);
    
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('enables start button when job is idle', () => {
    render(<JobControls {...defaultProps} jobStatus="idle" />);
    
    const startButton = screen.getByText('Start Job');
    expect(startButton).not.toBeDisabled();
  });

  it('disables start button when job is running', () => {
    render(<JobControls {...defaultProps} jobStatus="running" />);
    
    const startButton = screen.getByText('Start Job');
    expect(startButton).toBeDisabled();
  });

  it('enables stop button when job is running', () => {
    render(<JobControls {...defaultProps} jobStatus="running" />);
    
    const stopButton = screen.getByText('Stop Job');
    expect(stopButton).not.toBeDisabled();
  });

  it('disables stop button when job is idle', () => {
    render(<JobControls {...defaultProps} jobStatus="idle" />);
    
    const stopButton = screen.getByText('Stop Job');
    expect(stopButton).toBeDisabled();
  });

  it('calls onStartJob when start button is clicked', () => {
    const mockOnStartJob = vi.fn();
    render(<JobControls {...defaultProps} onStartJob={mockOnStartJob} />);
    
    const startButton = screen.getByText('Start Job');
    fireEvent.click(startButton);
    
    expect(mockOnStartJob).toHaveBeenCalledTimes(1);
  });

  it('calls onStopJob when stop button is clicked', () => {
    const mockOnStopJob = vi.fn();
    render(<JobControls {...defaultProps} jobStatus="running" onStopJob={mockOnStopJob} />);
    
    const stopButton = screen.getByText('Stop Job');
    fireEvent.click(stopButton);
    
    expect(mockOnStopJob).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when starting job', () => {
    render(<JobControls {...defaultProps} jobStatus="starting" isLoading={true} />);
    
    // Should show starting state in status indicator
    const startingElements = screen.getAllByText('Starting...');
    expect(startingElements.length).toBeGreaterThan(0);
    
    // Button should show loading spinner but still have Start Job text when not in starting state
    expect(screen.getByLabelText('Start job')).toBeInTheDocument();
  });

  it('shows loading state when stopping job', () => {
    render(<JobControls {...defaultProps} jobStatus="running" isLoading={true} />);
    
    expect(screen.getByText('Stopping...')).toBeInTheDocument();
    expect(screen.getByLabelText('Stop job')).toBeInTheDocument();
  });

  it('displays correct status for different job states', () => {
    const { rerender } = render(<JobControls {...defaultProps} jobStatus="idle" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="starting" />);
    expect(screen.getByText('Starting...')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="stopped" />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('applies correct styling for different job states', () => {
    const { rerender } = render(<JobControls {...defaultProps} jobStatus="idle" />);
    
    // Check status indicator color for idle state
    const statusIndicator = screen.getByText('Ready').closest('span');
    expect(statusIndicator).toHaveClass('bg-green-100', 'text-green-800');
    
    rerender(<JobControls {...defaultProps} jobStatus="running" />);
    const runningIndicator = screen.getByText('Running').closest('span');
    expect(runningIndicator).toHaveClass('bg-blue-100', 'text-blue-800');
    
    rerender(<JobControls {...defaultProps} jobStatus="failed" />);
    const failedIndicator = screen.getByText('Failed').closest('span');
    expect(failedIndicator).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('applies correct button styling based on state', () => {
    const { rerender } = render(<JobControls {...defaultProps} jobStatus="idle" />);
    
    const startButton = screen.getByText('Start Job');
    expect(startButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
    
    rerender(<JobControls {...defaultProps} jobStatus="running" />);
    const disabledStartButton = screen.getByText('Start Job');
    expect(disabledStartButton).toHaveClass('bg-gray-300', 'cursor-not-allowed');
  });

  it('handles keyboard navigation', () => {
    render(<JobControls {...defaultProps} />);
    
    const startButton = screen.getByText('Start Job');
    const stopButton = screen.getByText('Stop Job');
    
    // Tab navigation should work
    startButton.focus();
    expect(startButton).toHaveFocus();
    
    // Enter key should trigger action
    fireEvent.keyDown(startButton, { key: 'Enter', code: 'Enter' });
    expect(defaultProps.onStartJob).toHaveBeenCalled();
  });

  it('provides proper ARIA labels', () => {
    render(<JobControls {...defaultProps} />);
    
    const startButton = screen.getByLabelText('Start job');
    const stopButton = screen.getByLabelText('Stop job');
    
    expect(startButton).toBeInTheDocument();
    expect(stopButton).toBeInTheDocument();
  });

  it('prevents action when button is disabled', () => {
    const mockOnStartJob = vi.fn();
    render(<JobControls {...defaultProps} jobStatus="running" onStartJob={mockOnStartJob} />);
    
    const startButton = screen.getByText('Start Job');
    fireEvent.click(startButton);
    
    expect(mockOnStartJob).not.toHaveBeenCalled();
  });

  it('shows spinner animation during loading states', () => {
    render(<JobControls {...defaultProps} jobStatus="starting" isLoading={true} />);
    
    // Check for spinner SVG
    const spinner = document.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('handles edge case job states', () => {
    const { rerender } = render(<JobControls {...defaultProps} jobStatus="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    
    rerender(<JobControls {...defaultProps} jobStatus="stopped" />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('maintains button state consistency', () => {
    const { rerender } = render(<JobControls {...defaultProps} jobStatus="idle" />);
    
    // Start button should be enabled, stop button disabled
    expect(screen.getByText('Start Job')).not.toBeDisabled();
    expect(screen.getByText('Stop Job')).toBeDisabled();
    
    rerender(<JobControls {...defaultProps} jobStatus="running" />);
    
    // Start button should be disabled, stop button enabled
    expect(screen.getByText('Start Job')).toBeDisabled();
    expect(screen.getByText('Stop Job')).not.toBeDisabled();
  });
});
