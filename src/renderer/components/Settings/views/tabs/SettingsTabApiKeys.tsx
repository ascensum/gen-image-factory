import React from 'react';
import { Eye, EyeOff, Key } from 'lucide-react';
import type { SettingsObject } from '../../../../../types/settings';

interface SettingsTabApiKeysProps {
  form: SettingsObject;
  setForm: React.Dispatch<React.SetStateAction<SettingsObject>>;
  setHasUnsavedChanges: (v: boolean) => void;
  showPasswords: Record<string, boolean>;
  togglePasswordVisibility: (field: string) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

export function SettingsTabApiKeys({
  form,
  setForm,
  setHasUnsavedChanges,
  showPasswords,
  togglePasswordVisibility,
  inputRefs,
}: SettingsTabApiKeysProps) {
  return (
    <div className="space-y-6" data-testid="api-keys-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
        <Key className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        {Object.entries({
          openai: 'OpenAI API Key',
          runware: 'Runware API Key',
          removeBg: 'Remove.bg API Key',
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
                  ref={(el) => {
                    inputRefs.current[inputId] = el;
                  }}
                  type={showPasswords[key] ? 'text' : 'password'}
                  defaultValue={form.apiKeys[key as keyof typeof form.apiKeys]}
                  onBlur={(e) => {
                    const val = e.currentTarget.value;
                    setForm((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, [key]: val } }));
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
}
