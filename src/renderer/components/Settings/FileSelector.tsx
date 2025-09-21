import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Folder, File, FolderOpen, AlertCircle, CheckCircle, Loader2, ChevronDown, X, Upload } from 'lucide-react';

// Types and Interfaces
interface FileSelectorProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
  onValidation?: (isValid: boolean) => void;
  type: 'file' | 'directory';
  fileTypes?: string[];
  accept?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  error?: string;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';
type DragState = 'idle' | 'dragover' | 'dragging';

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

interface RecentPath {
  path: string;
  name: string;
  lastUsed: Date;
  type: 'file' | 'directory';
}

// File type extensions mapping
const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
  document: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.html', '.css']
};

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
  // State management
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [dragState, setDragState] = useState<DragState>('idle');
  const [recentPaths, setRecentPaths] = useState<RecentPath[]>([]);
  const [showRecentPaths, setShowRecentPaths] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Refs
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recentPathsRef = useRef<HTMLDivElement>(null);

  // Process accept prop into fileTypes if provided
  const processedFileTypes = useMemo(() => {
    if (accept) {
      return accept.split(',').map(ext => ext.trim().startsWith('.') ? ext.trim() : `.${ext.trim()}`);
    }
    return fileTypes;
  }, [accept, fileTypes]);

  // Load recent paths on mount - DISABLED to prevent crashes
  useEffect(() => {
    // Disable recent paths functionality to prevent white screen crashes
    return;
  }, []);

  // Validate path when value changes
  useEffect(() => {
    if (value && window.electronAPI?.validatePath) {
      validatePath(value);
    } else {
      setValidationState('idle');
      setErrorMessage('');
      onValidation?.(false);
    }
  }, [value, onValidation]);

  // Close recent paths dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recentPathsRef.current && !recentPathsRef.current.contains(event.target as Node)) {
        setShowRecentPaths(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load recent paths from Electron store
  const loadRecentPaths = async () => {
    try {
      if (window.electronAPI?.getRecentPaths) {
        const paths = await window.electronAPI.getRecentPaths(type);
        setRecentPaths(paths);
      }
    } catch (error) {
      console.error('Error loading recent paths:', error);
    }
  };

  // Save path to recent paths - DISABLED to prevent crashes
  const saveToRecentPaths = async (path: string) => {
    // Disable recent paths functionality to prevent white screen crashes
    return;
  };

  // Validate file/directory path
  const validatePath = useCallback(async (path: string): Promise<ValidationResult> => {
    if (!path || path.trim() === '') {
      return { isValid: false, message: required ? 'Path is required' : '' };
    }

    setValidationState('validating');

    try {
      if (window.electronAPI?.validatePath) {
        const result = await window.electronAPI.validatePath(path, type, processedFileTypes);
        
        if (result.isValid) {
          setValidationState('valid');
          setErrorMessage('');
          onValidation?.(true);
          return { isValid: true };
        } else {
          setValidationState('invalid');
          setErrorMessage(result.message || 'Invalid path');
          onValidation?.(false);
          return { isValid: false, message: result.message };
        }
      } else {
        // Fallback validation when Electron API is not available
        const isValid = path.length > 0;
        setValidationState(isValid ? 'valid' : 'invalid');
        setErrorMessage(isValid ? '' : 'Invalid path');
        onValidation?.(isValid);
        return { isValid };
      }
    } catch (error) {
      setValidationState('invalid');
      setErrorMessage('Error validating path');
      onValidation?.(false);
      return { isValid: false, message: 'Error validating path' };
    }
  }, [type, processedFileTypes, required, onValidation]);

  // Open native file dialog
  const openFileDialog = useCallback(async () => {
    if (disabled || isDialogOpen) return;

    try {
      setIsDialogOpen(true);

      if (window.electronAPI?.selectFile) {
        const result = await window.electronAPI.selectFile({
          type: type,
          fileTypes: processedFileTypes.length > 0 ? processedFileTypes : undefined,
          title: `Select ${type === 'directory' ? 'Directory' : 'File'}`
        });

        if (result.success && result.filePath) {
          onChange(result.filePath);
          await saveToRecentPaths(result.filePath);
        }
      } else {
        // Fallback for testing environment
        console.warn('Electron API not available - file dialog not supported in test environment');
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
      setErrorMessage('Error opening file dialog');
    } finally {
      setIsDialogOpen(false);
    }
  }, [disabled, isDialogOpen, type, processedFileTypes, value, onChange]);

  // Handle manual path input
  const handlePathChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = event.target.value;
    onChange(newPath);
  }, [onChange]);

  // Handle drag events
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!disabled) {
      setDragState('dragover');
    }
  }, [disabled]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Only set to idle if we're leaving the drop zone entirely
    if (!dropZoneRef.current?.contains(event.relatedTarget as Node)) {
      setDragState('idle');
    }
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragState('idle');

    if (disabled) return;

    try {
      const files = Array.from(event.dataTransfer.files);
      
      if (files.length === 0) return;

      // Validate file types if specified
      if (processedFileTypes.length > 0) {
        const file = files[0];
        const fileName = file.name.toLowerCase();
        const isValidType = processedFileTypes.some(ext => 
          fileName.endsWith(ext.toLowerCase())
        );
        
        if (!isValidType) {
          setErrorMessage('Unsupported file type');
          onValidation?.(false);
          return;
        }
      }

      const file = files[0];
      
      // In Electron environment, try to get the file path
      if (window.electronAPI?.selectFile) {
        // For drag-and-drop in Electron, we need to use the file dialog
        // since we can't directly access the file path from the dropped file
        console.log('Drag-and-drop detected, but using file dialog for path selection');
        // Don't automatically set the path - let user use browse button instead
        setErrorMessage('Please use the Browse button to select files');
        onValidation?.(false);
        return;
      } else {
        // In web environment, we can't get the file path
        console.log('Drag-and-drop not supported in web environment');
        setErrorMessage('Drag-and-drop not supported in this environment');
        onValidation?.(false);
        return;
      }
    } catch (error) {
      console.error('Error handling dropped files:', error);
      setErrorMessage('Error processing dropped files');
    }
  }, [disabled, type, onChange, processedFileTypes, onValidation]);

  // Handle recent path selection
  const handleRecentPathSelect = useCallback(async (path: string) => {
    onChange(path);
    setShowRecentPaths(false);
    await saveToRecentPaths(path);
  }, [onChange]);

  // Clear selected path
  const clearPath = useCallback(() => {
    onChange('');
    setShowRecentPaths(false);
  }, [onChange]);

  // Get input styling based on state
  const getInputStyling = () => {
    const baseClasses = 'flex-1 px-3 py-2 border rounded-l-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors';
    const customClasses = className || '';
    
    if (disabled) {
      return `${baseClasses} bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed ${customClasses}`;
    }

    if (error || (validationState === 'invalid' && errorMessage)) {
      return `${baseClasses} border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500 ${customClasses}`;
    }

    if (validationState === 'valid') {
      return `${baseClasses} border-green-300 text-green-900 focus:ring-green-500 focus:border-green-500 ${customClasses}`;
    }

    return `${baseClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${customClasses}`;
  };

  // Get drop zone styling based on drag state
  const getDropZoneStyling = () => {
    const baseClasses = 'border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer';
    
    if (disabled) {
      return `${baseClasses} border-gray-200 bg-gray-50 cursor-not-allowed`;
    }

    if (dragState === 'dragover') {
      return `${baseClasses} border-blue-400 bg-blue-50 text-blue-600`;
    }

    return `${baseClasses} border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600`;
  };

  // Recent Paths Dropdown Component - DISABLED due to causing white screen crashes
  const RecentPathsDropdown = () => {
    // Disable recent paths functionality to prevent white screen crashes
    return null;
  };

  // Validation Message Component
  const ValidationMessage = () => {
    if (validationState === 'validating') {
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Validating path...</span>
        </div>
      );
    }

    if (validationState === 'valid') {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Valid path</span>
        </div>
      );
    }

    if (validationState === 'invalid' && errorMessage) {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      <label 
        htmlFor={`file-selector-${label.replace(/\s+/g, '-').toLowerCase()}`}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {/* Input and Browse Button */}
      <div className="flex">
        <input
          ref={inputRef}
          id={`file-selector-${label.replace(/\s+/g, '-').toLowerCase()}`}
          type="text"
          value={value}
          onChange={handlePathChange}
          className={getInputStyling()}
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
            className="px-3 py-2 border-t border-b border-gray-300 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear path"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        <button
          type="button"
          onClick={openFileDialog}
          disabled={disabled || isDialogOpen}
          className="px-4 py-2 bg-blue-600 text-white border border-blue-600 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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

      {/* Drag and Drop Zone - DISABLED due to Electron path access limitations */}
      {/* Drag-and-drop functionality is complex in Electron due to file path access restrictions */}
      {/* Users should use the Browse button for file selection */}

      {/* Recent Paths Dropdown */}
      <RecentPathsDropdown />

      {/* Validation Message */}
      <ValidationMessage />

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Help Text */}
      <div 
        id={`${label}-help`}
        className="text-xs text-gray-500"
      >
        {type === 'directory'
          ? 'Select a directory'
          : 'Select a file'
        }
      </div>
    </div>
  );
};

// Electron API types are declared centrally in src/types/ipc.d.ts