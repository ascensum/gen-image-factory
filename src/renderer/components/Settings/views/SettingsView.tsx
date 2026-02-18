import React, { useRef } from 'react';
import { Save, RefreshCw, AlertCircle, CheckCircle, X, Key, FolderOpen, Sliders, Cog, Settings } from 'lucide-react';
import ConfirmResetDialog from '../../Common/ConfirmResetDialog';
import { useSettings, type TabId } from '../hooks/useSettings';
import { useApiKeys } from '../hooks/useApiKeys';
import { useFilePaths } from '../hooks/useFilePaths';
import {
  SettingsTabApiKeys,
  SettingsTabFilePaths,
  SettingsTabParameters,
  SettingsTabProcessing,
  SettingsTabAI,
  SettingsTabAdvanced,
} from './tabs';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'files', label: 'File Paths', icon: FolderOpen },
  { id: 'parameters', label: 'Parameters', icon: Sliders },
  { id: 'processing', label: 'Processing', icon: Cog },
  { id: 'ai', label: 'AI Features', icon: Settings },
  { id: 'advanced', label: 'Advanced', icon: Settings },
];

export interface SettingsViewProps {
  onSave?: (settings: any) => void;
  onReset?: () => void;
  onBack?: () => void;
  onOpenDashboard?: () => void;
  isLoading?: boolean;
  error?: string | null;
  success?: string | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onSave,
  onReset,
  onBack,
  onOpenDashboard,
  isLoading = false,
  error = null,
  success = null,
}) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const settingsBag = useSettings({ onSave, onReset, error, success });
  const apiKeysBag = useApiKeys();
  useFilePaths(settingsBag.setForm);

  const {
    form,
    formVersion,
    activeTab,
    setActiveTab,
    hasUnsavedChanges,
    showError,
    setShowError,
    showSuccess,
    setShowSuccess,
    localError,
    localSuccess,
    showResetDialog,
    setShowResetDialog,
    handleInputChange,
    handleToggleChange,
    handleSave,
    handleResetClick,
    executeReset,
  } = settingsBag;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'api-keys':
        return (
          <SettingsTabApiKeys
            form={form}
            setForm={settingsBag.setForm}
            setHasUnsavedChanges={settingsBag.setHasUnsavedChanges}
            showPasswords={apiKeysBag.showPasswords}
            togglePasswordVisibility={apiKeysBag.togglePasswordVisibility}
            inputRefs={inputRefs}
          />
        );
      case 'files':
        return <SettingsTabFilePaths form={form} handleInputChange={handleInputChange} />;
      case 'parameters':
        return (
          <SettingsTabParameters
            form={form}
            setForm={settingsBag.setForm}
            setHasUnsavedChanges={settingsBag.setHasUnsavedChanges}
          />
        );
      case 'processing':
        return (
          <SettingsTabProcessing
            form={form}
            setForm={settingsBag.setForm}
            setHasUnsavedChanges={settingsBag.setHasUnsavedChanges}
            handleInputChange={handleInputChange}
            handleToggleChange={handleToggleChange}
          />
        );
      case 'ai':
        return <SettingsTabAI form={form} handleToggleChange={handleToggleChange} />;
      case 'advanced':
        return <SettingsTabAdvanced form={form} handleToggleChange={handleToggleChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50" data-testid="settings-panel">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
            {onBack && (
              <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Back to main view">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">Configure your application settings and API keys</p>
          {onOpenDashboard && (
            <div className="mt-4 pl-6 pr-16">
              <button
                onClick={onOpenDashboard}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                aria-label="Open Dashboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </button>
            </div>
          )}
        </div>
        <nav className="flex-1 p-4 pr-8">
          <ul className="space-y-1" role="tablist">
            {TABS.map((tab) => {
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
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(tab.id); } }}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive ? 'bg-blue-100 text-blue-700 border-blue-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
      <main className="flex-1 flex flex-col">
        {showError && (error || localError) && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4 rounded-md" role="alert" data-testid="error-message">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-sm text-red-700">{error || localError}</p>
              </div>
              <button onClick={() => setShowError(false)} className="text-red-400 hover:text-red-600 transition-colors" aria-label="Dismiss error">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {showSuccess && (success || localSuccess) && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 m-4 rounded-md" role="alert" data-testid="success-message">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                <p className="text-sm text-green-700">{success || localSuccess}</p>
              </div>
              <button onClick={() => setShowSuccess(false)} className="text-green-400 hover:text-green-600 transition-colors" aria-label="Dismiss success">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto" key={formVersion}>
            {renderTabContent()}
          </div>
        </div>
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex flex-col items-center justify-center max-w-4xl mx-auto gap-3">
            <div className="h-6 flex items-center justify-center">
              {hasUnsavedChanges && (
                <div className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  You have unsaved changes
                </div>
              )}
            </div>
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
                onClick={handleResetClick}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="reset-button"
              >
                <RefreshCw className="w-4 h-4" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </main>
      <ConfirmResetDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onFullReset={() => executeReset(true)}
        onSoftReset={() => executeReset(false)}
        title="Reset Settings"
        description="Reset all settings to defaults. Choose Full Reset to also clear API keys, or Reset to keep your API keys."
      />
    </div>
  );
};
