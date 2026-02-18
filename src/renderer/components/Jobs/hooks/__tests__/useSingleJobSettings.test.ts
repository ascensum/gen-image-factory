/**
 * Story 3.4 Phase 5b: Unit tests for useSingleJobSettings hook.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSingleJobSettings } from '../useSingleJobSettings';

const mockJob = {
  id: 1,
  configurationId: 'config-1',
  status: 'completed',
};

const mockConfiguration = {
  id: 'config-1',
  settings: {
    parameters: { label: 'Original', count: 5 },
    processing: { removeBg: false },
  },
};

const mockElectronAPI = {
  getJobConfigurationById: vi.fn(),
  updateJobConfiguration: vi.fn(),
};

(global as any).window = global.window || {};
(global as any).window.electronAPI = mockElectronAPI;

describe('useSingleJobSettings', () => {
  const setJobConfiguration = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.getJobConfigurationById.mockResolvedValue({
      success: true,
      configuration: mockConfiguration,
    });
    mockElectronAPI.updateJobConfiguration.mockResolvedValue({ success: true });
  });

  it('starts with modal closed and no edited settings', () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    expect(result.current.isEditingSettings).toBe(false);
    expect(result.current.editedSettings).toBe(null);
  });

  it('handleSettingsEdit opens modal and loads config from jobConfiguration', async () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });

    expect(result.current.isEditingSettings).toBe(true);
    expect(result.current.editedSettings).not.toBe(null);
    expect(result.current.editedSettings?.parameters?.label).toBe('Original');
  });

  it('handleSettingsEdit fetches config when jobConfiguration has no settings', async () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, null, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });

    await waitFor(() => {
      expect(result.current.isEditingSettings).toBe(true);
    });
    expect(mockElectronAPI.getJobConfigurationById).toHaveBeenCalledWith('config-1');
    expect(result.current.editedSettings?.parameters?.label).toBe('Original');
  });

  it('handleSettingChange updates editedSettings', async () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });

    act(() => {
      result.current.handleSettingChange('parameters', 'label', 'New Label');
    });

    expect(result.current.editedSettings?.parameters?.label).toBe('New Label');
  });

  it('handleToggleChange updates boolean in editedSettings', async () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });

    act(() => {
      result.current.handleToggleChange('processing', 'removeBg')(true);
    });

    expect(result.current.editedSettings?.processing?.removeBg).toBe(true);
  });

  it('handleSettingsCancel closes modal and clears editedSettings', async () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });
    expect(result.current.isEditingSettings).toBe(true);

    act(() => {
      result.current.handleSettingsCancel();
    });
    expect(result.current.isEditingSettings).toBe(false);
    expect(result.current.editedSettings).toBe(null);
  });

  it('handleSettingsSave calls updateJobConfiguration and closes modal', async () => {
    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });
    act(() => {
      result.current.handleSettingChange('parameters', 'label', 'Saved Label');
    });

    await act(async () => {
      await result.current.handleSettingsSave();
    });

    expect(mockElectronAPI.updateJobConfiguration).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        parameters: expect.objectContaining({ label: 'Saved Label' }),
      })
    );
    expect(result.current.isEditingSettings).toBe(false);
  });

  it('handleSettingsSave sets error when update fails', async () => {
    mockElectronAPI.updateJobConfiguration.mockResolvedValue({
      success: false,
      error: 'Save failed',
    });

    const { result } = renderHook(() =>
      useSingleJobSettings(mockJob as any, mockConfiguration, setJobConfiguration)
    );

    await act(async () => {
      result.current.handleSettingsEdit();
    });

    await act(async () => {
      await result.current.handleSettingsSave();
    });

    expect(result.current.settingsSaveError).toBe('Save failed');
    expect(result.current.isEditingSettings).toBe(true);
  });
});
