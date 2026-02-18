/**
 * Story 3.4 Phase 5c.10: Unit tests for useFileSelector hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFileSelector } from '../useFileSelector';

describe('useFileSelector', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        validatePath: vi.fn().mockResolvedValue({ isValid: true, message: '' }),
        selectFile: vi.fn().mockResolvedValue({ success: false, canceled: true })
      }
    });
  });

  it('initializes with idle validation state', () => {
    const { result } = renderHook(() =>
      useFileSelector({
        value: '',
        onChange: vi.fn(),
        type: 'file',
        fileTypes: ['.txt']
      })
    );
    expect(result.current.validationState).toBe('idle');
    expect(result.current.errorMessage).toBe('');
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('processes accept into file types', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useFileSelector({
        value: '',
        onChange,
        type: 'file',
        accept: '.txt, .csv'
      })
    );
    await act(async () => {
      await result.current.openFileDialog();
    });
    expect(window.electronAPI.selectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'file',
        fileTypes: ['.txt', '.csv'],
        title: 'Select File'
      })
    );
  });

  it('calls onChange when path is cleared', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useFileSelector({
        value: '/some/path',
        onChange,
        type: 'file'
      })
    );
    act(() => {
      result.current.clearPath();
    });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('handlePathChange calls onChange with input value', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useFileSelector({
        value: '',
        onChange,
        type: 'file'
      })
    );
    act(() => {
      result.current.handlePathChange({
        target: { value: '/new/path' }
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(onChange).toHaveBeenCalledWith('/new/path');
  });

  it('openFileDialog calls electronAPI.selectFile and onChange on success', async () => {
    const onChange = vi.fn();
    (window.electronAPI.selectFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      filePath: '/selected/file.txt'
    });
    const { result } = renderHook(() =>
      useFileSelector({
        value: '',
        onChange,
        type: 'file'
      })
    );
    await act(async () => {
      await result.current.openFileDialog();
    });
    expect(onChange).toHaveBeenCalledWith('/selected/file.txt');
  });

  it('does not open dialog when disabled', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useFileSelector({
        value: '',
        onChange,
        type: 'file',
        disabled: true
      })
    );
    await act(async () => {
      await result.current.openFileDialog();
    });
    expect(window.electronAPI.selectFile).not.toHaveBeenCalled();
  });
});
