import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ValidationState, ValidationResult } from '../fileSelectorTypes';

export interface UseFileSelectorOptions {
  value: string;
  onChange: (path: string) => void;
  onValidation?: (isValid: boolean) => void;
  type: 'file' | 'directory';
  fileTypes?: string[];
  accept?: string;
  required?: boolean;
  disabled?: boolean;
}

export function useFileSelector(options: UseFileSelectorOptions) {
  const {
    value,
    onChange,
    onValidation,
    type,
    fileTypes = [],
    accept,
    required = false,
    disabled = false
  } = options;

  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const onValidationRef = useRef(onValidation);
  onValidationRef.current = onValidation;

  const processedFileTypes = useMemo(() => {
    if (accept) {
      return accept
        .split(',')
        .map((ext) => (ext.trim().startsWith('.') ? ext.trim() : `.${ext.trim()}`));
    }
    return fileTypes;
  }, [accept, fileTypes]);

  const validatePath = useCallback(
    async (path: string): Promise<ValidationResult> => {
      if (!path || path.trim() === '') {
        return { isValid: false, message: required ? 'Path is required' : '' };
      }
      // Do not set 'validating' – keep showing previous result until new result arrives to avoid flicker
      try {
        if (window.electronAPI?.validatePath) {
          const result = await window.electronAPI.validatePath(
            path,
            type,
            processedFileTypes
          );
          if (result.isValid) {
            setValidationState('valid');
            setErrorMessage('');
            onValidationRef.current?.(true);
            return { isValid: true };
          } else {
            setValidationState('invalid');
            setErrorMessage(result.message || 'Invalid path');
            onValidationRef.current?.(false);
            return { isValid: false, message: result.message };
          }
        } else {
          const isValid = path.length > 0;
          setValidationState(isValid ? 'valid' : 'invalid');
          setErrorMessage(isValid ? '' : 'Invalid path');
          onValidationRef.current?.(isValid);
          return { isValid };
        }
      } catch {
        setValidationState('invalid');
        setErrorMessage('Error validating path');
        onValidationRef.current?.(false);
        return { isValid: false, message: 'Error validating path' };
      }
    },
    [type, processedFileTypes, required]
  );

  useEffect(() => {
    if (value && window.electronAPI?.validatePath) {
      validatePath(value);
    } else {
      setValidationState('idle');
      setErrorMessage('');
      onValidationRef.current?.(false);
    }
  }, [value, validatePath]);

  const openFileDialog = useCallback(async () => {
    if (disabled || isDialogOpen) return;
    try {
      setIsDialogOpen(true);
      if (window.electronAPI?.selectFile) {
        const result = await window.electronAPI.selectFile({
          type,
          fileTypes: processedFileTypes.length > 0 ? processedFileTypes : undefined,
          title: `Select ${type === 'directory' ? 'Directory' : 'File'}`
        });
        if (result.success && result.filePath) {
          onChange(result.filePath);
        }
      }
    } catch {
      setErrorMessage('Error opening file dialog');
    } finally {
      setIsDialogOpen(false);
    }
  }, [disabled, isDialogOpen, type, processedFileTypes, onChange]);

  const handlePathChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  const clearPath = useCallback(() => {
    onChange('');
  }, [onChange]);

  return {
    validationState,
    errorMessage,
    isDialogOpen,
    inputRef,
    handlePathChange,
    openFileDialog,
    clearPath,
    validatePath
  };
}
