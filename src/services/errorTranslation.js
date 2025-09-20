const { ERROR_CODES } = require('../types/errors');

class ErrorTranslationService {
  constructor() {
    this.errorTranslations = {
      // API Errors
      [ERROR_CODES.OPENAI_API_ERROR]: {
        userMessage: 'OpenAI API error. Please check your API key and try again.',
        retryable: true
      },
      [ERROR_CODES.PIAPI_API_ERROR]: {
        userMessage: 'PiAPI error. Please check your API key and try again.',
        retryable: true
      },
      [ERROR_CODES.REMOVE_BG_API_ERROR]: {
        userMessage: 'Remove.bg API error. Please check your API key and try again.',
        retryable: true
      },
      
      // Network Errors
      [ERROR_CODES.NETWORK_TIMEOUT]: {
        userMessage: 'Network timeout. Please check your internet connection and try again.',
        retryable: true
      },
      [ERROR_CODES.NETWORK_CONNECTION]: {
        userMessage: 'Network connection error. Please check your internet connection and try again.',
        retryable: true
      },
      
      // File System Errors
      [ERROR_CODES.FILE_NOT_FOUND]: {
        userMessage: 'File not found. Please check the file path and try again.',
        retryable: false
      },
      [ERROR_CODES.PERMISSION_DENIED]: {
        userMessage: 'Permission denied. Please check file permissions and try again.',
        retryable: false
      },
      [ERROR_CODES.DISK_FULL]: {
        userMessage: 'Disk is full. Please free up some space and try again.',
        retryable: false
      },
      
      // Job Errors
      [ERROR_CODES.JOB_CONFIGURATION_ERROR]: {
        userMessage: 'Job configuration error. Please check your settings and try again.',
        retryable: false
      },
      [ERROR_CODES.JOB_ALREADY_RUNNING]: {
        userMessage: 'A job is already running. Please stop the current job first.',
        retryable: false
      },
      [ERROR_CODES.JOB_NOT_FOUND]: {
        userMessage: 'Job not found. Please try starting a new job.',
        retryable: false
      },
      
      // Validation Errors
      [ERROR_CODES.INVALID_API_KEY]: {
        userMessage: 'Invalid API key. Please check your API key and try again.',
        retryable: false
      },
      [ERROR_CODES.INVALID_FILE_PATH]: {
        userMessage: 'Invalid file path. Please check the path and try again.',
        retryable: false
      },
      [ERROR_CODES.INVALID_PARAMETERS]: {
        userMessage: 'Invalid parameters. Please check your settings and try again.',
        retryable: false
      }
    };
  }

  /**
   * Translate a technical error to a user-friendly message
   * @param {Error} error - The technical error
   * @param {string} code - Error code
   * @returns {Object} Translated error with user message
   */
  translateError(error, code = null) {
    const errorCode = code || this.detectErrorCode(error);
    const translation = this.errorTranslations[errorCode];
    
    if (translation) {
      // Special-case: refine PiAPI messages when quota/credits exhausted
      let userMessage = translation.userMessage;
      let retryable = translation.retryable;
      if (errorCode === ERROR_CODES.PIAPI_API_ERROR) {
        const refined = this.translatePiapiIfApplicable(error);
        if (refined) {
          userMessage = refined.userMessage;
          retryable = refined.retryable;
        }
      }
      return {
        error: error.message,
        code: errorCode,
        userMessage,
        technicalDetails: error.stack,
        retryable,
        timestamp: new Date()
      };
    }

    // Default translation for unknown errors
    return {
      error: error.message,
      code: 'UNKNOWN_ERROR',
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: error.stack,
      retryable: true,
      timestamp: new Date()
    };
  }

  /**
   * Detect error code from error message or type
   * @param {Error} error - The error to analyze
   * @returns {string} Detected error code
   */
  detectErrorCode(error) {
    const message = error.message.toLowerCase();
    const stack = error.stack ? error.stack.toLowerCase() : '';

    // API Errors
    if (message.includes('openai') || message.includes('gpt')) {
      return ERROR_CODES.OPENAI_API_ERROR;
    }
    if (message.includes('piapi') || message.includes('pi api')) {
      return ERROR_CODES.PIAPI_API_ERROR;
    }
    if (message.includes('remove.bg') || message.includes('removebg')) {
      return ERROR_CODES.REMOVE_BG_API_ERROR;
    }

    // Network Errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return ERROR_CODES.NETWORK_TIMEOUT;
    }
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return ERROR_CODES.NETWORK_CONNECTION;
    }

    // File System Errors
    if (message.includes('enoent') || message.includes('file not found')) {
      return ERROR_CODES.FILE_NOT_FOUND;
    }
    if (message.includes('eacces') || message.includes('permission denied')) {
      return ERROR_CODES.PERMISSION_DENIED;
    }
    if (message.includes('enospc') || message.includes('disk full')) {
      return ERROR_CODES.DISK_FULL;
    }

    // Job Errors
    if (message.includes('job') && message.includes('running')) {
      return ERROR_CODES.JOB_ALREADY_RUNNING;
    }
    if (message.includes('configuration') || message.includes('config')) {
      return ERROR_CODES.JOB_CONFIGURATION_ERROR;
    }

    // Validation Errors
    if (message.includes('api key') || message.includes('apikey')) {
      return ERROR_CODES.INVALID_API_KEY;
    }
    if (message.includes('file path') || message.includes('filepath')) {
      return ERROR_CODES.INVALID_FILE_PATH;
    }
    if (message.includes('parameter') || message.includes('invalid')) {
      return ERROR_CODES.INVALID_PARAMETERS;
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Specialized translator for PiAPI responses to surface insufficient credits nicely
   */
  translatePiapiIfApplicable(error) {
    try {
      const raw = String(error && (error.response?.data || error.message || error)).toLowerCase();
      if (raw.includes('insufficient') && (raw.includes('credit') || raw.includes('quota') || raw.includes('balance'))) {
        return {
          userMessage: 'PiAPI: insufficient credits. Please top up your PiAPI balance and retry.',
          retryable: true
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a job error object
   * @param {string} jobId - Job ID
   * @param {Error} error - Technical error
   * @param {string} code - Error code
   * @returns {Object} Job error object
   */
  createJobError(jobId, error, code = null) {
    const translatedError = this.translateError(error, code);
    return {
      jobId: jobId,
      ...translatedError
    };
  }

  /**
   * Create an API error object
   * @param {string} service - Service name
   * @param {Error} error - Technical error
   * @param {string} code - Error code
   * @returns {Object} API error object
   */
  createApiError(service, error, code = null) {
    const translatedError = this.translateError(error, code);
    return {
      service: service,
      ...translatedError
    };
  }

  /**
   * Create a network error object
   * @param {string} url - Request URL
   * @param {Error} error - Technical error
   * @param {number} status - HTTP status code
   * @returns {Object} Network error object
   */
  createNetworkError(url, error, status = null) {
    const translatedError = this.translateError(error);
    return {
      url: url,
      status: status,
      ...translatedError
    };
  }

  /**
   * Create a file system error object
   * @param {string} path - File path
   * @param {string} operation - File operation
   * @param {Error} error - Technical error
   * @returns {Object} File system error object
   */
  createFileSystemError(path, operation, error) {
    const translatedError = this.translateError(error);
    return {
      path: path,
      operation: operation,
      ...translatedError
    };
  }
}

module.exports = { ErrorTranslationService };
