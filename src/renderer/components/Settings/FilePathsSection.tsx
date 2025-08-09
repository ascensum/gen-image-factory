import React, { useState, useEffect, useCallback } from 'react';
import { Folder, FolderOpen, File, Files, CheckCircle, AlertCircle, AlertTriangle, Loader2, HardDrive, Shield, ShieldAlert } from 'lucide-react';
import { FileSelector } from './FileSelector';

// Types and Interfaces
interface FilePathsSectionProps {
  inputDirectory: string;
  outputDirectory: string;
  templateFile: string;
  onInputDirectoryChange?: (path: string) => void;
  onOutputDirectoryChange?: (path: string) => void;
  onTemplateFileChange?: (file: string) => void;
  onValidation?: (isValid: boolean) => void;
  isLoading?: boolean;
  error?: string | null;
}

interface PathValidation {
  isValid: boolean;
  hasReadPermission: boolean;
  hasWritePermission: boolean;
  exists: boolean;
  isAccessible: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

interface FileTypeConfig {
  extensions: string[];
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

// File type configurations
const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  input: {
    extensions: ['.txt', '.csv', '.json'],
    description: 'Text, CSV, and JSON files',
    icon: File
  },
  template: {
    extensions: ['.txt', '.md', '.json'],
    description: 'Text, Markdown, and JSON files',
    icon: Files
  },
  image: {
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
    description: 'Image files',
    icon: File
  }
};

export const FilePathsSection: React.FC<FilePathsSectionProps> = ({
  inputDirectory,
  outputDirectory,
  templateFile,
  onInputDirectoryChange,
  onOutputDirectoryChange,
  onTemplateFileChange,
  onValidation,
  isLoading = false,
  error = null
}) => {
  // State management
  const [inputValidation, setInputValidation] = useState<PathValidation>({
    isValid: false,
    hasReadPermission: false,
    hasWritePermission: false,
    exists: false,
    isAccessible: false
  });
  
  const [outputValidation, setOutputValidation] = useState<PathValidation>({
    isValid: false,
    hasReadPermission: false,
    hasWritePermission: false,
    exists: false,
    isAccessible: false
  });
  
  const [templateValidation, setTemplateValidation] = useState<PathValidation>({
    isValid: false,
    hasReadPermission: false,
    hasWritePermission: false,
    exists: false,
    isAccessible: false
  });

  const [isValidating, setIsValidating] = useState(false);

  // Validate paths when they change
  useEffect(() => {
    validatePaths();
  }, [inputDirectory, outputDirectory, templateFile]);

  // Notify parent of overall validation status
  useEffect(() => {
    const isOverallValid = inputValidation.isValid && outputValidation.isValid && templateValidation.isValid;
    onValidation?.(isOverallValid);
  }, [inputValidation.isValid, outputValidation.isValid, templateValidation.isValid, onValidation]);

  // Validate all paths
  const validatePaths = useCallback(async () => {
    setIsValidating(true);

    try {
      // Validate input directory
      if (inputDirectory) {
        const inputResult = await validatePath(inputDirectory, 'directory', ['read']);
        setInputValidation(inputResult);
      } else {
        setInputValidation({
          isValid: false,
          hasReadPermission: false,
          hasWritePermission: false,
          exists: false,
          isAccessible: false
        });
      }

      // Validate output directory
      if (outputDirectory) {
        const outputResult = await validatePath(outputDirectory, 'directory', ['read', 'write']);
        setOutputValidation(outputResult);
      } else {
        setOutputValidation({
          isValid: false,
          hasReadPermission: false,
          hasWritePermission: false,
          exists: false,
          isAccessible: false
        });
      }

      // Validate template file
      if (templateFile) {
        const templateResult = await validatePath(templateFile, 'file', ['read']);
        setTemplateValidation(templateResult);
      } else {
        setTemplateValidation({
          isValid: true, // Template file is optional
          hasReadPermission: false,
          hasWritePermission: false,
          exists: false,
          isAccessible: false
        });
      }
    } catch (error) {
      console.error('Error validating paths:', error);
    } finally {
      setIsValidating(false);
    }
  }, [inputDirectory, outputDirectory, templateFile]);

  // Validate a single path
  const validatePath = async (path: string, type: 'file' | 'directory', permissions: string[]): Promise<PathValidation> => {
    try {
      if (window.electronAPI?.validatePath) {
        const result = await window.electronAPI.validatePath(path, type, permissions);
        return {
          isValid: result.isValid,
          hasReadPermission: result.hasReadPermission || false,
          hasWritePermission: result.hasWritePermission || false,
          exists: result.exists || false,
          isAccessible: result.isAccessible || false,
          errorMessage: result.errorMessage,
          warningMessage: result.warningMessage
        };
      } else {
        // Fallback validation
        return {
          isValid: path.length > 0,
          hasReadPermission: true,
          hasWritePermission: true,
          exists: true,
          isAccessible: true
        };
      }
    } catch (error) {
      return {
        isValid: false,
        hasReadPermission: false,
        hasWritePermission: false,
        exists: false,
        isAccessible: false,
        errorMessage: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  };



  // Handle template file change
  const handleTemplateFileChange = (filePath: string) => {
    onTemplateFileChange?.(filePath);
  };

  // Validation Summary Component
  const ValidationSummary = () => {
    const hasAnyPath = inputDirectory || outputDirectory || templateFile;
    const allValid = inputValidation.isValid && outputValidation.isValid && templateValidation.isValid;

    if (!hasAnyPath) return null;

    return (
      <div className={`border rounded-lg p-4 ${
        allValid ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {allValid ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          )}
          <h3 className="font-medium text-gray-900">
            {allValid ? 'All paths configured' : 'Path configuration incomplete'}
          </h3>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-gray-400" />
            <span className={inputValidation.isValid ? 'text-green-600' : 'text-gray-500'}>
              Input Directory: {inputDirectory || 'Not set'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span className={outputValidation.isValid ? 'text-green-600' : 'text-gray-500'}>
              Output Directory: {outputDirectory || 'Not set'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Files className="w-4 h-4 text-gray-400" />
            <span className={templateValidation.isValid ? 'text-green-600' : 'text-gray-500'}>
              Template File: {templateFile || 'None selected'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">File Paths</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure input and output directories for your workflow
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* File Selectors */}
      <div className="space-y-6">
        <FileSelector
          label="Input Directory"
          value={inputDirectory}
          onChange={onInputDirectoryChange || (() => {})}
          type="directory"
          placeholder="Select directory containing your input files"
          required={false}
          onValidation={(isValid) => {
            setInputValidation(prev => ({ ...prev, isValid }));
          }}
        />

        <FileSelector
          label="Output Directory"
          value={outputDirectory}
          onChange={onOutputDirectoryChange || (() => {})}
          type="directory"
          placeholder="Select directory for generated output"
          required={false}
          onValidation={(isValid) => {
            setOutputValidation(prev => ({ ...prev, isValid }));
          }}
        />

        <FileSelector
          label="Template File (Optional)"
          value={templateFile}
          onChange={handleTemplateFileChange}
          type="file"
          fileTypes={['.txt']}
          placeholder="Select template file for custom prompts"
          required={false}
          onValidation={(isValid) => {
            setTemplateValidation(prev => ({ ...prev, isValid }));
          }}
        />
      </div>

      {/* Validation Summary */}
      <ValidationSummary />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading file paths...</span>
        </div>
      )}
    </div>
  );
};

// Type declarations for Electron API
declare global {
  interface Window {
    electronAPI?: {
      showOpenDialog: (options: {
        type: 'file' | 'directory' | 'multiple';
        fileTypes?: string[];
        defaultPath?: string;
      }) => Promise<{ filePaths: string[]; canceled: boolean }>;
      validatePath: (path: string, type: 'file' | 'directory', permissions: string[]) => Promise<{
        isValid: boolean;
        exists?: boolean;
        isAccessible?: boolean;
        hasReadPermission?: boolean;
        hasWritePermission?: boolean;
        errorMessage?: string;
        warningMessage?: string;
      }>;
    };
  }
}