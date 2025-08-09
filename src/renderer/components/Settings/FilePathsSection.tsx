import React, { useState, useEffect, useCallback } from 'react';
import { Folder, FolderOpen, File, Files, CheckCircle, AlertCircle, AlertTriangle, Loader2, HardDrive, Shield, ShieldAlert } from 'lucide-react';

// Types and Interfaces
interface FilePathsSectionProps {
  inputDirectory: string;
  outputDirectory: string;
  templateFiles: string[];
  onInputDirectoryChange?: (path: string) => void;
  onOutputDirectoryChange?: (path: string) => void;
  onTemplateFilesChange?: (files: string[]) => void;
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
  templateFiles,
  onInputDirectoryChange,
  onOutputDirectoryChange,
  onTemplateFilesChange,
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
  }, [inputDirectory, outputDirectory, templateFiles]);

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

      // Validate template files
      if (templateFiles.length > 0) {
        const templateResult = await validateTemplateFiles(templateFiles);
        setTemplateValidation(templateResult);
      } else {
        setTemplateValidation({
          isValid: true, // Template files are optional
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
  }, [inputDirectory, outputDirectory, templateFiles]);

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

  // Validate template files
  const validateTemplateFiles = async (files: string[]): Promise<PathValidation> => {
    try {
      const validationResults = await Promise.all(
        files.map(file => validatePath(file, 'file', ['read']))
      );

      const allValid = validationResults.every(result => result.isValid);
      const allExist = validationResults.every(result => result.exists);
      const allAccessible = validationResults.every(result => result.isAccessible);

      const invalidFiles = files.filter((_, index) => !validationResults[index].isValid);
      const errorMessage = invalidFiles.length > 0 
        ? `Invalid files: ${invalidFiles.join(', ')}`
        : undefined;

      return {
        isValid: allValid,
        hasReadPermission: validationResults.some(result => result.hasReadPermission),
        hasWritePermission: false,
        exists: allExist,
        isAccessible: allAccessible,
        errorMessage
      };
    } catch (error) {
      return {
        isValid: false,
        hasReadPermission: false,
        hasWritePermission: false,
        exists: false,
        isAccessible: false,
        errorMessage: 'Failed to validate template files'
      };
    }
  };

  // Handle directory selection
  const handleDirectorySelect = useCallback(async (type: 'input' | 'output') => {
    try {
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          type: 'directory',
          defaultPath: type === 'input' ? inputDirectory : outputDirectory
        });

        if (result.filePaths && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0];
          
          if (type === 'input') {
            onInputDirectoryChange?.(selectedPath);
          } else {
            onOutputDirectoryChange?.(selectedPath);
          }
        }
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  }, [inputDirectory, outputDirectory, onInputDirectoryChange, onOutputDirectoryChange]);

  // Handle template files selection
  const handleTemplateFilesSelect = useCallback(async () => {
    try {
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          type: 'multiple',
          fileTypes: FILE_TYPE_CONFIGS.template.extensions
        });

        if (result.filePaths && result.filePaths.length > 0) {
          onTemplateFilesChange?.(result.filePaths);
        }
      }
    } catch (error) {
      console.error('Error selecting template files:', error);
    }
  }, [onTemplateFilesChange]);

  // File Selector Component
  const FileSelector: React.FC<{
    label: string;
    value: string | string[];
    type: 'directory' | 'multiple';
    placeholder: string;
    helpText: string;
    validation: PathValidation;
    onSelect: () => void;
    onClear: () => void;
  }> = ({ label, value, type, placeholder, helpText, validation, onSelect, onClear }) => {
    const displayValue = Array.isArray(value) ? value.join('; ') : (value || '');
    const hasValue = Array.isArray(value) ? (value && value.length > 0) : (value && value.length > 0);

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={displayValue}
            readOnly
            className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors ${
              hasValue && !validation.isValid
                ? 'border-red-300 bg-red-50 text-red-900'
                : hasValue && validation.isValid
                ? 'border-green-300 bg-green-50 text-green-900'
                : 'border-gray-300 bg-gray-50 text-gray-500'
            }`}
            placeholder={placeholder}
          />
          
          <button
            type="button"
            onClick={onSelect}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            {type === 'directory' ? <FolderOpen className="w-4 h-4" /> : <Files className="w-4 h-4" />}
            Browse
          </button>
          
          {hasValue && (
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Validation Status */}
        {hasValue && (
          <div className="flex items-center gap-2 text-sm">
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-blue-600">Validating...</span>
              </>
            ) : validation.isValid ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Valid path</span>
                <div className="flex items-center gap-1 ml-2">
                  {validation.hasReadPermission && <Shield className="w-3 h-3 text-green-500" title="Read permission" />}
                  {validation.hasWritePermission && <Shield className="w-3 h-3 text-blue-500" title="Write permission" />}
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-600">
                  {validation.errorMessage || 'Invalid path'}
                </span>
              </>
            )}
          </div>
        )}

        {/* Warning Messages */}
        {validation.warningMessage && (
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <AlertTriangle className="w-4 h-4" />
            <span>{validation.warningMessage}</span>
          </div>
        )}

        {/* Help Text */}
        <p className="text-xs text-gray-500">{helpText}</p>
      </div>
    );
  };

  // Validation Summary Component
  const ValidationSummary = () => {
    const hasAnyPath = inputDirectory || outputDirectory || (templateFiles && templateFiles.length > 0);
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
              Template Files: {templateFiles.length > 0 ? `${templateFiles.length} files` : 'None selected'}
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
          type="directory"
          placeholder="Select directory containing your input files"
          helpText="Directory containing keyword files, CSV data, and other input materials"
          validation={inputValidation}
          onSelect={() => handleDirectorySelect('input')}
          onClear={() => onInputDirectoryChange?.('')}
        />

        <FileSelector
          label="Output Directory"
          value={outputDirectory}
          type="directory"
          placeholder="Select directory for generated output"
          helpText="Directory where generated images and results will be saved"
          validation={outputValidation}
          onSelect={() => handleDirectorySelect('output')}
          onClear={() => onOutputDirectoryChange?.('')}
        />

        <FileSelector
          label="Template Files (Optional)"
          value={templateFiles}
          type="multiple"
          placeholder="Select template files for custom prompts"
          helpText="Template files containing prompt templates, configurations, and custom settings"
          validation={templateValidation}
          onSelect={handleTemplateFilesSelect}
          onClear={() => onTemplateFilesChange?.([])}
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