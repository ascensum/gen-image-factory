import React, { useState, useEffect, useRef } from 'react';
import { AppLogo } from '../Common/AppLogo';
import type { SettingsObject as SharedSettingsObject } from '../../../types/settings';
import { Eye, EyeOff, Save, RotateCcw, AlertCircle, CheckCircle, X, Key, FolderOpen, Sliders, Cog, Settings } from 'lucide-react';
import { Toggle } from './Toggle';
import { FileSelector } from './FileSelector';

// Types and Interfaces
interface SettingsObject extends SharedSettingsObject {
  apiKeys: {
    openai: string;
    piapi: string;
    runware: string;
    removeBg: string;
  };
  filePaths: {
    outputDirectory: string;
    tempDirectory: string;
    systemPromptFile: string;
    keywordsFile: string;
    qualityCheckPromptFile: string;
    metadataPromptFile: string;
  };
  parameters: {
    processMode: string;
    aspectRatios: string[];
    mjVersion: string;
    openaiModel: string;
    // Runware
    runwareModel?: string;
    runwareDimensionsCsv?: string;
    runwareFormat?: 'png' | 'jpg' | 'webp';
    variations?: number;
    runwareAdvanced?: {
      lora?: Array<{ model: string; weight?: number }>;
      checkNSFW?: boolean;
      scheduler?: string;
      CFGScale?: number;
      steps?: number;
    };
    label?: string;
    pollingTimeout: number;
    pollingInterval: number;
    enablePollingTimeout: boolean;
    keywordRandom: boolean;
    count: number;
    generationRetryAttempts?: number;
    generationRetryBackoffMs?: number;
  };
  processing: {
    removeBg: boolean;
    imageConvert: boolean; // Master switch for image conversion
    imageEnhancement: boolean; // New: Image enhancement toggle
    sharpening: number; // New: Sharpening intensity (0-10)
    saturation: number; // New: Saturation level (0-2)
    convertToJpg: boolean;
    trimTransparentBackground: boolean;
    jpgBackground: string;
    jpgQuality: number;
    pngQuality: number;
    removeBgSize: string;
  };
  ai: {
    runQualityCheck: boolean;
    runMetadataGen: boolean;
  };
  advanced: {
    debugMode: boolean;
  };
}

interface SettingsPanelProps {
  onSave?: (settings: SettingsObject) => void;
  onReset?: () => void;
  onBack?: () => void;
  onOpenDashboard?: () => void;
  isLoading?: boolean;
  error?: string | null;
  success?: string | null;
}

type TabId = 'api-keys' | 'files' | 'parameters' | 'processing' | 'ai' | 'advanced';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Default settings based on backend requirements
const defaultSettings: SettingsObject = {
  apiKeys: {
    openai: '',
    piapi: '',
    runware: '',
    removeBg: '',
  },
  filePaths: {
    outputDirectory: '', // Will be set by backend with proper cross-platform paths
    tempDirectory: '',   // Will be set by backend with proper cross-platform paths
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
    imageConvert: false, // Master switch for image conversion
    imageEnhancement: false, // Image enhancement toggle
    sharpening: 5, // Sharpening intensity (0-10)
    saturation: 1.4, // Saturation level (0-2)
    convertToJpg: false,
    trimTransparentBackground: false,
    jpgBackground: 'white',
    jpgQuality: 100,
    pngQuality: 100,
    removeBgSize: 'auto',
  },
  ai: {
    runQualityCheck: true,
    runMetadataGen: true,
  },
  advanced: {
    debugMode: false,
  },
};

