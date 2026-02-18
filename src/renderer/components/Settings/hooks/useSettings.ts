/**
 * useSettings - Main settings state, load/save, and form handlers.
 * Story 3.4 Phase 2: Extracted from SettingsPanel.tsx. Copy state logic EXACTLY (NO optimizations).
 */
import { useState, useEffect, useCallback } from 'react';
import type { SettingsObject } from '../../../../types/settings';

export type TabId = 'api-keys' | 'files' | 'parameters' | 'processing' | 'ai' | 'advanced';

export const defaultSettings = {
  apiKeys: {
    openai: '',
    piapi: '',
    runware: '',
    removeBg: '',
  },
  filePaths: {
    outputDirectory: '',
    tempDirectory: '',
    systemPromptFile: '',
    keywordsFile: '',
    qualityCheckPromptFile: '',
    metadataPromptFile: '',
  },
  parameters: {
    processMode: 'relax',
    aspectRatios: ['1:1', '16:9', '9:16'],
    mjVersion: '6.1',
    openaiModel: 'gpt-4o',
    runwareModel: 'runware:101@1',
    runwareDimensionsCsv: '',
    runwareFormat: 'png',
    variations: 1,
    runwareAdvancedEnabled: false,
    loraEnabled: false,
    label: '',
    pollingTimeout: 15,
    pollingInterval: 1,
    enablePollingTimeout: true,
    keywordRandom: false,
    count: 1,
    generationRetryAttempts: 1,
    generationRetryBackoffMs: 0,
  },
  processing: {
    removeBg: false,
    removeBgFailureMode: 'soft',
    imageConvert: false,
    imageEnhancement: false,
    sharpening: 5,
    saturation: 1.4,
    convertToJpg: false,
    convertToWebp: false,
    trimTransparentBackground: false,
    jpgBackground: 'white',
    jpgQuality: 85,
    pngQuality: 100,
    webpQuality: 85,
    removeBgSize: 'auto',
  },
  ai: {
    runQualityCheck: true,
    runMetadataGen: true,
  },
  advanced: {
    debugMode: false,
  },
} as SettingsObject;

export interface UseSettingsOptions {
  onSave?: (settings: SettingsObject) => void;
  onReset?: () => void;
  error?: string | null;
  success?: string | null;
}

export function useSettings(options: UseSettingsOptions = {}) {
  const { onSave, onReset, error: propError, success: propSuccess } = options;

  const [settings, setSettings] = useState<SettingsObject>(defaultSettings);
  const [form, setForm] = useState<SettingsObject>(defaultSettings);
  const [formVersion, setFormVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('api-keys');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getSettings) {
        const result = await (window as any).electronAPI.getSettings();
        if (result && result.success && result.settings) {
          setSettings(result.settings as SettingsObject);
          setForm(result.settings as SettingsObject);
          setFormVersion((v) => v + 1);
          setHasUnsavedChanges(false);
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setLocalError('Failed to load settings');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (propError) {
      setLocalError(propError);
      setShowError(true);
    }
  }, [propError]);

  useEffect(() => {
    if (propSuccess) {
      setLocalSuccess(propSuccess);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [propSuccess]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowError(false);
        setShowSuccess(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = useCallback(
    (section: string, key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const input = e.target as HTMLInputElement;
      const isNumber = input.type === 'number';
      const parsed = isNumber ? (input.value === '' ? '' : parseInt(input.value, 10)) : input.value;
      setForm((prev: SettingsObject) => ({
        ...prev,
        [section]: { ...(prev as any)[section], [key]: parsed },
      }));
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleToggleChange = useCallback((section: string, key: string) => (checked: boolean) => {
    setForm((prev: SettingsObject) => ({
      ...prev,
      [section]: { ...(prev as any)[section], [key]: checked },
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.saveSettings) {
        await (window as any).electronAPI.saveSettings(form);
      }
      setSettings(form);
      setHasUnsavedChanges(false);
      setLocalSuccess('Settings saved');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      onSave?.(form);
    } catch (err) {
      console.error('Error saving settings:', err);
      setLocalError('Failed to save settings');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  }, [form, onSave]);

  const handleResetClick = useCallback(() => {
    setShowResetDialog(true);
  }, []);

  const executeReset = useCallback(
    (clearApiKeys: boolean) => {
      const preservedApiKeys = clearApiKeys ? defaultSettings.apiKeys : form.apiKeys;
      const nextDefaults: SettingsObject = { ...defaultSettings, apiKeys: preservedApiKeys };
      setSettings(nextDefaults);
      setForm(nextDefaults);
      setHasUnsavedChanges(true);
      setFormVersion((v) => v + 1);
      setShowResetDialog(false);
      onReset?.();
    },
    [form.apiKeys, onReset]
  );

  return {
    settings,
    form,
    setForm,
    formVersion,
    setFormVersion,
    activeTab,
    setActiveTab,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    showError,
    setShowError,
    showSuccess,
    setShowSuccess,
    localError,
    setLocalError,
    localSuccess,
    setLocalSuccess,
    showResetDialog,
    setShowResetDialog,
    loadSettings,
    handleInputChange,
    handleToggleChange,
    handleSave,
    handleResetClick,
    executeReset,
  };
}
