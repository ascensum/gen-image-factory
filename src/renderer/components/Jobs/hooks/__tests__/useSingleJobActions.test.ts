/**
 * Story 3.4 Phase 5b: Unit tests for useSingleJobActions hook.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSingleJobActions } from '../useSingleJobActions';

describe('useSingleJobActions', () => {
  const onBack = vi.fn();
  const onRerun = vi.fn();
  const onDelete = vi.fn();
  const refreshLogs = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with overview tab and no modals', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    expect(result.current.activeTab).toBe('overview');
    expect(result.current.showDeleteConfirm).toBe(false);
    expect(result.current.showExportDialog).toBe(false);
  });

  it('handleTabChange updates activeTab and calls refreshLogs for logs tab', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleTabChange('images');
    });
    expect(result.current.activeTab).toBe('images');
    expect(refreshLogs).not.toHaveBeenCalled();

    act(() => {
      result.current.handleTabChange('logs');
    });
    expect(result.current.activeTab).toBe('logs');
    expect(refreshLogs).toHaveBeenCalledTimes(1);
  });

  it('handleBack calls onBack', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleBack();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('handleExport opens export dialog', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleExport();
    });
    expect(result.current.showExportDialog).toBe(true);
  });

  it('handleRerun calls onRerun with jobId', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(42, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleRerun();
    });
    expect(onRerun).toHaveBeenCalledWith(42);
  });

  it('handleDelete opens delete confirm', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleDelete();
    });
    expect(result.current.showDeleteConfirm).toBe(true);
  });

  it('handleConfirmDelete calls onDelete and closes confirm', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleDelete();
    });
    expect(result.current.showDeleteConfirm).toBe(true);

    act(() => {
      result.current.handleConfirmDelete();
    });
    expect(onDelete).toHaveBeenCalledWith(1);
    expect(result.current.showDeleteConfirm).toBe(false);
  });

  it('handleCancelDelete closes confirm', () => {
    const { result } = renderHook(() =>
      useSingleJobActions(1, onBack, onRerun, onDelete, refreshLogs)
    );

    act(() => {
      result.current.handleDelete();
    });
    expect(result.current.showDeleteConfirm).toBe(true);

    act(() => {
      result.current.handleCancelDelete();
    });
    expect(result.current.showDeleteConfirm).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
