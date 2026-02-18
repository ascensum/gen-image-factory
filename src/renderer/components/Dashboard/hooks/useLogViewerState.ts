import { useState, useMemo } from 'react';
import type { LogEntry } from './useDashboardState';

export type LogMode = 'standard' | 'debug';
export type LogFilterLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

export interface UseLogViewerStateOptions {
  logs: LogEntry[];
}

export function useLogViewerState({ logs }: UseLogViewerStateOptions) {
  const [logMode, setLogMode] = useState<LogMode>('standard');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<LogFilterLevel>('all');

  const handleModeChange = (mode: LogMode) => {
    setLogMode(mode);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (logMode === 'standard' && log.level === 'debug') return false;
      if (filterLevel !== 'all' && log.level !== filterLevel) return false;
      if (searchTerm && !log.message.includes(searchTerm)) return false;
      return true;
    });
  }, [logs, logMode, filterLevel, searchTerm]);

  return {
    logMode,
    setLogMode,
    handleModeChange,
    autoScroll,
    setAutoScroll,
    searchTerm,
    setSearchTerm,
    filterLevel,
    setFilterLevel,
    filteredLogs
  };
}
