import React, { useState, useCallback, useMemo } from 'react';
import { JobFilters as JobFiltersType } from '../../types/job';

interface JobConfiguration {
  id: string;
  name: string;
}

interface JobFiltersProps {
  filters: JobFiltersType;
  onFiltersChange: (filters: JobFiltersType) => void;
  onClearFilters: () => void;
  availableConfigurations: JobConfiguration[];
  isLoading: boolean;
}

const JobFilters: React.FC<JobFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  availableConfigurations,
  isLoading
}) => {
  const [localFilters, setLocalFilters] = useState<JobFiltersType>(filters);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Status options
  const statusOptions = [
    { value: 'all', label: 'All Statuses', color: 'gray' },
    { value: 'completed', label: 'Completed', color: 'green' },
    { value: 'failed', label: 'Failed', color: 'red' },
    { value: 'running', label: 'Running', color: 'blue' },
    { value: 'stopped', label: 'Stopped', color: 'yellow' },
    { value: 'pending', label: 'Pending', color: 'orange' }
  ];

  // Quick date ranges
  const quickDateRanges = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 days', value: '7days' },
    { label: 'Last 30 days', value: '30days' },
    { label: 'Last 90 days', value: '90days' }
  ];

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof JobFiltersType, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    
    // Apply filters immediately for most fields
    if (key !== 'search') {
      onFiltersChange(newFilters);
    }
  }, [localFilters, onFiltersChange]);

  // Handle search with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setLocalFilters(prev => ({ ...prev, search: value }));
    
    // Clear existing timeout
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    // Set new timeout for search
    const timeout = setTimeout(() => {
      onFiltersChange({ ...localFilters, search: value });
    }, 300);
    
    setSearchDebounce(timeout);
  }, [localFilters, onFiltersChange, searchDebounce]);

  // Handle quick date range selection
  const handleQuickDateRange = useCallback((range: string) => {
    const now = new Date();
    let dateFrom: Date | undefined;
    
    switch (range) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7days':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const newFilters = { 
      ...localFilters, 
      dateFrom,
      dateTo: now
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  }, [localFilters, onFiltersChange]);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    const clearedFilters = {
      status: 'all',
      limit: 25,
      offset: 0
    };
    setLocalFilters(clearedFilters);
    onClearFilters();
  }, [onClearFilters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.status !== 'all' ||
      filters.configurationId ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search
    );
  }, [filters]);

  // Format date for input
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Parse date from input
  const parseDateFromInput = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            id="status-filter"
            value={localFilters.status || 'all'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isLoading}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Configuration Filter */}
        <div>
          <label htmlFor="config-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Configuration
          </label>
          <select
            id="config-filter"
            value={localFilters.configurationId || ''}
            onChange={(e) => handleFilterChange('configurationId', e.target.value || undefined)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isLoading}
          >
            <option value="">All Configurations</option>
            {availableConfigurations.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={formatDateForInput(localFilters.dateFrom)}
              onChange={(e) => handleFilterChange('dateFrom', parseDateFromInput(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              disabled={isLoading}
            />
            <input
              type="date"
              value={formatDateForInput(localFilters.dateTo)}
              onChange={(e) => handleFilterChange('dateTo', parseDateFromInput(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Search Filter */}
        <div>
          <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            id="search-filter"
            value={localFilters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search jobs..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Quick Date Range Buttons */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick Ranges
        </label>
        <div className="flex flex-wrap gap-2">
          {quickDateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => handleQuickDateRange(range.value)}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isLoading}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page Size Filter */}
      <div className="mt-4">
        <label htmlFor="page-size-filter" className="block text-sm font-medium text-gray-700 mb-2">
          Page Size
        </label>
        <select
          id="page-size-filter"
          value={localFilters.limit || 25}
          onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          disabled={isLoading}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
};

export default JobFilters;
