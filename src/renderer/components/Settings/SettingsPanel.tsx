import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, Save, RotateCcw, AlertCircle, CheckCircle, X, Key, FolderOpen, Sliders, Cog, Settings } from 'lucide-react';
import { Toggle } from './Toggle';
import { FileSelector } from './FileSelector';

// Types and Interfaces
interface SettingsObject {
  apiKeys: {
    openai: string;
    piapi: string;
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
    aspectRatios: string;
    mjVersion: string;
    openaiModel: string;
    pollingTimeout: number;
    enablePollingTimeout: boolean;
    keywordRandom: boolean;
    count: number;
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
    removeBg: '',
  },
  filePaths: {
    outputDirectory: './pictures/toupload',
    tempDirectory: './pictures/generated',
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
    pollingTimeout: 15,
    enablePollingTimeout: true,
    keywordRandom: false,
    count: 1,
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
  isLoading = false,
  error = null,
  success = null
}) => {
  const [settings, setSettings] = useState<SettingsObject>(defaultSettings);
  const [activeTab, setActiveTab] = useState<TabId>('api-keys');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({
    openai: false,
    piapi: false,
    removeBg: false,
  });
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
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
    const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
    const inputId = `${section}-${key}`;
    
    // Store the current cursor position
    const input = e.target as HTMLInputElement;
    const cursorPosition = input.selectionStart;
    
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section as keyof typeof prev], [key]: value }
    }));
    setHasUnsavedChanges(true);
    
    // Restore focus and cursor position after state update
    requestAnimationFrame(() => {
      const inputElement = inputRefs.current[inputId];
      if (inputElement && document.activeElement !== inputElement) {
        inputElement.focus();
        if (inputElement.setSelectionRange) {
          inputElement.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    });
  };

  // Handle toggle changes
  const handleToggleChange = (section: string, key: string) => (checked: boolean) => {
    setSettings(prev => ({
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
        await window.electronAPI.saveSettings(settings);
      }
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
                  defaultValue={settings.apiKeys[key as keyof typeof settings.apiKeys]}
                  onChange={handleInputChange('apiKeys', key)}
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
          value={settings.filePaths.outputDirectory}
          onChange={(path: string) => handleInputChange('filePaths', 'outputDirectory')({ target: { value: path } } as any)}
          type="directory"
          placeholder="Select directory for processed images"
          required={false}
        />

        <FileSelector
          label="Temp Directory"
          value={settings.filePaths.tempDirectory}
          onChange={(path: string) => handleInputChange('filePaths', 'tempDirectory')({ target: { value: path } } as any)}
          type="directory"
          placeholder="Select directory for temporary files"
          required={false}
        />

        <FileSelector
          label="System Prompt File"
          value={settings.filePaths.systemPromptFile}
          onChange={(path: string) => handleInputChange('filePaths', 'systemPromptFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt']}
          placeholder="Select system prompt file (.txt only)"
          required={false}
        />

        <FileSelector
          label="Keywords File"
          value={settings.filePaths.keywordsFile}
          onChange={(path: string) => handleInputChange('filePaths', 'keywordsFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt', '.csv']}
          placeholder="Select keywords file (.txt or .csv)"
          required={false}
        />

        <FileSelector
          label="Quality Check Prompt File"
          value={settings.filePaths.qualityCheckPromptFile}
          onChange={(path: string) => handleInputChange('filePaths', 'qualityCheckPromptFile')({ target: { value: path } } as any)}
          type="file"
          fileTypes={['.txt']}
          placeholder="Select quality check prompt file (.txt only)"
          required={false}
        />

        <FileSelector
          label="Metadata Prompt File"
          value={settings.filePaths.metadataPromptFile}
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
        <p className="text-sm text-gray-600 mb-6">Configure parameters for PiAPI (Midjourney) and OpenAI models.</p>
      </div>

      <div className="space-y-6">
        {/* Midjourney Settings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">Midjourney Settings</h4>
          
          <div>
            <label htmlFor="process-mode" className="block text-sm font-medium text-gray-700 mb-2">
              Process Mode
            </label>
            <select
              id="process-mode"
              value={settings.parameters.processMode}
              onChange={handleInputChange('parameters', 'processMode')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="relax">Relax</option>
              <option value="fast">Fast</option>
              <option value="turbo">Turbo</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Midjourney generation speed mode</p>
          </div>

          <div>
            <label htmlFor="aspect-ratios" className="block text-sm font-medium text-gray-700 mb-2">
              Aspect Ratios
            </label>
            <input
              id="aspect-ratios"
              type="text"
              value={settings.parameters.aspectRatios}
              onChange={handleInputChange('parameters', 'aspectRatios')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1:1,16:9,9:16"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list of aspect ratios</p>
          </div>

          <div>
            <label htmlFor="mj-version" className="block text-sm font-medium text-gray-700 mb-2">
              Midjourney Version
            </label>
            <input
              id="mj-version"
              type="text"
              value={settings.parameters.mjVersion}
              onChange={handleInputChange('parameters', 'mjVersion')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="6.1"
            />
            <p className="text-xs text-gray-500 mt-1">Midjourney model version</p>
          </div>
        </div>

        {/* OpenAI Settings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">OpenAI Settings</h4>
          
          <div>
            <label htmlFor="openai-model" className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI Model
            </label>
            <select
              id="openai-model"
              value={settings.parameters.openaiModel}
              onChange={handleInputChange('parameters', 'openaiModel')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">OpenAI model for text generation</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enable Polling Timeout
              </label>
              <p className="text-xs text-gray-500">Use custom polling timeout instead of default</p>
            </div>
            <Toggle
              checked={settings.parameters.enablePollingTimeout}
              onChange={handleToggleChange('parameters', 'enablePollingTimeout')}
            />
          </div>

          {/* Polling Timeout - only show when enabled */}
          {settings.parameters.enablePollingTimeout && (
            <div>
              <label htmlFor="polling-timeout" className="block text-sm font-medium text-gray-700 mb-2">
                Polling Timeout (seconds)
              </label>
              <input
                id="polling-timeout"
                ref={(el) => { inputRefs.current['parameters-pollingTimeout'] = el; }}
                type="number"
                value={settings.parameters.pollingTimeout}
                onChange={handleInputChange('parameters', 'pollingTimeout')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="300"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum time to wait for API response</p>
            </div>
          )}
        </div>

        {/* Generation Settings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-800">Generation Settings</h4>
          
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-2">
              Image Count
            </label>
            <input
              id="count"
              type="number"
              value={settings.parameters.count}
              onChange={handleInputChange('parameters', 'count')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">Number of images to generate</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Random Keywords
              </label>
              <p className="text-xs text-gray-500">Use random keywords from the keywords file</p>
            </div>
            <Toggle
              checked={settings.parameters.keywordRandom}
              onChange={handleToggleChange('parameters', 'keywordRandom')}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Processing Section
  const ProcessingSection = () => {
    // Conditional visibility logic
    const showRemoveBgSize = settings.processing.removeBg;
    const showImageConvert = settings.processing.imageConvert;
    const showConvertFormat = settings.processing.imageConvert;
    const showTrimTransparent = settings.processing.removeBg; // Only show when Remove Background is enabled
    const showJpgBackground = settings.processing.removeBg && 
      settings.processing.imageConvert && 
      settings.processing.convertToJpg;
    const showImageEnhancement = true; // Independent feature - always visible
    const showQualitySettings = settings.processing.imageConvert;



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
                checked={settings.processing.removeBg}
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
                  value={settings.processing.removeBgSize}
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
                  checked={settings.processing.trimTransparentBackground}
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
                checked={settings.processing.imageConvert}
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
                  value={settings.processing.convertToJpg ? 'jpg' : 'png'}
                  onChange={(e) => {
                    const isJpg = e.target.value === 'jpg';
                    setSettings(prev => ({
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
                    value={settings.processing.jpgQuality}
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
                    value={settings.processing.pngQuality}
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
                      value={settings.processing.jpgBackground}
                      onChange={handleInputChange('processing', 'jpgBackground')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="white">White</option>
                      <option value="black">Black</option>
                      <option value="transparent">Transparent</option>
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
                    checked={settings.processing.imageEnhancement}
                    onChange={handleToggleChange('processing', 'imageEnhancement')}
                  />
                </div>

                {/* Sharpening Control - only show when Image Enhancement is enabled */}
                {settings.processing.imageEnhancement && (
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
                      value={settings.processing.sharpening}
                      onChange={handleInputChange('processing', 'sharpening')}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (None)</span>
                      <span>{settings.processing.sharpening}</span>
                      <span>10 (Maximum)</span>
                    </div>
                  </div>
                )}

                {/* Saturation Control - only show when Image Enhancement is enabled */}
                {settings.processing.imageEnhancement && (
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
                      value={settings.processing.saturation}
                      onChange={handleInputChange('processing', 'saturation')}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 (Grayscale)</span>
                      <span>{settings.processing.saturation}</span>
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
            checked={settings.ai.runQualityCheck}
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
            checked={settings.ai.runMetadataGen}
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
            checked={settings.advanced.debugMode}
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
            {renderTabContent()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center justify-center max-w-4xl mx-auto">
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

            {hasUnsavedChanges && (
              <div className="text-sm text-amber-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                You have unsaved changes
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};