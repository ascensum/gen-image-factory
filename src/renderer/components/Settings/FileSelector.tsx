import React from 'react';
import { FolderOpen, File, X, Loader2, AlertCircle } from 'lucide-react';
import type { FileSelectorProps } from './fileSelectorTypes';
import { useFileSelector } from './hooks/useFileSelector';
import { getFileSelectorInputStyling } from './fileSelectorUtils';
import { FileSelectorValidationMessage } from './components/FileSelectorValidationMessage';

export type { FileSelectorProps } from './fileSelectorTypes';

export const FileSelector: React.FC<FileSelectorProps> = ({
  label,
  value,
  onChange,
  onValidation,
  type,
  fileTypes = [],
  accept,
  placeholder = 'Select file or directory',
  disabled = false,
  required = false,
  className,
  error
}) => {
  const {
    validationState,
    errorMessage,
    isDialogOpen,
    inputRef,
    handlePathChange,
    openFileDialog,
    clearPath
  } = useFileSelector({
    value,
    onChange,
    onValidation,
    type,
    fileTypes,
    accept,
    required,
    disabled
  });

  const inputId = `file-selector-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const inputStyling = getFileSelectorInputStyling(
    validationState,
    errorMessage,
    disabled,
    error,
    className
  );

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handlePathChange}
          className={inputStyling}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={type !== 'file' && type !== 'directory'}
          aria-describedby={`${label}-help ${label}-error`}
          aria-invalid={validationState === 'invalid'}
        />
        {value && (
          <button
            type="button"
            onClick={clearPath}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear path"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={openFileDialog}
          disabled={disabled || isDialogOpen}
          className="px-4 py-2 bg-blue-600 text-white border border-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isDialogOpen ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : type === 'directory' ? (
            <FolderOpen className="w-4 h-4" />
          ) : (
            <File className="w-4 h-4" />
          )}
          Browse
        </button>
      </div>

      <FileSelectorValidationMessage
        validationState={validationState}
        errorMessage={errorMessage}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div id={`${label}-help`} className="text-xs text-gray-500">
        {type === 'directory' ? 'Select a directory' : 'Select a file'}
      </div>
    </div>
  );
};
