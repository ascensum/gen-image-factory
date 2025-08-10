import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LogViewer from '../LogViewer';

describe('LogViewer', () => {
  const mockLogs = [
    {
      id: 'log-1',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      level: 'info',
      message: 'Job started successfully',
      source: 'job-runner'
    },
    {
      id: 'log-2',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      level: 'debug',
      message: 'Processing image 1 of 5',
      source: 'image-generator'
    },
    {
      id: 'log-3',
      timestamp: new Date('2024-01-01T10:02:00Z'),
      level: 'warn',
      message: 'Image quality below threshold',
      source: 'quality-checker'
    },
    {
      id: 'log-4',
      timestamp: new Date('2024-01-01T10:03:00Z'),
      level: 'error',
      message: 'Failed to save image',
      source: 'file-manager'
    }
  ];

  const defaultProps = {
    logs: mockLogs,
    isLoading: false,
    onRefresh: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders log viewer with main sections', () => {
    render(<LogViewer {...defaultProps} />);
    
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
    // Search input uses aria-label instead of visible text
    expect(screen.getByLabelText('Search logs')).toBeInTheDocument();
  });

  it('displays logs in standard mode by default', () => {
    render(<LogViewer {...defaultProps} />);
    
    expect(screen.getByText('Job started successfully')).toBeInTheDocument();
    expect(screen.getByText('Image quality below threshold')).toBeInTheDocument();
    expect(screen.getByText('Failed to save image')).toBeInTheDocument();
    
    // Debug logs should not be visible in standard mode
    expect(screen.queryByText('Processing image 1 of 5')).not.toBeInTheDocument();
  });

  it('switches to debug mode when debug tab is clicked', () => {
    render(<LogViewer {...defaultProps} />);
    
    const debugTab = screen.getByText('Debug');
    fireEvent.click(debugTab);
    
    expect(screen.getByText('Processing image 1 of 5')).toBeInTheDocument();
    expect(screen.getByText('Job started successfully')).toBeInTheDocument();
  });

  it('filters logs by search term', () => {
    render(<LogViewer {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'quality' } });
    
    expect(screen.getByText('Image quality below threshold')).toBeInTheDocument();
    expect(screen.queryByText('Job started successfully')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to save image')).not.toBeInTheDocument();
  });

  it('filters logs by log level', () => {
    render(<LogViewer {...defaultProps} />);
    
    const levelFilter = screen.getByDisplayValue('All Levels');
    fireEvent.change(levelFilter, { target: { value: 'error' } });
    
    expect(screen.getByText('Failed to save image')).toBeInTheDocument();
    expect(screen.queryByText('Job started successfully')).not.toBeInTheDocument();
    expect(screen.queryByText('Image quality below threshold')).not.toBeInTheDocument();
  });

  it('displays correct log level colors', () => {
    render(<LogViewer {...defaultProps} />);
    
    // Info level - blue background
    const infoLog = screen.getByText('Job started successfully').closest('div[class*="bg-blue-50"]');
    expect(infoLog).toHaveClass('bg-blue-50');
    
    // Warning level - yellow background
    const warnLog = screen.getByText('Image quality below threshold').closest('div[class*="bg-yellow-50"]');
    expect(warnLog).toHaveClass('bg-yellow-50');
    
    // Error level - red background
    const errorLog = screen.getByText('Failed to save image').closest('div[class*="bg-red-50"]');
    expect(errorLog).toHaveClass('bg-red-50');
  });

  it('displays correct log level icons', () => {
    render(<LogViewer {...defaultProps} />);
    
    // Check for info icon
    const infoIcon = document.querySelector('svg[class*="text-blue-600"]');
    expect(infoIcon).toBeInTheDocument();
    
    // Check for warning icon
    const warnIcon = document.querySelector('svg[class*="text-yellow-600"]');
    expect(warnIcon).toBeInTheDocument();
    
    // Check for error icon
    const errorIcon = document.querySelector('svg[class*="text-red-600"]');
    expect(errorIcon).toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    render(<LogViewer {...defaultProps} />);
    
    // Should display formatted timestamp for visible logs in standard mode
    expect(screen.getByText(/10:00:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:02:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:03:00/)).toBeInTheDocument();
    
    // Debug log timestamp should not be visible in standard mode
    expect(screen.queryByText(/10:01:00/)).not.toBeInTheDocument();
  });

  it('shows source information', () => {
    render(<LogViewer {...defaultProps} />);
    
    expect(screen.getByText('job-runner')).toBeInTheDocument();
    expect(screen.getByText('quality-checker')).toBeInTheDocument();
    expect(screen.getByText('file-manager')).toBeInTheDocument();
  });

  it('handles empty logs', () => {
    render(<LogViewer {...defaultProps} logs={[]} />);
    
    // The component shows a placeholder message when logs are empty
    expect(screen.getByText('📜 Logs area - scroll when content overflows')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<LogViewer {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading logs...')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const mockOnRefresh = vi.fn();
    render(<LogViewer {...defaultProps} onRefresh={mockOnRefresh} />);
    
    const refreshButton = screen.getByLabelText('Refresh logs');
    fireEvent.click(refreshButton);
    
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('exports logs when export button is clicked', async () => {
    // Mock window.open
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true,
    });

    render(<LogViewer {...defaultProps} />);
    
    const exportButton = screen.getByLabelText('Export logs');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
    });
  });

  it('switches modes without scroll position issues', () => {
    render(<LogViewer {...defaultProps} />);
    
    const logContainer = screen.getByRole('list', { name: 'Log entries' });
    const debugTab = screen.getByText('Debug');
    
    // Should be able to switch to debug mode without errors
    fireEvent.click(debugTab);
    
    // Should display debug logs
    expect(screen.getByText('Processing image 1 of 5')).toBeInTheDocument();
    
    // Should be able to switch back to standard mode
    const standardTab = screen.getByText('Standard');
    fireEvent.click(standardTab);
    
    // Should display standard logs
    expect(screen.getByText('Job started successfully')).toBeInTheDocument();
    expect(screen.queryByText('Processing image 1 of 5')).not.toBeInTheDocument();
  });

  it('scrolls to bottom when new logs arrive', () => {
    const { rerender } = render(<LogViewer {...defaultProps} />);
    
    const logContainer = screen.getByRole('list', { name: 'Log entries' });
    const scrollSpy = vi.spyOn(logContainer, 'scrollTop', 'set');
    
    // Add new logs
    const newLogs = [
      ...defaultProps.logs,
      { id: '4', timestamp: new Date(), level: 'info', message: 'New log entry', source: 'test' }
    ];
    
    rerender(<LogViewer {...defaultProps} logs={newLogs} />);
    
    // Check if scroll to bottom was called
    expect(scrollSpy).toHaveBeenCalledWith(logContainer.scrollHeight);
    
    scrollSpy.mockRestore();
  });

  it('handles case-sensitive search', () => {
    render(<LogViewer {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'QUALITY' } });
    
    // Should not find case-sensitive match
    expect(screen.queryByText('Image quality below threshold')).not.toBeInTheDocument();
  });

  it('handles special characters in search', () => {
    const logsWithSpecialChars = [
      {
        id: 'log-1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        level: 'info',
        message: 'Processing file: test@example.com',
        source: 'file-processor'
      }
    ];
    
    render(<LogViewer {...defaultProps} logs={logsWithSpecialChars} />);
    
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: '@example' } });
    
    expect(screen.getByText('Processing file: test@example.com')).toBeInTheDocument();
  });

  it('filters by multiple criteria', () => {
    render(<LogViewer {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search logs...');
    const levelFilter = screen.getByDisplayValue('All Levels');
    
    // Search for "Image" (with capital I) and filter by warning level
    fireEvent.change(searchInput, { target: { value: 'Image' } });
    fireEvent.change(levelFilter, { target: { value: 'warn' } });
    
    expect(screen.getByText('Image quality below threshold')).toBeInTheDocument();
    expect(screen.queryByText('Job started successfully')).not.toBeInTheDocument();
  });

  it('handles very long log messages', () => {
    const longLogMessage = 'A'.repeat(1000);
    const logsWithLongMessage = [
      {
        id: 'log-1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        level: 'info',
        message: longLogMessage,
        source: 'job-runner'
      }
    ];
    
    render(<LogViewer {...defaultProps} logs={logsWithLongMessage} />);
    
    expect(screen.getByText(longLogMessage)).toBeInTheDocument();
  });

  it('displays log count correctly', () => {
    render(<LogViewer {...defaultProps} />);
    
    // Should show total log count
    expect(screen.getByText(/4 logs/)).toBeInTheDocument();
  });

  it('handles rapid mode switching', () => {
    render(<LogViewer {...defaultProps} />);
    
    const standardTab = screen.getByText('Standard');
    const debugTab = screen.getByText('Debug');
    
    // Rapidly switch between modes
    fireEvent.click(debugTab);
    fireEvent.click(standardTab);
    fireEvent.click(debugTab);
    
    // Should still display debug logs
    expect(screen.getByText('Processing image 1 of 5')).toBeInTheDocument();
  });

  it('provides proper ARIA labels', () => {
    render(<LogViewer {...defaultProps} />);
    
    expect(screen.getByLabelText('Log viewing mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter logs by level')).toBeInTheDocument();
    expect(screen.getByLabelText('Auto-scroll to bottom')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh logs')).toBeInTheDocument();
    expect(screen.getByLabelText('Export logs')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Log entries' })).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<LogViewer {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search logs...');
    const debugTab = screen.getByText('Debug');
    
    // Tab navigation should work
    searchInput.focus();
    expect(searchInput).toHaveFocus();
    
    // Enter key in search should not trigger form submission
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
  });
});
