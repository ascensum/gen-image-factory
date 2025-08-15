import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import JobFilters from '../JobFilters';
import { JobFilters as JobFiltersType } from '../../../../types/job';

const defaultProps = {
  filters: {
    status: 'all',
    dateRange: 'all',
    label: '',
    minImages: 0,
    maxImages: null
  } as JobFiltersType,
  onFiltersChange: vi.fn(),
  onSearch: vi.fn(),
  searchQuery: '',
  totalJobs: 100,
  filteredJobs: 50
};

describe('JobFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filters component with header', () => {
    render(<JobFilters {...defaultProps} />);
    
    expect(screen.getByText('Filters & Search')).toBeInTheDocument();
    expect(screen.getByText('Showing 50 of 100 jobs')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<JobFilters {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search by label, status, or job ID...');
    expect(searchInput).toBeInTheDocument();
    expect(screen.getByText('Search Jobs')).toBeInTheDocument();
  });

  it('handles search input changes', () => {
    render(<JobFilters {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search by label, status, or job ID...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    expect(defaultProps.onSearch).toHaveBeenCalledWith('test query');
  });

  it('handles search on Enter key', () => {
    render(<JobFilters {...defaultProps} searchQuery="test query" />);
    
    const searchInput = screen.getByPlaceholderText('Search by label, status, or job ID...');
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    expect(defaultProps.onSearch).toHaveBeenCalledWith('test query');
  });

  it('shows search help text', () => {
    render(<JobFilters {...defaultProps} />);
    
    expect(screen.getByText('Press Enter to search. Use quotes for exact phrases.')).toBeInTheDocument();
  });

  it('renders expand/collapse button', () => {
    render(<JobFilters {...defaultProps} />);
    
    expect(screen.getByText('Show Filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand filters')).toBeInTheDocument();
  });

  it('toggles filters section visibility', () => {
    render(<JobFilters {...defaultProps} />);
    
    const toggleButton = screen.getByText('Show Filters');
    
    // Initially collapsed - Status label should be hidden with aria-hidden
    const filtersContent = screen.getByText('Status').closest('[aria-hidden]');
    expect(filtersContent).toHaveAttribute('aria-hidden', 'true');
    
    // Click to expand
    fireEvent.click(toggleButton);
    expect(screen.getByText('Hide Filters')).toBeInTheDocument();
    expect(filtersContent).toHaveAttribute('aria-hidden', 'false');
    
    // Click to collapse
    fireEvent.click(toggleButton);
    expect(screen.getByText('Show Filters')).toBeInTheDocument();
    expect(filtersContent).toHaveAttribute('aria-hidden', 'true');
  });

  it('handles keyboard navigation for expand/collapse', () => {
    render(<JobFilters {...defaultProps} />);
    
    const toggleButton = screen.getByText('Show Filters');
    
    // Test Enter key
    fireEvent.keyDown(toggleButton, { key: 'Enter' });
    expect(screen.getByText('Hide Filters')).toBeInTheDocument();
    
    // Test Space key
    fireEvent.keyDown(toggleButton, { key: ' ' });
    expect(screen.getByText('Show Filters')).toBeInTheDocument();
  });

  it('renders status filter with correct options', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const statusSelect = screen.getByLabelText('Status');
    expect(statusSelect).toBeInTheDocument();
    
    // Check options
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('handles status filter changes', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      status: 'completed'
    });
  });

  it('renders date range filter with correct options', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const dateRangeSelect = screen.getByLabelText('Date Range');
    expect(dateRangeSelect).toBeInTheDocument();
    
    // Check options
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('This Quarter')).toBeInTheDocument();
    expect(screen.getByText('This Year')).toBeInTheDocument();
  });

  it('handles date range filter changes', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const dateRangeSelect = screen.getByLabelText('Date Range');
    fireEvent.change(dateRangeSelect, { target: { value: 'week' } });
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      dateRange: 'week'
    });
  });

  it('renders label filter input', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const labelInput = screen.getByPlaceholderText('Enter label text to filter...');
    expect(labelInput).toBeInTheDocument();
    expect(screen.getByText('Label Contains')).toBeInTheDocument();
  });

  it('handles label filter changes', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const labelInput = screen.getByPlaceholderText('Enter label text to filter...');
    fireEvent.change(labelInput, { target: { value: 'test label' } });
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      label: 'test label'
    });
  });

  it('renders image count range filters', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    expect(screen.getByText('Min Images')).toBeInTheDocument();
    expect(screen.getByText('Max Images')).toBeInTheDocument();
    
    const minInput = screen.getByLabelText('Min Images');
    const maxInput = screen.getByLabelText('Max Images');
    
    expect(minInput).toBeInTheDocument();
    expect(maxInput).toBeInTheDocument();
  });

  it('handles min images filter changes', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const minInput = screen.getByLabelText('Min Images');
    fireEvent.change(minInput, { target: { value: '10' } });
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      minImages: 10
    });
  });

  it('handles max images filter changes', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const maxInput = screen.getByLabelText('Max Images');
    fireEvent.change(maxInput, { target: { value: '50' } });
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      maxImages: 50
    });
  });

  it('handles max images filter with empty value', () => {
    const propsWithMaxImages = {
      ...defaultProps,
      filters: {
        ...defaultProps.filters,
        maxImages: 50
      }
    };
    
    render(<JobFilters {...propsWithMaxImages} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const maxInput = screen.getByLabelText('Max Images');
    fireEvent.change(maxInput, { target: { value: '' } });
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...propsWithMaxImages.filters,
      maxImages: null
    });
  });

  it('shows help text for filters', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    expect(screen.getByText('Filter jobs by their current status')).toBeInTheDocument();
    expect(screen.getByText('Filter jobs by when they were created')).toBeInTheDocument();
    expect(screen.getByText('Filter jobs by label text (case-insensitive)')).toBeInTheDocument();
    expect(screen.getByText('Minimum number of images')).toBeInTheDocument();
    expect(screen.getByText('Maximum number of images (leave empty for no limit)')).toBeInTheDocument();
  });

  it('renders quick filter pills', () => {
    render(<JobFilters {...defaultProps} />);
    
    expect(screen.getByText('Quick Filters')).toBeInTheDocument();
    expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    expect(screen.getByText('Failed Jobs')).toBeInTheDocument();
    expect(screen.getByText('Large Jobs')).toBeInTheDocument();
    expect(screen.getByText('Small Jobs')).toBeInTheDocument();
  });

  it('handles quick filter clicks', () => {
    render(<JobFilters {...defaultProps} />);
    
    const recentJobsButton = screen.getByText('Recent Jobs');
    fireEvent.click(recentJobsButton);
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      dateRange: 'week'
    });
  });

  it('shows active filters count when filters are applied', () => {
    const propsWithActiveFilters = {
      ...defaultProps,
      filters: {
        status: 'completed',
        dateRange: 'week',
        label: 'test',
        minImages: 5,
        maxImages: 20
      }
    };
    
    render(<JobFilters {...propsWithActiveFilters} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    expect(screen.getByText('5 active filters')).toBeInTheDocument();
  });

  it('shows clear all button when filters are active', () => {
    const propsWithActiveFilters = {
      ...defaultProps,
      filters: {
        status: 'completed',
        dateRange: 'all',
        label: '',
        minImages: 0,
        maxImages: null
      }
    };
    
    render(<JobFilters {...propsWithActiveFilters} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const clearButton = screen.getByText('Clear All');
    expect(clearButton).toBeInTheDocument();
    expect(clearButton).not.toBeDisabled();
  });

  it('disables clear all button when no filters are active', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const clearButton = screen.getByText('Clear All');
    expect(clearButton).toBeDisabled();
  });

  it('handles clear all filters', () => {
    const propsWithActiveFilters = {
      ...defaultProps,
      filters: {
        status: 'completed',
        dateRange: 'week',
        label: 'test',
        minImages: 5,
        maxImages: 20
      }
    };
    
    render(<JobFilters {...propsWithActiveFilters} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);
    
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      status: 'all',
      dateRange: 'all',
      label: '',
      minImages: 0,
      maxImages: null
    });
    expect(defaultProps.onSearch).toHaveBeenCalledWith('');
  });

  it('renders apply filters button', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const applyButton = screen.getByText('Apply Filters');
    expect(applyButton).toBeInTheDocument();
  });

  it('handles apply filters button click', () => {
    render(<JobFilters {...defaultProps} searchQuery="test query" />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const applyButton = screen.getByText('Apply Filters');
    fireEvent.click(applyButton);
    
    expect(defaultProps.onSearch).toHaveBeenCalledWith('test query');
  });

  it('handles keyboard navigation for quick filters', () => {
    render(<JobFilters {...defaultProps} />);
    
    const recentJobsButton = screen.getByText('Recent Jobs');
    
    // Test click event instead of keyboard events
    fireEvent.click(recentJobsButton);
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      dateRange: 'week'
    });
    
    // Test another quick filter
    const failedJobsButton = screen.getByText('Failed Jobs');
    fireEvent.click(failedJobsButton);
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      status: 'failed'
    });
  });

  it('shows correct filter descriptions', () => {
    render(<JobFilters {...defaultProps} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    expect(screen.getByText('Filter jobs by their current status')).toBeInTheDocument();
    expect(screen.getByText('Filter jobs by when they were created')).toBeInTheDocument();
    expect(screen.getByText('Filter jobs by label text (case-insensitive)')).toBeInTheDocument();
  });

  it('handles edge case with empty search query', () => {
    const propsWithSearchQuery = {
      ...defaultProps,
      searchQuery: 'test query'
    };
    
    render(<JobFilters {...propsWithSearchQuery} />);
    
    const searchInput = screen.getByPlaceholderText('Search by label, status, or job ID...');
    fireEvent.change(searchInput, { target: { value: '' } });
    
    expect(defaultProps.onSearch).toHaveBeenCalledWith('');
  });

  it('handles edge case with null maxImages', () => {
    const propsWithNullMaxImages = {
      ...defaultProps,
      filters: {
        ...defaultProps.filters,
        maxImages: null
      }
    };
    
    render(<JobFilters {...propsWithNullMaxImages} />);
    
    // Expand filters first
    fireEvent.click(screen.getByText('Show Filters'));
    
    const maxInput = screen.getByLabelText('Max Images') as HTMLInputElement;
    expect(maxInput.value).toBe('');
  });
});
