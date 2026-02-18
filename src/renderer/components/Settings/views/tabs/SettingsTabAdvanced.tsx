import React from 'react';
import { Settings } from 'lucide-react';
import { Toggle } from '../../Toggle';
import type { SettingsObject } from '../../../../../types/settings';

interface SettingsTabAdvancedProps {
  form: SettingsObject;
  handleToggleChange: (section: string, key: string) => (checked: boolean) => void;
}

export function SettingsTabAdvanced({ form, handleToggleChange }: SettingsTabAdvancedProps) {
  return (
    <div className="space-y-6" data-testid="advanced-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
        <Settings className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Debug Mode</label>
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
}
