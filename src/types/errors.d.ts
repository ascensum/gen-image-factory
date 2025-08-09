// Error Response Types
export interface JobError {
  jobId: string;
  error: string;
  code: string;
  timestamp: Date;
  userMessage: string;
  technicalDetails?: string;
  retryable: boolean;
}

export interface ApiError {
  service: string;
  error: string;
  code: string;
  userMessage: string;
  technicalDetails?: string;
  retryable: boolean;
}

export interface NetworkError {
  url: string;
  status?: number;
  error: string;
  userMessage: string;
  retryable: boolean;
}

export interface FileSystemError {
  path: string;
  operation: string;
  error: string;
  userMessage: string;
  retryable: boolean;
}

export interface ErrorTranslation {
  [key: string]: {
    userMessage: string;
    retryable: boolean;
  };
}

export interface SecurityStatus {
  secureStorage: 'available' | 'unavailable';
  fallback: 'none' | 'plain-text-database' | 'encrypted-database';
  message: string;
  securityLevel: 'native-keychain' | 'plain-text-fallback' | 'encrypted-db';
  futureEnhancement?: string;
}

// Error codes for different types of failures
export const ERROR_CODES = {
  // API Errors
  OPENAI_API_ERROR: 'OPENAI_API_ERROR',
  PIAPI_API_ERROR: 'PIAPI_API_ERROR',
  REMOVE_BG_API_ERROR: 'REMOVE_BG_API_ERROR',
  
  // Network Errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION: 'NETWORK_CONNECTION',
  
  // File System Errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DISK_FULL: 'DISK_FULL',
  
  // Job Errors
  JOB_CONFIGURATION_ERROR: 'JOB_CONFIGURATION_ERROR',
  JOB_ALREADY_RUNNING: 'JOB_ALREADY_RUNNING',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  
  // Validation Errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  INVALID_FILE_PATH: 'INVALID_FILE_PATH',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS'
};
