/**
 * Story 3.4 Phase 5b: Single job settings modal state and handlers.
 * Extracted from SingleJobView.tsx.
 */
import { useState, useCallback } from 'react';
import type { SettingsObject } from '../../../../../types/settings';
import type { JobExecution } from '../../../../../types/job';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function useSingleJobSettings(
  job: JobExecution | null,
  jobConfiguration: any,
  setJobConfiguration: (updater: any) => void
) {
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editedSettings, setEditedSettings] = useState<DeepPartial<SettingsObject> | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const handleSettingsEdit = useCallback(async () => {
    setIsEditingSettings(true);
    setSettingsSaveError(null);
    setIsLoadingSettings(false);
    try {
      if (jobConfiguration?.settings) {
        setEditedSettings(jobConfiguration.settings);
      } else if (job?.configurationId) {
        setIsLoadingSettings(true);
        const result = await window.electronAPI.getJobConfigurationById(job.configurationId);
        if (result.success && result.configuration?.settings) {
          setEditedSettings(result.configuration.settings);
        } else {
          setSettingsSaveError('Job configuration not found. This job may be corrupted.');
        }
      } else {
        setSettingsSaveError('This job was created from the dashboard and has no saved configuration. You can view the job details and generated images, but cannot edit settings. This is normal behavior for dashboard-created jobs.');
      }
    } catch (error) {
      console.error('Error loading job settings:', error);
      setSettingsSaveError('Failed to load job settings');
    } finally {
      setIsLoadingSettings(false);
    }
  }, [job?.configurationId, jobConfiguration]);

  const handleSettingsSave = useCallback(async () => {
    if (!editedSettings || !job?.configurationId) return;
    setIsSavingSettings(true);
    setSettingsSaveError(null);
    try {
      const payload: any = JSON.parse(JSON.stringify(editedSettings));
      try {
        const params = payload.parameters || {};
        if (params.runwareAdvancedEnabled !== true) {
          params.runwareAdvancedEnabled = false;
          params.runwareAdvanced = {};
          payload.parameters = params;
        }
      } catch {}
      const result = await window.electronAPI.updateJobConfiguration(job.configurationId, payload);
      if (result.success) {
        try {
          const refreshed = await window.electronAPI.getJobConfigurationById(job.configurationId);
          if ((refreshed as any)?.success && (refreshed as any)?.configuration?.settings) {
            setJobConfiguration((refreshed as any).configuration);
          } else {
            setJobConfiguration((prev: any) => prev ? { ...prev, settings: editedSettings } : { settings: editedSettings });
          }
        } catch {
          setJobConfiguration((prev: any) => prev ? { ...prev, settings: editedSettings } : { settings: editedSettings });
        }
        setIsEditingSettings(false);
      } else {
        setSettingsSaveError(result.error || 'Failed to save job settings');
      }
    } catch (error) {
      console.error('Error saving job settings:', error);
      setSettingsSaveError('Failed to save job settings');
    } finally {
      setIsSavingSettings(false);
    }
  }, [editedSettings, job?.configurationId, setJobConfiguration]);

  const handleSettingsCancel = useCallback(() => {
    setIsEditingSettings(false);
    setEditedSettings(null);
    setSettingsSaveError(null);
  }, []);

  const handleSettingChange = useCallback((section: string, key: string, value: any) => {
    setEditedSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: { ...prev[section as keyof typeof prev], [key]: value },
      };
    });
  }, []);

  const handleToggleChange = useCallback((section: string, key: string) => (checked: boolean) => {
    handleSettingChange(section, key, checked);
  }, [handleSettingChange]);

  return {
    isEditingSettings,
    setIsEditingSettings,
    editedSettings,
    setEditedSettings,
    isSavingSettings,
    settingsSaveError,
    isLoadingSettings,
    handleSettingsEdit,
    handleSettingsSave,
    handleSettingsCancel,
    handleSettingChange,
    handleToggleChange,
  };
}
