import React from 'react';
import type { LogMode, LogFilterLevel } from '../hooks/useLogViewerState';

export interface LogViewerToolbarProps {
  logMode: LogMode;
  onModeChange: (mode: LogMode) => void;
  filterLevel: LogFilterLevel;
  onFilterLevelChange: (level: LogFilterLevel) => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
}

const LogViewerToolbar: React.FC<LogViewerToolbarProps> = ({
  logMode,
  onModeChange,
  filterLevel,
  onFilterLevelChange,
  autoScroll,
  onAutoScrollChange,
  searchTerm,
  onSearchChange,
  onRefresh,
  onExport
}) => (
  <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center space-x-4">
        <h3 className="text-lg font-medium text-gray-900">Logs</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Mode:</span>
          <div className="flex bg-gray-100 rounded-lg p-1" role="tablist" aria-label="Log viewing mode">
            <button
              onClick={() => onModeChange('standard')}
              role="tab"
              aria-selected={logMode === 'standard'}
              aria-label="Standard log mode"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                logMode === 'standard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => onModeChange('debug')}
              role="tab"
              aria-selected={logMode === 'debug'}
              aria-label="Debug log mode"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                logMode === 'debug' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Debug
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Level:</span>
          <select
            className="ui-select h-8"
            value={filterLevel}
            onChange={(e) => onFilterLevelChange(e.target.value as LogFilterLevel)}
            aria-label="Filter logs by level"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug Level</option>
          </select>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <label className="flex items-center space-x-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => onAutoScrollChange(e.target.checked)}
            aria-label="Auto-scroll to bottom"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Auto-scroll</span>
        </label>
        <button
          onClick={onRefresh}
          aria-label="Refresh logs"
          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="w-3 h-3 mr-1 inline-flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </span>
          Refresh
        </button>
        <button
          onClick={onExport}
          aria-label="Export logs"
          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>
    </div>
    <div className="flex items-center space-x-4">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <input
            id="log-search"
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search logs"
            className="w-full px-3 py-2 pl-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>
  </div>
);

export default LogViewerToolbar;
