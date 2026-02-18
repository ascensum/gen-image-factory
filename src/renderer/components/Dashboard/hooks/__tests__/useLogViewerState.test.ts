/**
 * Story 3.4 Phase 5c.7: Unit tests for useLogViewerState hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLogViewerState } from '../useLogViewerState';

const baseLog = (
  id: string,
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  source: string
) => ({
  id,
  timestamp: new Date('2024-01-01T10:00:00Z'),
  level,
  message,
  source
});

describe('useLogViewerState', () => {
  it('returns all logs when filters are default (standard mode excludes debug)', () => {
    const logs = [
      baseLog('1', 'info', 'Info message', 'a'),
      baseLog('2', 'warn', 'Warn message', 'b'),
      baseLog('3', 'debug', 'Debug message', 'c')
    ];
    const { result } = renderHook(() => useLogViewerState({ logs }));
    expect(result.current.filteredLogs).toHaveLength(2);
    expect(result.current.filteredLogs.map((l) => l.level)).toEqual(['info', 'warn']);
    expect(result.current.logMode).toBe('standard');
    expect(result.current.filterLevel).toBe('all');
    expect(result.current.searchTerm).toBe('');
  });

  it('includes debug logs when mode is debug', () => {
    const logs = [
      baseLog('1', 'info', 'Info', 'a'),
      baseLog('2', 'debug', 'Debug', 'b')
    ];
    const { result } = renderHook(() => useLogViewerState({ logs }));
    act(() => result.current.handleModeChange('debug'));
    expect(result.current.filteredLogs).toHaveLength(2);
    expect(result.current.logMode).toBe('debug');
  });

  it('filters by level when filterLevel is set', () => {
    const logs = [
      baseLog('1', 'info', 'Info', 'a'),
      baseLog('2', 'error', 'Error', 'b')
    ];
    const { result } = renderHook(() => useLogViewerState({ logs }));
    act(() => result.current.setFilterLevel('error'));
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].level).toBe('error');
  });

  it('filters by search term (case-sensitive)', () => {
    const logs = [
      baseLog('1', 'info', 'Hello world', 'a'),
      baseLog('2', 'info', 'Goodbye world', 'b')
    ];
    const { result } = renderHook(() => useLogViewerState({ logs }));
    act(() => result.current.setSearchTerm('Hello'));
    expect(result.current.filteredLogs).toHaveLength(1);
    expect(result.current.filteredLogs[0].message).toBe('Hello world');
  });

  it('returns empty array when no logs match', () => {
    const logs = [baseLog('1', 'info', 'Foo', 'a')];
    const { result } = renderHook(() => useLogViewerState({ logs }));
    act(() => result.current.setSearchTerm('Bar'));
    expect(result.current.filteredLogs).toHaveLength(0);
  });

  it('returns empty array when logs is empty', () => {
    const { result } = renderHook(() => useLogViewerState({ logs: [] }));
    expect(result.current.filteredLogs).toHaveLength(0);
  });
});
