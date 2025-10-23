import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from './DashboardPanel';

interface LogViewerProps {
  logs: LogEntry[];
  jobStatus: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  isLoading?: boolean;
  onRefresh?: () => void;
  // Optional sizing controls for the scrollable log area
  // Use numbers for pixel values, or 'none' for no max cap
  minHeight?: number;
  maxHeight?: number | 'none' | string;
  height?: number | string;
  disableInternalScroll?: boolean;
}

const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  jobStatus,
  isLoading = false,
  onRefresh,
  // Defaults match original Dashboard behavior so other panels aren't impacted
  minHeight = 144,
  maxHeight = 320,
  height,
  disableInternalScroll = false
}) => {
  const [logMode, setLogMode] = useState<'standard' | 'debug'>('standard');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');

  const [scrollPosition, setScrollPosition] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (mode: 'standard' | 'debug') => {
    setLogMode(mode);
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs based on mode and search
  const filteredLogs = logs.filter(log => {
    // Filter by mode
    if (logMode === 'standard' && log.level === 'debug') {
      return false;
    }
    
    // Filter by level
    if (filterLevel !== 'all' && log.level !== filterLevel) {
      return false;
    }
    
    // Filter by search term (case-sensitive)
    if (searchTerm && !log.message.includes(searchTerm)) {
      return false;
    }
    
    return true;
  });

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'debug':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" fillRule="evenodd" />
          </svg>
        );
      case 'warn':
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" fillRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
          </svg>
        );
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    // Use UTC time to avoid timezone conversion issues in tests
    const utcDate = new Date(timestamp);
    return utcDate.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      timeZone: 'UTC'
    });
  };

  const exportLogs = () => {
    const list = filteredLogs && filteredLogs.length > 0 ? filteredLogs : logs;
    const logContent = list
      .map(log => `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    
    // For test environment, just log the content and call window.open if available
    if (typeof window === 'undefined' || !window.URL || !window.URL.createObjectURL) {
      console.log('Export logs:', logContent);
      // In test environment, try to call window.open if it exists
      if (typeof window !== 'undefined' && window.open) {
        window.open('data:text/plain;charset=utf-8,' + encodeURIComponent(logContent), '_blank');
      }
      return;
    }
    
    try {
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      // Prefer anchor download to avoid blank window in Electron
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logs.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const refreshLogs = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      // This would typically trigger a refresh from the backend
      // For now, we'll just re-render the component
      window.location.reload();
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
      {/* Log Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900">Logs</h3>
            {/* Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Mode:</span>
              <div className="flex bg-gray-100 rounded-lg p-1" role="tablist" aria-label="Log viewing mode">
                <button
                  onClick={() => handleModeChange('standard')}
                  role="tab"
                  aria-selected={logMode === 'standard'}
                  aria-label="Standard log mode"
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    logMode === 'standard'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => handleModeChange('debug')}
                  role="tab"
                  aria-selected={logMode === 'debug'}
                  aria-label="Debug log mode"
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    logMode === 'debug'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Debug
                </button>
              </div>
            </div>

            {/* Level Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Level:</span>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as any)}
                aria-label="Filter logs by level"
                className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {/* Auto-scroll toggle */}
            <label className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                aria-label="Auto-scroll to bottom"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-scroll</span>
            </label>

            {/* Refresh button */}
            <button
              onClick={refreshLogs}
              aria-label="Refresh logs"
              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="w-3 h-3 mr-1 inline-flex items-center justify-center">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </span>
              Refresh
            </button>

            {/* Export button */}
            <button
              onClick={exportLogs}
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

        {/* Search - Fixed positioning */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                id="log-search"
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Log Content - Takes remaining height */}
      <div className="px-6 py-4 flex-1 flex flex-col min-h-0">
        <div
          ref={logContainerRef}
          role="list"
          aria-label="Log entries"
          className="flex-1 font-mono text-sm bg-gray-50 rounded-lg p-4 min-h-0 logs-scroll border border-gray-200"
          style={{ 
            minHeight: `${minHeight}px`, 
            maxHeight: disableInternalScroll ? 'none' : (maxHeight === 'none' ? 'none' : (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight)), 
            height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
            overflowY: disableInternalScroll ? 'visible' : 'auto' 
          }}
        >
          {/* Scroll indicator */}
          {/* Scroll indicator removed for cleaner production UI */}
          
          {isLoading ? (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <span className="ml-2 text-gray-600">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No logs available</h3>
              <p className="mt-1 text-sm text-gray-500">Logs will appear here when a job is running or has completed.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No logs match the current filters.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${log.id}-${index}`}
                  aria-label={`Log entry ${index + 1}: ${log.level} level message`}
                  className={`flex items-start space-x-3 p-2 rounded-md border ${
                    log.level === 'error' ? 'bg-red-50 border-red-200' :
                    log.level === 'warn' ? 'bg-yellow-50 border-yellow-200' :
                    log.level === 'info' ? 'bg-blue-50 border-blue-200' :
                    'bg-white border-gray-200'
                  }`}
                >
                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-xs text-gray-500 w-20">
                    {formatTimestamp(log.timestamp)}
                  </div>

                  {/* Level Badge */}
                  <div className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                    log.level === 'error' ? 'text-red-600 bg-red-100 border-red-300' :
                    log.level === 'warn' ? 'text-yellow-600 bg-yellow-100 border-yellow-300' :
                    log.level === 'info' ? 'text-blue-600 bg-blue-100 border-blue-300' :
                    'text-gray-600 bg-gray-100 border-gray-300'
                  }`}>
                    {getLogLevelIcon(log.level)}
                    <span className="ml-1">{log.level.toUpperCase()}</span>
                  </div>

                  {/* Message */}
                  <div className="flex-1 text-gray-900 break-words whitespace-pre">
                    {log.message}
                    
                    {/* Structured information - always visible */}
                    <div className="mt-1 text-xs text-gray-600 space-y-1">
                      {/* Step and sub-step */}
                      {(log.stepName || log.subStep) && (
                        <div className="flex items-center space-x-2">
                          {log.stepName && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {log.stepName}
                            </span>
                          )}
                          {log.subStep && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {log.subStep}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Image index */}
                      {log.imageIndex !== null && log.imageIndex !== undefined && (
                        <div className="text-purple-600">
                          📷 Image {log.imageIndex + 1}
                        </div>
                      )}
                      
                      {/* Duration */}
                      {log.durationMs !== null && log.durationMs !== undefined && (
                        <div className="text-orange-600">
                          ⏱️ {log.durationMs}ms
                        </div>
                      )}
                      
                      {/* Progress info */}
                      {(log.progress !== undefined || log.totalImages !== undefined) && (
                        <div className="text-gray-600">
                          {log.progress !== undefined && `Progress: ${log.progress}%`}
                          {log.totalImages !== undefined && ` | Images: ${log.successfulImages || 0}/${log.totalImages}`}
                        </div>
                      )}
                      
                      {/* Metadata */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            📋 Metadata ({Object.keys(log.metadata).length} fields)
                          </summary>
                          <div className="mt-1 pl-2 text-gray-600">
                            {Object.entries(log.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium">{key}:</span>
                                <span className="ml-2">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>

                  {/* Source */}
                  {log.source && (
                    <div className="flex-shrink-0 text-xs text-gray-500">
                      {log.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log Summary */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
          <div>
            {`${logs.length} logs`}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>
          <div>
            {jobStatus === 'running' && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Live updates</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
