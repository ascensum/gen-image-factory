import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettings, defaultSettings } from '../hooks/useSettings';

const mockGetSettings = vi.fn();
const mockSaveSettings = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = {
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
  };
  mockGetSettings.mockResolvedValue({ success: true, settings: defaultSettings });
  mockSaveSettings.mockResolvedValue(undefined);
});

describe('useSettings', () => {
  it('returns initial state and loads settings on mount', async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetSettings).toHaveBeenCalled();
    expect(result.current.activeTab).toBe('api-keys');
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.showResetDialog).toBe(false);
  });

  it('loadSettings sets form and settings when getSettings succeeds', async () => {
    const loaded = { ...defaultSettings, parameters: { ...defaultSettings.parameters, count: 5 } };
    mockGetSettings.mockResolvedValue({ success: true, settings: loaded });

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.loadSettings();
    });

    expect(result.current.form.parameters.count).toBe(5);
    expect(result.current.settings.parameters.count).toBe(5);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('loadSettings sets localError when getSettings fails', async () => {
    mockGetSettings.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.loadSettings();
    });

    expect(result.current.localError).toBe('Failed to load settings');
    expect(result.current.showError).toBe(true);
  });

  it('handleInputChange updates form and sets hasUnsavedChanges', async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.handleInputChange('parameters', 'count')({
        target: { type: 'number', value: '10' },
      } as any);
    });

    expect(result.current.form.parameters.count).toBe(10);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('handleToggleChange updates form and sets hasUnsavedChanges', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.handleToggleChange('processing', 'removeBg')(true);
    });

    expect(result.current.form.processing.removeBg).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('handleSave calls saveSettings and updates state', async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setForm((prev) => ({ ...prev, parameters: { ...prev.parameters, count: 3 } }));
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ parameters: expect.objectContaining({ count: 3 }) }));
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.localSuccess).toBe('Settings saved');
  });

  it('handleSave sets localError when saveSettings fails', async () => {
    mockSaveSettings.mockRejectedValue(new Error('Save failed'));

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.localError).toBe('Failed to save settings');
  });

  it('handleResetClick opens reset dialog', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.handleResetClick();
    });

    expect(result.current.showResetDialog).toBe(true);
  });

  it('executeReset resets form to defaults and closes dialog', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setForm((prev) => ({ ...prev, parameters: { ...prev.parameters, count: 99 } }));
    });

    act(() => {
      result.current.executeReset(false);
    });

    expect(result.current.form.parameters.count).toBe(1);
    expect(result.current.showResetDialog).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('executeReset with clearApiKeys=false preserves apiKeys', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setForm((prev) => ({
        ...prev,
        apiKeys: { ...prev.apiKeys, openai: 'sk-kept' },
      }));
    });

    act(() => {
      result.current.executeReset(false);
    });

    expect(result.current.form.apiKeys.openai).toBe('sk-kept');
  });

  it('calls onSave when handleSave succeeds', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useSettings({ onSave }));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(result.current.form);
  });

  it('calls onReset when executeReset is called', () => {
    const onReset = vi.fn();
    const { result } = renderHook(() => useSettings({ onReset }));

    act(() => {
      result.current.executeReset(true);
    });

    expect(onReset).toHaveBeenCalled();
  });
});