// Tab configuration
const tabs: Tab[] = [
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'files', label: 'File Paths', icon: FolderOpen },
  { id: 'parameters', label: 'Parameters', icon: Sliders },
  { id: 'processing', label: 'Processing', icon: Cog },
  { id: 'ai', label: 'AI Features', icon: Settings },
  { id: 'advanced', label: 'Advanced', icon: Settings },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onSave,
  onReset,
  onBack,
  onOpenDashboard,
  isLoading = false,
  error = null,
  success = null
}) => {
  const [settings, setSettings] = useState<SettingsObject>(defaultSettings);
  const [form, setForm] = useState<SettingsObject>(defaultSettings);
  // Draft inputs removed; using uncontrolled inputs with blur commit for stability
  const [activeTab, setActiveTab] = useState<TabId>('api-keys');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({
    openai: false,
    piapi: false,
    runware: false,
    removeBg: false,
  });
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRunwareAdvanced, setShowRunwareAdvanced] = useState(false);
  
  // Refs to maintain focus
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getSettings) {
          const result = await window.electronAPI.getSettings();
          if (result && result.success && result.settings) {
            setSettings(result.settings as SettingsObject);
            setForm(result.settings as SettingsObject);
          }
        } else {
          console.log('Electron API not available, using default settings');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Handle input changes with focus preservation
  const handleInputChange = (section: string, key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const input = e.target as HTMLInputElement;
    const isNumber = input.type === 'number';
    const parsed = isNumber ? (input.value === '' ? '' : parseInt(input.value, 10)) : input.value;
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section as keyof typeof prev], [key]: parsed as any }
    }));
    setHasUnsavedChanges(true);
    // Do not force focus/selection restoration; let the browser manage it to avoid focus jitter
  };

  // Handle toggle changes
  const handleToggleChange = (section: string, key: string) => (checked: boolean) => {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section as keyof typeof prev], [key]: checked }
    }));
    setHasUnsavedChanges(true);
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Handle keyboard navigation
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

  // Handle save
  const handleSave = async () => {
    try {
      if (window.electronAPI && window.electronAPI.saveSettings) {
        await window.electronAPI.saveSettings(form);
      }
      setSettings(form);
      setHasUnsavedChanges(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      if (onSave) {
        onSave(settings);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  // Handle reset
  const handleReset = () => {
    setSettings(defaultSettings);
    setHasUnsavedChanges(true);
    if (onReset) {
      onReset();
    }
  };

  // Handle error and success states
  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [success]);

  // API Keys Section
  const ApiKeysSection = () => (
    <div className="space-y-6" data-testid="api-keys-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
        <Key className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        {Object.entries({
          openai: 'OpenAI API Key',
          runware: 'Runware API Key',
          piapi: 'PiAPI (Midjourney) API Key',
          removeBg: 'Remove.bg API Key'
        }).map(([key, label]) => {
          const inputId = `apiKeys-${key}`;
          return (
            <div key={key}>
              <label htmlFor={`${key}-key`} className="block text-sm font-medium text-gray-700 mb-2">
                {label}
              </label>
              <div className="relative">
                <input
                  id={`${key}-key`}
                  data-testid={`${key}-api-key-input`}
                  ref={(el) => { inputRefs.current[inputId] = el; }}
                  type={showPasswords[key] ? 'text' : 'password'}
                  defaultValue={form.apiKeys[key as keyof typeof form.apiKeys]}
                  onBlur={(e) => {
                    const val = e.currentTarget.value;
                    setForm(prev => ({ ...prev, apiKeys: { ...prev.apiKeys, [key]: val } }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter ${key} API key...`}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(key)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPasswords[key] ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // File Paths Section
  const FilePathsSection = () => (
    <div className="space-y-6" data-testid="file-paths-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">File Paths</h3>
        <FolderOpen className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-6">
        <FileSelector
          label="Output Directory"
          value={form.filePaths.outputDirectory}
          onChange={(path: string) => handleInputChange('filePaths', 'outputDirectory')({ target: { value: path } } as any)}
          type="directory"
          placeholder="Select directory for processed images"
          required={false}
        />

        <FileSelector
          label="Temp Directory"
          value={form.filePaths.tempDirectory}
          onChange={(path: string) => handleInputChange('filePaths', 'tempDirectory')({ target: { value: path } } as any)}
          type="directory"
          placeholder="Select directory for temporary files"
          required={false}
        />

        <FileSelector
          label="System Prompt File"
          value={form.filePaths.systemPromptFile}
          onChange={(path: string) => handleInputChange('filePaths', 'systemPromptFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt']}
          placeholder="Select system prompt file (.txt only)"
          required={false}
        />

        <FileSelector
          label="Keywords File"
          value={form.filePaths.keywordsFile}
          onChange={(path: string) => handleInputChange('filePaths', 'keywordsFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt', '.csv']}
          placeholder="Select keywords file (.txt or .csv)"
          required={false}
        />

        <FileSelector
          label="Quality Check Prompt File"
          value={form.filePaths.qualityCheckPromptFile}
          onChange={(path: string) => handleInputChange('filePaths', 'qualityCheckPromptFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt']}
          placeholder="Select quality check prompt file (.txt only)"
          required={false}
        />

        <FileSelector
          label="Metadata Prompt File"
          value={form.filePaths.metadataPromptFile}
          onChange={(path: string) => handleInputChange('filePaths', 'metadataPromptFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt']}
          placeholder="Select metadata prompt file (.txt only)"
          required={false}
        />
      </div>
    </div>
  );

  // Parameters Section
  const ParametersSection = () => (
    <div className="space-y-6" data-testid="parameters-section">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Model Parameters</h3>
        <p className="text-sm text-gray-600 mb-6">Configure parameters for Runware and OpenAI.</p>
      </div>

      <div className="space-y-6">
        {/* Job Label */}
        <div>
          <label htmlFor="job-label" className="block text-sm font-medium text-gray-700 mb-2">
            Job Name / Label
          </label>
          <input
            id="job-label"
            type="text"
            defaultValue={(form.parameters as any)?.label || ''}
            onBlur={(e) => {
              const val = e.currentTarget.value;
              setForm(prev => ({ ...prev, parameters: { ...prev.parameters, label: val } }));
              setHasUnsavedChanges(true);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Optional label shown in Dashboard and Job views"
          />
          <p className="text-xs text-gray-500 mt-1">If empty, a default job_timestamp label will be used.</p>
        </div>

        {/* Runware Settings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">Runware Settings</h4>
          
          <div>
            <label htmlFor="runware-model" className="block text-sm font-medium text-gray-700 mb-2">
              Runware Model
            </label>
            <input
              id="runware-model"
              type="text"
              defaultValue={form.parameters.runwareModel || 'runware:101@1'}
              onBlur={(e) => {
                const val = e.currentTarget.value;
                setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareModel: val || 'runware:101@1' } }));
                setHasUnsavedChanges(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="runware:101@1"
            />
            <p className="text-xs text-gray-500 mt-1">Freeform model id. Defaults to runware:101@1.</p>
          </div>

          <div>
            <label htmlFor="runware-dimensions" className="block text-sm font-medium text-gray-700 mb-2">
              Image Dimensions (CSV)
            </label>
            <input
              id="runware-dimensions"
              type="text"
              defaultValue={form.parameters.runwareDimensionsCsv || ''}
              onBlur={(e) => {
                const val = (e.currentTarget.value || '').trim();
                setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareDimensionsCsv: val } }));
                setHasUnsavedChanges(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1024x1024,1280x720,720x1280"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to use provider defaults (typically square).</p>
          </div>

          <div>
            <label htmlFor="runware-format" className="block text-sm font-medium text-gray-700 mb-2">
              Output Format
            </label>
            <select
              id="runware-format"
              value={form.parameters.runwareFormat || 'png'}
              onChange={handleInputChange('parameters', 'runwareFormat')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WEBP</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Processing conversions support JPG/PNG only in this story.</p>
          </div>

          {/* Variations moved to Generation Settings */}
        </div>

        {/* OpenAI Settings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">OpenAI Settings</h4>
          
          <div>
            <label htmlFor="openai-model" className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI Model
            </label>
            <input
              id="openai-model"
              type="text"
              defaultValue={form.parameters.openaiModel}
              onBlur={(e) => {
                const val = e.currentTarget.value;
                setForm(prev => ({ ...prev, parameters: { ...prev.parameters, openaiModel: val } }));
                setHasUnsavedChanges(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., gpt-4o, gpt-4.1, gpt-4o-mini"
            />
            <p className="text-xs text-gray-500 mt-1">Type any supported model identifier.</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enable Polling Timeout
              </label>
              <p className="text-xs text-gray-500">Use custom polling timeout instead of default (30 seconds)</p>
            </div>
            <Toggle
              checked={form.parameters.enablePollingTimeout}
              onChange={handleToggleChange('parameters', 'enablePollingTimeout')}
            />
          </div>

          {/* Polling Timeout - only show when enabled */}
          {form.parameters.enablePollingTimeout && (
            <div>
              <label htmlFor="polling-timeout" className="block text-sm font-medium text-gray-700 mb-2">
                Polling Timeout (minutes)
              </label>
              <input
                id="polling-timeout"
                ref={(el) => { inputRefs.current['parameters-pollingTimeout'] = el; }}
                type="number"
                defaultValue={String(form.parameters.pollingTimeout)}
                onBlur={(e) => {
                  const v = parseInt(e.currentTarget.value || '0', 10);
                  const clamped = Math.min(60, Math.max(1, isNaN(v) ? 1 : v));
                  setForm(prev => ({ ...prev, parameters: { ...prev.parameters, pollingTimeout: clamped } }));
                  setHasUnsavedChanges(true);
                }}
                onWheel={(e) => { e.currentTarget.blur(); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="60"
              />
              <p className="text-xs text-gray-500 mt-1">Used as HTTP timeout for Runware (minutes). For Runware, we ignore polling interval.</p>
            </div>
          )}
        </div>

        {/* Advanced Controls (Runware) - collapsible */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-800">Runware Advanced Controls</h4>
            <Toggle
              checked={showRunwareAdvanced}
              onChange={(checked) => setShowRunwareAdvanced(checked)}
            />
          </div>
          <p className="text-xs text-gray-600">Note: Check Runware model docs for valid ranges and supported fields. Defaults may be used if fields are empty. Not all models support these settings.</p>

          {showRunwareAdvanced && (
          <div>
            {/* LoRA list (simple textarea for MVP) */}
            <div>
            <label htmlFor="runware-lora" className="block text-sm font-medium text-gray-700 mb-2">
              LoRA list (model:weight per line)
            </label>
            <textarea
              id="runware-lora"
              defaultValue={Array.isArray(form.parameters.runwareAdvanced?.lora)
                ? form.parameters.runwareAdvanced!.lora!.map(l => `${l.model}:${l.weight ?? 1}`).join('\n')
                : ''}
              onBlur={(e) => {
                const lines = e.currentTarget.value.split('\n').map(s => s.trim()).filter(Boolean);
                const lora = lines.map(line => {
                  const [model, weightStr] = line.split(':').map(s => s.trim());
                  return model ? { model, weight: Number(weightStr) || 1 } : null;
                }).filter(Boolean) as Array<{ model: string; weight?: number }>;
                setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareAdvanced: { ...(prev.parameters.runwareAdvanced || {}), lora } } }));
                setHasUnsavedChanges(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder={"flux-lora:0.8\nartist-style:0.5"}
            />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="runware-cfg" className="block text-sm font-medium text-gray-700 mb-2">CFG Scale</label>
                <input
                  id="runware-cfg"
                  type="number"
                  defaultValue={String(form.parameters.runwareAdvanced?.CFGScale ?? '')}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    const num = v === '' ? undefined : Number(v);
                    setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareAdvanced: { ...(prev.parameters.runwareAdvanced || {}), CFGScale: (isNaN(Number(num)) ? undefined : num) as any } } }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="runware-steps" className="block text-sm font-medium text-gray-700 mb-2">Steps</label>
                <input
                  id="runware-steps"
                  type="number"
                  defaultValue={String(form.parameters.runwareAdvanced?.steps ?? '')}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    const num = v === '' ? undefined : Number(v);
                    setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareAdvanced: { ...(prev.parameters.runwareAdvanced || {}), steps: (isNaN(Number(num)) ? undefined : num) as any } } }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Check NSFW</label>
                  <p className="text-xs text-gray-500">Provider-side NSFW checking</p>
                </div>
                <Toggle
                  checked={!!form.parameters.runwareAdvanced?.checkNSFW}
                  onChange={(checked) => {
                    setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareAdvanced: { ...(prev.parameters.runwareAdvanced || {}), checkNSFW: checked } } }));
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
              <div>
                <label htmlFor="runware-scheduler" className="block text-sm font-medium text-gray-700 mb-2">Scheduler</label>
                <input
                  id="runware-scheduler"
                  type="text"
                  defaultValue={form.parameters.runwareAdvanced?.scheduler || ''}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim();
                    setForm(prev => ({ ...prev, parameters: { ...prev.parameters, runwareAdvanced: { ...(prev.parameters.runwareAdvanced || {}), scheduler: val || undefined } } }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(optional)"
                />
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Generation Settings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">Generation Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
              Generations count
            </label>
            <input
              id="count"
              type="number"
              defaultValue={String(form.parameters.count)}
              onBlur={(e) => {
                const v = parseInt(e.currentTarget.value || '1', 10);
                const clamped = Math.min(2500, Math.max(1, isNaN(v) ? 1 : v));
                  // Enforce total cap: generations × variations ≤ 10000 by clamping variations if needed
                  const currentVariations = Math.max(1, Math.min(20, Number(form.parameters.variations || 1)));
                  const maxVariationsAllowed = Math.max(1, Math.min(20, Math.floor(10000 / clamped)));
                  const adjustedVariations = Math.min(currentVariations, maxVariationsAllowed);
                  setForm(prev => ({
                    ...prev,
                    parameters: {
                      ...prev.parameters,
                      count: clamped,
                      variations: adjustedVariations
                    }
                  }));
                setHasUnsavedChanges(true);
              }}
              onWheel={(e) => { e.currentTarget.blur(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="2500"
            />
              <p className="text-xs text-gray-500 mt-1">Number of generations (up to 2500 generations).</p>
            </div>
            <div>
              <label htmlFor="runware-variations" className="block text-sm font-medium text-gray-700 mb-2">
                Variations per generation (1–20)
              </label>
              <input
                id="runware-variations"
                type="number"
                defaultValue={String(form.parameters.variations ?? 1)}
                onBlur={(e) => {
                  const v = parseInt(e.currentTarget.value || '1', 10);
                  const clamped = Math.max(1, Math.min(20, isNaN(v) ? 1 : v));
                  // Enforce total cap: generations × variations ≤ 10000 by clamping generations if needed
                  const currentCount = Math.max(1, Number((form.parameters.count as any) || 1));
                  const maxCountAllowed = Math.max(1, Math.floor(10000 / clamped));
                  const adjustedCount = Math.min(currentCount, maxCountAllowed);
                  setForm(prev => ({
                    ...prev,
                    parameters: {
                      ...prev.parameters,
                      variations: clamped,
                      count: adjustedCount
                    }
                  }));
                  setHasUnsavedChanges(true);
                }}
                onWheel={(e) => { e.currentTarget.blur(); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="20"
              />
              <p className="text-xs text-gray-500 mt-1">Total images = Generations × Variations (cap 10,000)</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Random Keywords
              </label>
              <p className="text-xs text-gray-500">Use random keywords from the keywords file</p>
            </div>
            <Toggle
              checked={form.parameters.keywordRandom}
              onChange={handleToggleChange('parameters', 'keywordRandom')}
            />
          </div>

          {/* Generation Retry Attempts */}
          <div>
            <label htmlFor="gen-retry-attempts" className="block text-sm font-medium text-gray-700 mb-2">
              Generation Retry Attempts
            </label>
            <input
              id="gen-retry-attempts"
              type="number"
              defaultValue={String(form.parameters.generationRetryAttempts ?? 1)}
              onBlur={(e) => {
                const v = parseInt(e.currentTarget.value || '0', 10);
                const clamped = Math.min(5, Math.max(0, isNaN(v) ? 0 : v));
                setForm(prev => ({ ...prev, parameters: { ...prev.parameters, generationRetryAttempts: clamped } }));
                setHasUnsavedChanges(true);
              }}
              onWheel={(e) => { e.currentTarget.blur(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="5"
            />
            <p className="text-xs text-gray-500 mt-1">Number of automatic retries per generation (0–5).</p>
          </div>

          {/* Retry Backoff (ms) */}
          <div>
            <label htmlFor="gen-retry-backoff" className="block text-sm font-medium text-gray-700 mb-2">
              Retry Backoff (ms)
            </label>
            <input
              id="gen-retry-backoff"
              type="number"
              defaultValue={String(form.parameters.generationRetryBackoffMs ?? 0)}
              onBlur={(e) => {
                const v = parseInt(e.currentTarget.value || '0', 10);
                const clamped = Math.min(60000, Math.max(0, isNaN(v) ? 0 : v));
                setForm(prev => ({ ...prev, parameters: { ...prev.parameters, generationRetryBackoffMs: clamped } }));
                setHasUnsavedChanges(true);
              }}
              onWheel={(e) => { e.currentTarget.blur(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="60000"
              step="100"
            />
            <p className="text-xs text-gray-500 mt-1">Delay between retries (0–60000 ms).</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Processing Section
  const ProcessingSection = () => {
    // Conditional visibility logic
    const showRemoveBgSize = form.processing.removeBg;
    const showConvertFormat = form.processing.imageConvert;
    const showTrimTransparent = form.processing.removeBg; // Only show when Remove Background is enabled
    const showJpgBackground = form.processing.removeBg && 
      form.processing.imageConvert && 
      form.processing.convertToJpg;
    const showImageEnhancement = true; // Independent feature - always visible
    const showQualitySettings = form.processing.imageConvert;



    return (
      <div className="space-y-6" data-testid="processing-section">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Image Processing</h3>
          <Cog className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="space-y-6">
          {/* Background Removal Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remove Background
                </label>
                <p className="text-xs text-gray-500">Remove background from generated images</p>
              </div>
              <Toggle
                checked={form.processing.removeBg}
                onChange={handleToggleChange('processing', 'removeBg')}
              />
            </div>

            {/* Remove.bg Size - only show when Remove Background is enabled */}
            {showRemoveBgSize && (
              <div>
                <label htmlFor="remove-bg-size" className="block text-sm font-medium text-gray-700 mb-2">
                  Remove.bg Size
                </label>
                <select
                  id="remove-bg-size"
                  value={form.processing.removeBgSize}
                  onChange={handleInputChange('processing', 'removeBgSize')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="auto">Auto</option>
                  <option value="preview">Preview</option>
                  <option value="full">Full</option>
                  <option value="50MP">50MP</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Size setting for Remove.bg API</p>
              </div>
            )}

            {/* Trim Transparent Background - only show when Remove Background is enabled */}
            {showTrimTransparent && (
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trim Transparent Background
                  </label>
                  <p className="text-xs text-gray-500">Remove transparent areas from images (PNG only)</p>
                </div>
                <Toggle
                  checked={form.processing.trimTransparentBackground}
                  onChange={handleToggleChange('processing', 'trimTransparentBackground')}
                />
              </div>
            )}
          </div>

          {/* Image Conversion Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Convert
                </label>
                <p className="text-xs text-gray-500">Enable image conversion and processing</p>
              </div>
              <Toggle
                checked={form.processing.imageConvert}
                onChange={handleToggleChange('processing', 'imageConvert')}
              />
            </div>

            {/* Convert Format - only show when Image Convert is enabled */}
            {showConvertFormat && (
              <div>
                <label htmlFor="convert-format" className="block text-sm font-medium text-gray-700 mb-2">
                  Convert Format
                </label>
                <select
                  id="convert-format"
                  value={form.processing.convertToJpg ? 'jpg' : 'png'}
                  onChange={(e) => {
                    const isJpg = e.target.value === 'jpg';
                    setForm(prev => ({
                      ...prev,
                      processing: { ...prev.processing, convertToJpg: isJpg }
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Convert images to this format</p>
              </div>
            )}

            {/* Quality Settings - only show when Image Convert is enabled */}
            {showQualitySettings && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="jpg-quality" className="block text-sm font-medium text-gray-700 mb-2">
                    JPG Quality (1-100)
                  </label>
                  <input
                    id="jpg-quality"
                    type="number"
                    value={form.processing.jpgQuality}
                    onChange={handleInputChange('processing', 'jpgQuality')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Quality setting for JPG conversion</p>
                </div>

                <div>
                  <label htmlFor="png-quality" className="block text-sm font-medium text-gray-700 mb-2">
                    PNG Quality (1-100)
                  </label>
                  <input
                    id="png-quality"
                    type="number"
                    value={form.processing.pngQuality}
                    onChange={handleInputChange('processing', 'pngQuality')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Quality setting for PNG conversion</p>
                </div>

                {/* JPG Background Color - only show when Remove.Bg is on, Image Convert is on, and set to JPG */}
                {showJpgBackground && (
                  <div>
                    <label htmlFor="jpg-background" className="block text-sm font-medium text-gray-700 mb-2">
                      JPG Background Colour
                    </label>
                    <select
                      id="jpg-background"
                      value={form.processing.jpgBackground}
                      onChange={handleInputChange('processing', 'jpgBackground')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="white">White</option>
                      <option value="black">Black</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Background color for JPG conversion (JPG cannot be transparent)</p>
                  </div>
                )}
              </div>
            )}

            {/* Image Enhancement - independent feature, always visible */}
            {showImageEnhancement && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image Enhancement
                    </label>
                    <p className="text-xs text-gray-500">Apply sharpening and saturation effects</p>
                  </div>
                  <Toggle
                    checked={form.processing.imageEnhancement}
                    onChange={handleToggleChange('processing', 'imageEnhancement')}
                  />
                </div>

                {/* Sharpening Control - only show when Image Enhancement is enabled */}
                {form.processing.imageEnhancement && (
                  <div>
                    <label htmlFor="sharpening" className="block text-sm font-medium text-gray-700 mb-2">
                      Sharpening Intensity (0-10)
                    </label>
                    <input
                      id="sharpening"
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={form.processing.sharpening}
                      onChange={handleInputChange('processing', 'sharpening')}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (None)</span>
                      <span>{form.processing.sharpening}</span>
                      <span>10 (Maximum)</span>
                    </div>
                  </div>
                )}

                {/* Saturation Control - only show when Image Enhancement is enabled */}
                {form.processing.imageEnhancement && (
                  <div>
                    <label htmlFor="saturation" className="block text-sm font-medium text-gray-700 mb-2">
                      Saturation Level (0-2)
                    </label>
                    <input
                      id="saturation"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={form.processing.saturation}
                      onChange={handleInputChange('processing', 'saturation')}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Grayscale)</span>
                      <span>{form.processing.saturation}</span>
                      <span>2 (Vibrant)</span>
                    </div>
                  </div>
                )}
              </div>
            )}



          </div>
        </div>
      </div>
    );
  };

  // AI Section
  const AISection = () => (
    <div className="space-y-6" data-testid="ai-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">AI Features</h3>
        <Settings className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Quality Check
            </label>
            <p className="text-xs text-gray-500">Use AI to check image quality</p>
          </div>
          <Toggle
            checked={form.ai.runQualityCheck}
            onChange={handleToggleChange('ai', 'runQualityCheck')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Metadata Generation
            </label>
            <p className="text-xs text-gray-500">Generate metadata using AI</p>
          </div>
          <Toggle
            checked={form.ai.runMetadataGen}
            onChange={handleToggleChange('ai', 'runMetadataGen')}
          />
        </div>
      </div>
    </div>
  );

  // Advanced Section
  const AdvancedSection = () => (
    <div className="space-y-6" data-testid="advanced-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
        <Settings className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Debug Mode
            </label>
            <p className="text-xs text-gray-500">Enable detailed logging and debugging</p>
          </div>
          <Toggle
            checked={form.advanced.debugMode}
            onChange={handleToggleChange('advanced', 'debugMode')}
          />
        </div>
      </div>
    </div>
  );

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'api-keys':
        return <ApiKeysSection />;
      case 'files':
        return <FilePathsSection />;
      case 'parameters':
        return <ParametersSection />;
      case 'processing':
        return <ProcessingSection />;
      case 'ai':
        return <AISection />;
      case 'advanced':
        return <AdvancedSection />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50" data-testid="settings-panel">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Back to main view"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Configure your application settings and API keys
          </p>
          
          {/* Direct Dashboard Navigation */}
          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              aria-label="Go to Dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go to Dashboard
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 pr-8">
          <ul className="space-y-1" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <li key={tab.id} className="flex justify-center">
                  <button
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${tab.id}-panel`}
                    data-testid={`${tab.id}-tab`}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTab(tab.id);
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Notifications */}
        {showError && error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4 rounded-md" role="alert" data-testid="error-message">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setShowError(false)}
                className="text-red-400 hover:text-red-600 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {showSuccess && success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 m-4 rounded-md" role="alert" data-testid="success-message">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
              <button
                onClick={() => setShowSuccess(false)}
                className="text-green-400 hover:text-green-600 transition-colors"
                aria-label="Dismiss success"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Removed redundant logo at top of tab content */}
            {renderTabContent()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex flex-col items-center justify-center max-w-4xl mx-auto gap-3">
            {/* Unsaved changes message above buttons - fixed position, won't shift layout */}
            <div className="h-6 flex items-center justify-center">
              {hasUnsavedChanges && (
                <div className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  You have unsaved changes
                </div>
              )}
            </div>

            {/* Buttons in fixed position */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={isLoading || !hasUnsavedChanges}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="save-button"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Saving...' : 'Save Settings'}
              </button>

              <button
                onClick={handleReset}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="reset-button"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};