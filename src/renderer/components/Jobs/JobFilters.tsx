import React, { useState, useCallback, useMemo } from 'react';
import { JobFilters as JobFiltersType } from '../../../types/job';

interface JobFiltersProps {
  filters: JobFiltersType;
  onFiltersChange: (filters: JobFiltersType) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  totalJobs: number;
  filteredJobs: number;
}

const JobFilters: React.FC<JobFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  searchQuery,
  totalJobs,
  filteredJobs
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = useCallback((key: keyof JobFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  }, [onSearch]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Trigger search on Enter
      onSearch(searchQuery);
    }
  }, [searchQuery, onSearch]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      status: 'all',
      dateRange: 'all',
      label: '',
      minImages: 0,
      maxImages: undefined
    });
    onSearch('');
  }, [onFiltersChange, onSearch]);

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleToggleExpandedKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggleExpanded();
    }
  }, [handleToggleExpanded]);

  const hasActiveFilters = useMemo(() => {
    return filters.status !== 'all' ||
           filters.dateRange !== 'all' ||
           (filters.label ?? '') !== '' ||
           (filters.minImages ?? 0) > 0 ||
           filters.maxImages !== undefined;
  }, [filters]);

  const getDateRangeOptions = () => [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' }
  ];

  const getStatusOptions = () => [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'processing', label: 'Processing' },
    { value: 'pending', label: 'Pending' }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900" id="filters-title">
            Filters & Search
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing {filteredJobs} of {totalJobs} jobs
          </p>
        </div>
        
        {/* Expand/Collapse Button */}
        <button
          onClick={handleToggleExpanded}
          onKeyDown={handleToggleExpandedKeyDown}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          aria-expanded={isExpanded}
          aria-controls="filters-content"
          aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
          tabIndex={0}
          role="button"
        >
          <span>{isExpanded ? 'Hide' : 'Show'} Filters</span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Search Bar - Always Visible */}
      <div className="mb-4">
        <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-2">
          Search Jobs
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by label, status, or job ID..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            aria-describedby="search-help"
          />
        </div>
        <p id="search-help" className="mt-1 text-sm text-gray-500">
          Press Enter to search. Use quotes for exact phrases.
        </p>
      </div>

      {/* Expandable Filters Section */}
      <div
        id="filters-content"
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isExpanded}
      >
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              className="ui-select"
              id="status-filter"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              aria-describedby="status-help"
            >
              {getStatusOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p id="status-help" className="mt-1 text-sm text-gray-500">
              Filter jobs by their current status
            </p>
          </div>

          {/* Date Range Filter */}
          <div>
            <label htmlFor="date-range-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              className="ui-select"
              id="date-range-filter"
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              aria-describedby="date-range-help"
            >
              {getDateRangeOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p id="date-range-help" className="mt-1 text-sm text-gray-500">
              Filter jobs by when they were created
            </p>
          </div>

          {/* Label Filter */}
          <div>
            <label htmlFor="label-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Label Contains
            </label>
            <input
              id="label-filter"
              type="text"
              value={filters.label}
              onChange={(e) => handleFilterChange('label', e.target.value)}
              placeholder="Enter label text to filter..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              aria-describedby="label-help"
            />
            <p id="label-help" className="mt-1 text-sm text-gray-500">
              Filter jobs by label text (case-insensitive)
            </p>
          </div>

          {/* Image Count Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="min-images-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Min Images
              </label>
              <input
                id="min-images-filter"
                type="number"
                min="0"
                value={filters.minImages}
                onChange={(e) => handleFilterChange('minImages', parseInt(e.target.value) || 0)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                aria-describedby="min-images-help"
              />
              <p id="min-images-help" className="mt-1 text-sm text-gray-500">
                Minimum number of images
              </p>
            </div>
            
            <div>
              <label htmlFor="max-images-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Max Images
              </label>
              <input
                id="max-images-filter"
                type="number"
                min="0"
                value={filters.maxImages || ''}
                onChange={(e) => handleFilterChange('maxImages', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="No limit"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                aria-describedby="max-images-help"
              />
              <p id="max-images-help" className="mt-1 text-sm text-gray-500">
                Maximum number of images (leave empty for no limit)
              </p>
            </div>
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {Object.values(filters).filter(v => v !== 'all' && v !== '' && v !== 0 && v !== null).length} active filters
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearFilters}
              disabled={!hasActiveFilters && !searchQuery}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                !hasActiveFilters && !searchQuery
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              aria-label="Clear all filters and search"
              aria-disabled={!hasActiveFilters && !searchQuery}
            >
              Clear All
            </button>
            
            <button
              onClick={() => onSearch(searchQuery)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Apply current filters and search"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filter Pills */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Filters</h4>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Recent Jobs', action: () => handleFilterChange('dateRange', 'week') },
            { label: 'Failed Jobs', action: () => handleFilterChange('status', 'failed') },
            { label: 'Large Jobs', action: () => handleFilterChange('minImages', 10) },
            { label: 'Small Jobs', action: () => handleFilterChange('maxImages', 5) }
          ].map((quickFilter, index) => (
            <button
              key={index}
              onClick={quickFilter.action}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label={`Quick filter: ${quickFilter.label}`}
            >
              {quickFilter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JobFilters;
