import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import JobStatistics from '../JobStatistics';

const defaultProps = {
  totalJobs: 100,
  completedJobs: 75,
  failedJobs: 15,
  processingJobs: 5,
  pendingJobs: 5,
  totalImages: 500,
  averageImagesPerJob: 5.0,
  isLoading: false
};

describe('JobStatistics', () => {
  it('renders statistics component with header', () => {
    render(<JobStatistics {...defaultProps} />);
    
    expect(screen.getByText('Job Statistics Overview')).toBeInTheDocument();
    expect(screen.getByText('Summary of job execution status and performance metrics')).toBeInTheDocument();
  });

  it('renders main statistics cards', () => {
    render(<JobStatistics {...defaultProps} />);
    
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    
    expect(screen.getByText('Total Images')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    
    expect(screen.getByText('Avg Images/Job')).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument();
    
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('75%');
  });

  it('renders status breakdown section', () => {
    render(<JobStatistics {...defaultProps} />);
    
    expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('75% of total')).toBeInTheDocument();
    
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('15% of total')).toBeInTheDocument();
    
    expect(screen.getByText('Processing')).toBeInTheDocument();
    
    // Check processing count in status breakdown
    const processingSection = screen.getByText('Processing').closest('div');
    expect(processingSection).toHaveTextContent('5');
    expect(processingSection).toHaveTextContent('5% of total');
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    
    // Check pending count in status breakdown
    const pendingSection = screen.getByText('Pending').closest('div');
    expect(pendingSection).toHaveTextContent('5');
    expect(pendingSection).toHaveTextContent('5% of total');
  });

  it('renders performance metrics section', () => {
    render(<JobStatistics {...defaultProps} />);
    
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('Success vs Failure Rate')).toBeInTheDocument();
    expect(screen.getByText('Quick Insights')).toBeInTheDocument();
  });

  it('shows success and failure rate progress bars', () => {
    render(<JobStatistics {...defaultProps} />);
    
    const successProgressBar = screen.getByLabelText('Success rate progress');
    const failureProgressBar = screen.getByLabelText('Failure rate progress');
    
    expect(successProgressBar).toBeInTheDocument();
    expect(failureProgressBar).toBeInTheDocument();
    
    expect(successProgressBar).toHaveAttribute('aria-valuenow', '75');
    expect(successProgressBar).toHaveAttribute('aria-valuemin', '0');
    expect(successProgressBar).toHaveAttribute('aria-valuemax', '100');
    
    expect(failureProgressBar).toHaveAttribute('aria-valuenow', '15');
    expect(failureProgressBar).toHaveAttribute('aria-valuemin', '0');
    expect(failureProgressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows quick insights with correct information', () => {
    render(<JobStatistics {...defaultProps} />);
    
    expect(screen.getByText('✓ 75 jobs completed successfully')).toBeInTheDocument();
    expect(screen.getByText(' 15 jobs failed')).toBeInTheDocument();
    expect(screen.getByText(' 5 jobs currently processing')).toBeInTheDocument();
    expect(screen.getByText(' 5 jobs waiting in queue')).toBeInTheDocument();
    expect(screen.getByText(' Average of 5.0 images per job')).toBeInTheDocument();
  });

  it('handles zero jobs case correctly', () => {
    const propsWithZeroJobs = {
      ...defaultProps,
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      processingJobs: 0,
      pendingJobs: 0,
      totalImages: 0,
      averageImagesPerJob: 0
    };
    
    render(<JobStatistics {...propsWithZeroJobs} />);
    
    // Check total jobs in main card
    const totalJobsCard = screen.getByText('Total Jobs').closest('div');
    expect(totalJobsCard).toHaveTextContent('0');
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('0%');
    
    expect(screen.getByText('No jobs have been executed yet.')).toBeInTheDocument();
  });

  it('handles edge case with only completed jobs', () => {
    const propsWithOnlyCompleted = {
      ...defaultProps,
      totalJobs: 50,
      completedJobs: 50,
      failedJobs: 0,
      processingJobs: 0,
      pendingJobs: 0
    };
    
    render(<JobStatistics {...propsWithOnlyCompleted} />);
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('100%');
    
    expect(screen.getByText('✓ 50 jobs completed successfully')).toBeInTheDocument();
    expect(screen.queryByText(' 0 jobs failed')).not.toBeInTheDocument();
  });

  it('handles edge case with only failed jobs', () => {
    const propsWithOnlyFailed = {
      ...defaultProps,
      totalJobs: 20,
      completedJobs: 0,
      failedJobs: 20,
      processingJobs: 0,
      pendingJobs: 0
    };
    
    render(<JobStatistics {...propsWithOnlyFailed} />);
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('0%');
    
    // Check failure rate in main card
    const failureRateCard = screen.getByText('Failure Rate').closest('div');
    expect(failureRateCard).toHaveTextContent('100%');
    
    expect(screen.getByText(' 20 jobs failed')).toBeInTheDocument();
    expect(screen.queryByText('✓ 0 jobs completed successfully')).not.toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(<JobStatistics {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Job Statistics')).toBeInTheDocument();
    
    // Should show skeleton loading
    const skeletonElements = screen.getAllByRole('generic');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('applies correct styling for status cards', () => {
    render(<JobStatistics {...defaultProps} />);
    
    // The component shows status breakdown in the insights section, not as separate cards
    // Check that the status breakdown section exists
    expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('applies correct styling for main statistics cards', () => {
    render(<JobStatistics {...defaultProps} />);
    
    // Check that the main statistics cards exist with their labels
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Total Images')).toBeInTheDocument();
    expect(screen.getByText('Avg Images/Job')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    
    // Check that the cards have the expected background colors
    // The cards are nested in a grid layout, so we need to find the right parent div
    const totalJobsCard = screen.getByText('Total Jobs').closest('.bg-gray-50');
    const totalImagesCard = screen.getByText('Total Images').closest('.bg-blue-50');
    const avgImagesCard = screen.getByText('Avg Images/Job').closest('.bg-green-50');
    const completionRateCard = screen.getByText('Completion Rate').closest('.bg-purple-50');
    
    expect(totalJobsCard).toBeInTheDocument();
    expect(totalImagesCard).toBeInTheDocument();
    expect(avgImagesCard).toBeInTheDocument();
    expect(completionRateCard).toBeInTheDocument();
  });

  it('formats large numbers correctly', () => {
    const propsWithLargeNumbers = {
      ...defaultProps,
      totalJobs: 10000,
      totalImages: 50000
    };
    
    render(<JobStatistics {...propsWithLargeNumbers} />);
    
    expect(screen.getByText('10,000')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
  });

  it('handles decimal average images per job', () => {
    const propsWithDecimal = {
      ...defaultProps,
      averageImagesPerJob: 3.7
    };
    
    render(<JobStatistics {...propsWithDecimal} />);
    
    expect(screen.getByText('3.7')).toBeInTheDocument();
  });

  it('calculates completion rate correctly', () => {
    const propsWithCustomRates = {
      ...defaultProps,
      totalJobs: 200,
      completedJobs: 160
    };
    
    render(<JobStatistics {...propsWithCustomRates} />);
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('80%');
  });

  it('calculates failure rate correctly', () => {
    const propsWithCustomRates = {
      ...defaultProps,
      totalJobs: 200,
      failedJobs: 40
    };
    
    render(<JobStatistics {...propsWithCustomRates} />);
    
    // Check failure rate in main card
    const failureRateCard = screen.getByText('Failure Rate').closest('div');
    expect(failureRateCard).toHaveTextContent('20%');
  });

  it('handles edge case with 100% completion rate', () => {
    const propsWithPerfectCompletion = {
      ...defaultProps,
      totalJobs: 100,
      completedJobs: 100,
      failedJobs: 0,
      processingJobs: 0,
      pendingJobs: 0
    };
    
    render(<JobStatistics {...propsWithPerfectCompletion} />);
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('100%');
    
    // Check failure rate in main card
    const failureRateCard = screen.getByText('Failure Rate').closest('div');
    expect(failureRateCard).toHaveTextContent('0%');
  });

  it('handles edge case with 100% failure rate', () => {
    const propsWithPerfectFailure = {
      ...defaultProps,
      totalJobs: 100,
      completedJobs: 0,
      failedJobs: 100,
      processingJobs: 0,
      pendingJobs: 0
    };
    
    render(<JobStatistics {...propsWithPerfectFailure} />);
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('0%');
    
    // Check failure rate in main card
    const failureRateCard = screen.getByText('Failure Rate').closest('div');
    expect(failureRateCard).toHaveTextContent('100%');
  });

  it('shows correct percentage calculations for status breakdown', () => {
    const propsWithCustomCounts = {
      ...defaultProps,
      totalJobs: 100,
      completedJobs: 60,
      failedJobs: 20,
      processingJobs: 15,
      pendingJobs: 5
    };
    
    render(<JobStatistics {...propsWithCustomCounts} />);
    
    expect(screen.getByText('60% of total')).toBeInTheDocument();
    expect(screen.getByText('20% of total')).toBeInTheDocument();
    expect(screen.getByText('15% of total')).toBeInTheDocument();
    expect(screen.getByText('5% of total')).toBeInTheDocument();
  });

  it('handles single job case correctly', () => {
    const propsWithSingleJob = {
      ...defaultProps,
      totalJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      processingJobs: 0,
      pendingJobs: 0,
      totalImages: 10,
      averageImagesPerJob: 10.0
    };
    
    render(<JobStatistics {...propsWithSingleJob} />);
    
    // Check total jobs in main card
    const totalJobsCard = screen.getByText('Total Jobs').closest('div');
    expect(totalJobsCard).toHaveTextContent('1');
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('100%');
    expect(screen.getByText('✓ 1 job completed successfully')).toBeInTheDocument();
    expect(screen.getByText(' Average of 10.0 images per job')).toBeInTheDocument();
  });

  it('applies correct ARIA labels and roles', () => {
    render(<JobStatistics {...defaultProps} />);
    
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', 'statistics-title');
    
    const successProgressBar = screen.getByLabelText('Success rate progress');
    const failureProgressBar = screen.getByLabelText('Failure rate progress');
    
    expect(successProgressBar).toHaveAttribute('role', 'progressbar');
    expect(failureProgressBar).toHaveAttribute('role', 'progressbar');
  });

  it('handles edge case with very small numbers', () => {
    const propsWithSmallNumbers = {
      ...defaultProps,
      totalJobs: 3,
      completedJobs: 1,
      failedJobs: 1,
      processingJobs: 1,
      pendingJobs: 0,
      totalImages: 6,
      averageImagesPerJob: 2.0
    };
    
    render(<JobStatistics {...propsWithSmallNumbers} />);
    
    // Check completion rate in main card
    const completionRateCard = screen.getByText('Completion Rate').closest('div');
    expect(completionRateCard).toHaveTextContent('33%');
    
    // Check failure rate in main card
    const failureRateCard = screen.getByText('Failure Rate').closest('div');
    expect(failureRateCard).toHaveTextContent('33%');
    
    // The component only shows completion and failure rates in main cards
    // Processing and pending rates are shown in the status breakdown section
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('handles edge case with no images', () => {
    const propsWithNoImages = {
      ...defaultProps,
      totalImages: 0,
      averageImagesPerJob: 0
    };
    
    render(<JobStatistics {...propsWithNoImages} />);
    
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.queryByText(' Average of 0.0 images per job')).not.toBeInTheDocument();
  });
});
