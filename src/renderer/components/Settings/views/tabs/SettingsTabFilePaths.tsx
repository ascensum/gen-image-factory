import React from 'react';
import { FolderOpen } from 'lucide-react';
import { FileSelector } from '../../FileSelector';
import type { SettingsObject } from '../../../../../types/settings';

interface SettingsTabFilePathsProps {
  form: SettingsObject;
  handleInputChange: (section: string, key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export function SettingsTabFilePaths({ form, handleInputChange }: SettingsTabFilePathsProps) {
  return (
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
}
