import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, Shield, ShieldAlert, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Types and Interfaces
interface SecureInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onValidation?: (isValid: boolean) => void;
  serviceName: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';
type SecureStorageState = 'checking' | 'available' | 'unavailable' | 'error';

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

// API Key validation patterns
const API_KEY_PATTERNS: Record<string, RegExp> = {
  openai: /^sk-[a-zA-Z0-9]{48}$/,
  anthropic: /^sk-ant-[a-zA-Z0-9\-_]{95}$/,
  google: /^AIza[0-9A-Za-z\-_]{35}$/,
  default: /^[a-zA-Z0-9\-_]{10,}$/
};

// Debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const SecureInput: React.FC<SecureInputProps> = ({
  label,
  value,
  onChange,
  onValidation,
  serviceName,
  placeholder = 'Enter API key',
  disabled = false,
  required = false
}) => {
  // State management
  const [isVisible, setIsVisible] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [secureStorageState, setSecureStorageState] = useState<SecureStorageState>('checking');
  const [isFocused, setIsFocused] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced value for validation
  const debouncedValue = useDebounce(value, 300);

  // Check secure storage availability on mount
  useEffect(() => {
    checkSecureStorageAvailability();
  }, []);

  // Validate API key when debounced value changes
  useEffect(() => {
    if (debouncedValue && debouncedValue !== '') {
      validateApiKey(debouncedValue);
    } else {
      setValidationState('idle');
      setErrorMessage('');
      onValidation?.(false);
    }
  }, [debouncedValue, serviceName, onValidation]);

  // Check if secure storage (keytar) is available
  const checkSecureStorageAvailability = async () => {
    try {
      setSecureStorageState('checking');
      
      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && window.electronAPI) {
        const isAvailable = await window.electronAPI.isSecureStorageAvailable();
        setSecureStorageState(isAvailable ? 'available' : 'unavailable');
      } else {
        setSecureStorageState('unavailable');
      }
    } catch (error) {
      console.error('Error checking secure storage availability:', error);
      setSecureStorageState('error');
    }
  };

  // Validate API key format
  const validateApiKey = useCallback((key: string): ValidationResult => {
    if (!key || key.trim() === '') {
      return { isValid: false, message: required ? 'API key is required' : '' };
    }

    // Sanitize input
    const sanitizedKey = key.trim();
    
    // Check for common security issues
    if (sanitizedKey.includes(' ')) {
      return { isValid: false, message: 'API key should not contain spaces' };
    }

    if (sanitizedKey.length < 10) {
      return { isValid: false, message: 'API key is too short' };
    }

    // Get pattern for specific service or use default
    const pattern = API_KEY_PATTERNS[serviceName.toLowerCase()] || API_KEY_PATTERNS.default;
    
    if (!pattern.test(sanitizedKey)) {
      return { 
        isValid: false, 
        message: `Invalid ${serviceName} API key format` 
      };
    }

    return { isValid: true };
  }, [serviceName, required]);

  // Handle validation with debounce
  const handleValidation = useCallback(async (key: string) => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    setValidationState('validating');
    setErrorMessage('');

    validationTimeoutRef.current = setTimeout(() => {
      const result = validateApiKey(key);
      
      if (result.isValid) {
        setValidationState('valid');
        setErrorMessage('');
        onValidation?.(true);
      } else {
        setValidationState('invalid');
        setErrorMessage(result.message || 'Invalid API key');
        onValidation?.(false);
      }
    }, 100);
  }, [validateApiKey, onValidation]);

  // Handle input change
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    
    if (newValue) {
      handleValidation(newValue);
    } else {
      setValidationState('idle');
      setErrorMessage('');
      onValidation?.(false);
    }
  }, [onChange, handleValidation, onValidation]);

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
    
    // Refocus input after toggle
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, []);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Get input styling based on state
  const getInputStyling = () => {
    const baseClasses = 'w-full px-3 py-2 pr-10 border rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0';
    
    if (disabled) {
      return `${baseClasses} bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed`;
    }

    if (validationState === 'invalid' && errorMessage) {
      return `${baseClasses} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`;
    }

    if (validationState === 'valid') {
      return `${baseClasses} border-green-300 text-green-900 focus:ring-green-500 focus:border-green-500`;
    }

    if (isFocused) {
      return `${baseClasses} border-blue-300 focus:ring-blue-500 focus:border-blue-500`;
    }

    return `${baseClasses} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  // Validation Status Component
  const ValidationStatus = () => {
    if (validationState === 'idle' || !value) return null;

    return (
      <div className="flex items-center gap-1 text-xs">
        {validationState === 'validating' && (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            <span className="text-blue-600">Validating...</span>
          </>
        )}
        {validationState === 'valid' && (
          <>
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span className="text-green-600">Valid API key</span>
          </>
        )}
        {validationState === 'invalid' && (
          <>
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-red-600">Invalid format</span>
          </>
        )}
      </div>
    );
  };

  // Secure Storage Status Component
  const SecureStorageStatus = () => {
    return (
      <div className="flex items-center gap-1 text-xs">
        {secureStorageState === 'checking' && (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            <span className="text-gray-500">Checking storage...</span>
          </>
        )}
        {secureStorageState === 'available' && (
          <>
            <Shield className="w-3 h-3 text-green-500" />
            <span className="text-green-600">Secure Keychain</span>
          </>
        )}
        {secureStorageState === 'unavailable' && (
          <>
            <ShieldAlert className="w-3 h-3 text-yellow-500" />
            <span className="text-yellow-600">Encrypted DB (Fallback)</span>
          </>
        )}
        {secureStorageState === 'error' && (
          <>
            <ShieldAlert className="w-3 h-3 text-red-500" />
            <span className="text-red-600">Storage error</span>
          </>
        )}
      </div>
    );
  };

  // Error Message Component
  const ErrorMessage = () => {
    if (!errorMessage || validationState !== 'invalid') return null;

    return (
      <div 
        className="text-sm text-red-600 mt-1"
        role="alert"
        aria-live="polite"
      >
        {errorMessage}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <label 
        htmlFor={`secure-input-${serviceName}`}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          ref={inputRef}
          id={`secure-input-${serviceName}`}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={getInputStyling()}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${serviceName}-help ${serviceName}-error`}
          aria-invalid={validationState === 'invalid'}
        />
        
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled || !value}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={isVisible ? 'Hide API key' : 'Show API key'}
          tabIndex={disabled ? -1 : 0}
        >
          {isVisible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <div className="flex items-center justify-between">
        <ValidationStatus />
        <SecureStorageStatus />
      </div>
      
      <ErrorMessage />
      
      {/* Help text */}
      <div 
        id={`${serviceName}-help`}
        className="text-xs text-gray-500"
      >
        {secureStorageState === 'available' 
          ? 'API key will be stored securely in your system keychain'
          : 'API key will be encrypted and stored in the local database (Secure Fallback)'
        }
      </div>
    </div>
  );
};

// Electron API types are declared centrally in src/types/ipc.d.ts