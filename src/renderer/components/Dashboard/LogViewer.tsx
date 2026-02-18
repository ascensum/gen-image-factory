import React, { useEffect, useRef } from 'react';
import type { LogEntry } from './hooks/useDashboardState';
import { useLogViewerState } from './hooks/useLogViewerState';
import { formatTimestamp } from './utils/logViewerUtils';
import LogViewerToolbar from './components/LogViewerToolbar';
import LogViewerEntryRow from './components/LogViewerEntryRow';
import LogViewerEmptyState from './components/LogViewerEmptyState';
import LogViewerSummary from './components/LogViewerSummary';

export interface LogViewerProps {
  logs: LogEntry[];
  jobStatus: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  isLoading?: boolean;
  onRefresh?: () => void;
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
  minHeight = 144,
  maxHeight = 320,
  height,
  disableInternalScroll = false
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const {
    logMode,
    handleModeChange,
    autoScroll,
    setAutoScroll,
    searchTerm,
    setSearchTerm,
    filterLevel,
    setFilterLevel,
    filteredLogs
  } = useLogViewerState({ logs });

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const exportLogs = () => {
    const list = filteredLogs.length > 0 ? filteredLogs : logs;
    const logContent = list
      .map(log => `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    if (typeof window === 'undefined' || !window.URL?.createObjectURL) {
      console.log('Export logs:', logContent);
      if (typeof window !== 'undefined' && window.open) {
        window.open('data:text/plain;charset=utf-8,' + encodeURIComponent(logContent), '_blank');
      }
      return;
    }
    try {
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
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
    if (onRefresh) onRefresh();
    else window.location.reload();
  };

  const emptyVariant = isLoading ? 'loading' : logs.length === 0 ? 'empty' : 'noMatch';
  const showEmpty = isLoading || logs.length === 0 || filteredLogs.length === 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
      <LogViewerToolbar
        logMode={logMode}
        onModeChange={handleModeChange}
        filterLevel={filterLevel}
        onFilterLevelChange={setFilterLevel}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={refreshLogs}
        onExport={exportLogs}
      />
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
          {showEmpty ? (
            <LogViewerEmptyState variant={isLoading ? 'loading' : logs.length === 0 ? 'empty' : 'noMatch'} />
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <LogViewerEntryRow key={`${log.id}-${index}`} log={log} index={index} />
              ))}
            </div>
          )}
        </div>
        <LogViewerSummary totalCount={logs.length} searchTerm={searchTerm} jobStatus={jobStatus} />
      </div>
    </div>
  );
};

export default LogViewer;
