import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ProgressIndicator from '../ProgressIndicator';

describe('ProgressIndicator', () => {
  const defaultJobStatus = {
    state: 'idle' as const,
    progress: 0,
    currentStep: 0,
    totalSteps: 0,
    startTime: null,
    estimatedTimeRemaining: null
  };

  const defaultProps = {
    jobStatus: defaultJobStatus,
    isLoading: false
  };

  it('renders progress indicator with main sections', () => {
    render(<ProgressIndicator {...defaultProps} />);
    
    expect(screen.getByText('Job Progress')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Job Steps')).toBeInTheDocument();
  });

  it('displays correct progress percentage', () => {
    const jobStatus = {
      ...defaultJobStatus,
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Use the specific class for circular progress percentage
    expect(screen.getByText('50%', { selector: '.circular-progress-percentage' })).toBeInTheDocument();
  });

  it('shows correct step information', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    expect(screen.getAllByText('Step 2 of 4').length).toBeGreaterThan(0);
  });

  it('displays job steps correctly', () => {
    const jobStatus = {
      ...defaultJobStatus,
      totalSteps: 3
    };
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    expect(screen.getByText('Initialization')).toBeInTheDocument();
    expect(screen.getByText('Image Generation')).toBeInTheDocument();
    expect(screen.getByText('Quality & Processing')).toBeInTheDocument();
  });

  it('shows time information when job is active', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(Date.now() - 60000), // 1 minute ago
      estimatedTimeRemaining: 120
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    expect(screen.getByText('Time Elapsed')).toBeInTheDocument();
    expect(screen.getByText('Estimated Remaining')).toBeInTheDocument();
  });

  it('hides time information when job is idle', () => {
    render(<ProgressIndicator {...defaultProps} />);
    
    expect(screen.queryByText('Time Elapsed')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimated Remaining')).not.toBeInTheDocument();
  });

  it('displays correct status messages for different states', () => {
    const { rerender } = render(<ProgressIndicator {...defaultProps} />);
    expect(screen.getByText('No job in progress')).toBeInTheDocument();
    
    const runningStatus = { ...defaultJobStatus, state: 'running' as const };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={runningStatus} />);
    expect(screen.getAllByText(/Step \d+ of \d+/).length).toBeGreaterThan(0);
    
    const completedStatus = { ...defaultJobStatus, state: 'completed' as const };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={completedStatus} />);
    expect(screen.getByText('Job completed successfully')).toBeInTheDocument();
    
    const failedStatus = { ...defaultJobStatus, state: 'failed' as const };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={failedStatus} />);
    expect(screen.getByText('Job failed')).toBeInTheDocument();
    
    const stoppedStatus = { ...defaultJobStatus, state: 'stopped' as const };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={stoppedStatus} />);
    expect(screen.getByText('Job stopped')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<ProgressIndicator {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Updating progress...')).toBeInTheDocument();
  });

  it('applies correct progress bar styling based on state', () => {
    const { rerender } = render(<ProgressIndicator {...defaultProps} />);
    
    // Idle state - gray progress bar (check the inner div that has the styling)
    const idleProgressBar = screen.getByRole('progressbar', { hidden: true });
    const idleProgressFill = idleProgressBar.querySelector('div');
    expect(idleProgressFill).toHaveClass('bg-gray-400');
    
    const runningStatus = { ...defaultJobStatus, state: 'running' as const, progress: 0.5 };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={runningStatus} />);
    
    // Running state - blue progress bar
    const runningProgressBar = screen.getByRole('progressbar', { hidden: true });
    const runningProgressFill = runningProgressBar.querySelector('div');
    expect(runningProgressFill).toHaveClass('bg-blue-500');
    
    const completedStatus = { ...defaultJobStatus, state: 'completed' as const, progress: 1 };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={completedStatus} />);
    
    // Completed state - green progress bar
    const completedProgressBar = screen.getByRole('progressbar', { hidden: true });
    const completedProgressFill = completedProgressBar.querySelector('div');
    expect(completedProgressFill).toHaveClass('bg-green-500');
    
    const failedStatus = { ...defaultJobStatus, state: 'failed' as const, progress: 0.3 };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={failedStatus} />);
    
    // Failed state - red progress bar
    const failedProgressBar = screen.getByRole('progressbar', { hidden: true });
    const failedProgressFill = failedProgressBar.querySelector('div');
    expect(failedProgressFill).toHaveClass('bg-red-500');
  });

  it('displays step description for the current step only', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      currentStep: 2,
      totalSteps: 3,
      progress: 0.5
    };
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Only current step description should be visible
    expect(screen.getByText('Generating images and metadata')).toBeInTheDocument();
  });

  it('shows current step indicator', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Current step card shows an animated blue dot and the label in the footer box
    expect(screen.getByText('Currently: Image Generation')).toBeInTheDocument();
  });

  it('formats time correctly', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: new Date(Date.now() - 65000), // 1:05 ago
      estimatedTimeRemaining: 180 // 3 minutes
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Should show formatted time (MM:SS format)
    expect(screen.getByText('01:05')).toBeInTheDocument();
    expect(screen.getByText('03:00')).toBeInTheDocument();
  });

  it('handles zero progress correctly', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'starting',
      progress: 0,
      currentStep: 1,
      totalSteps: 4
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Use the specific class for circular progress percentage
    expect(screen.getByText('0%', { selector: '.circular-progress-percentage' })).toBeInTheDocument();
  });

  it('handles 100% progress correctly', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'completed',
      progress: 1,
      currentStep: 4,
      totalSteps: 4
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Use the specific class for circular progress percentage
    expect(screen.getByText('100%', { selector: '.circular-progress-percentage' })).toBeInTheDocument();
  });

  it('shows circular progress indicator', () => {
    render(<ProgressIndicator {...defaultProps} />);
    
    // Check for circular progress SVG
    const circularProgress = document.querySelector('svg.transform.-rotate-90');
    expect(circularProgress).toBeInTheDocument();
  });

  it('applies correct circular progress styling based on state', () => {
    const { rerender } = render(<ProgressIndicator {...defaultProps} />);
    
    // Idle state - gray circular progress
    const idleCircle = document.querySelector('circle.text-gray-400');
    expect(idleCircle).toBeInTheDocument();
    
    const runningStatus = { ...defaultJobStatus, state: 'running' as const, progress: 0.5 };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={runningStatus} />);
    
    // Running state - blue circular progress
    const runningCircle = document.querySelector('circle.text-blue-500');
    expect(runningCircle).toBeInTheDocument();
    
    const completedStatus = { ...defaultJobStatus, state: 'completed' as const, progress: 1 };
    rerender(<ProgressIndicator {...defaultProps} jobStatus={completedStatus} />);
    
    // Completed state - green circular progress
    const completedCircle = document.querySelector('circle.text-green-500');
    expect(completedCircle).toBeInTheDocument();
  });

  it('handles missing start time gracefully', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4,
      startTime: null,
      estimatedTimeRemaining: null
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Should not crash and should show --:-- for missing time
    expect(screen.getByText('--:--')).toBeInTheDocument();
  });

  it('shows step completion indicators', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'running',
      progress: 0.5,
      currentStep: 2,
      totalSteps: 4
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Should show step 1 as completed (checkmark)
    const completedStep = document.querySelector('svg[class*="w-4 h-4"]');
    expect(completedStep).toBeInTheDocument();
  });

  it('handles edge case with no steps', () => {
    const jobStatus = {
      ...defaultJobStatus,
      state: 'idle',
      progress: 0,
      currentStep: 0,
      totalSteps: 0
    };
    
    render(<ProgressIndicator {...defaultProps} jobStatus={jobStatus} />);
    
    // Use the specific class for circular progress percentage
    expect(screen.getByText('0%', { selector: '.circular-progress-percentage' })).toBeInTheDocument();
  });
});
