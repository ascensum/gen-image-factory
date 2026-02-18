import React from 'react';
import { Settings } from 'lucide-react';
import { Toggle } from '../../Toggle';
import type { SettingsObject } from '../../../../../types/settings';

interface SettingsTabAIProps {
  form: SettingsObject;
  handleToggleChange: (section: string, key: string) => (checked: boolean) => void;
}

export function SettingsTabAI({ form, handleToggleChange }: SettingsTabAIProps) {
  return (
    <div className="space-y-6" data-testid="ai-section">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">AI Features</h3>
        <Settings className="h-5 w-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Quality Check</label>
            <p className="text-xs text-gray-500">Use AI to check image quality</p>
          </div>
          <Toggle
            checked={form.ai.runQualityCheck}
            onChange={handleToggleChange('ai', 'runQualityCheck')}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Metadata Generation</label>
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
}
