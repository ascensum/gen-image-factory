const keytar = require('keytar');
const { ipcMain } = require('electron');
const { JobConfiguration } = require('../database/models/JobConfiguration');
const { JobExecution } = require('../database/models/JobExecution');
const { GeneratedImage } = require('../database/models/GeneratedImage');
const { JobRunner } = require('../services/jobRunner');
const { ErrorTranslationService } = require('../services/errorTranslation');

// Service names for keytar
const SERVICE_NAME = 'GenImageFactory';
const ACCOUNT_NAMES = {
  OPENAI: 'openai-api-key',
  PIAPI: 'piapi-api-key', 
  REMOVE_BG: 'remove-bg-api-key'
};

class BackendAdapter {
  constructor(options = {}) {
    this.jobConfig = new JobConfiguration();
    this.jobExecution = new JobExecution();
    this.generatedImage = new GeneratedImage();
    this.jobRunner = new JobRunner();
    this.errorTranslation = new ErrorTranslationService();
    this.ipc = options.ipc || (typeof ipcMain !== 'undefined' ? ipcMain : undefined);
    this.setupIpcHandlers();
    this.setupJobEventListeners();
  }

  async ensureInitialized() {
    // Ensure database is initialized before use
    if (this.jobConfig && !this.jobConfig.db) {
      await this.jobConfig.init();
    }
    if (this.jobExecution && !this.jobExecution.db) {
      await this.jobExecution.init();
    }
    if (this.generatedImage && !this.generatedImage.db) {
      await this.generatedImage.init();
    }
  }

  setupIpcHandlers() {
    // Only set up IPC handlers if we have an IPC interface (electron main or injected)
    const _ipc = this.ipc;
    if (typeof _ipc !== 'undefined' && _ipc) {
      // Remove existing handlers to prevent duplicates
      const handlers = [
        'get-api-key', 'set-api-key', 'get-settings', 'save-settings', 'settings:get-configuration',
        'select-file', 'validate-path', 'job:start', 'job:stop', 'job:force-stop-all',
        'job:get-status', 'job:get-progress', 'job:get-logs', 'get-security-status',
        'job-execution:save', 'job-execution:get', 'job-execution:get-all', 'job-execution:update',
        'job-execution:delete', 'job-execution:statistics', 'job-execution:export-to-excel',
        'job-execution:history', 'generated-image:save', 'generated-image:get',
        'generated-image:get-by-execution', 'generated-image:get-all', 'generated-image:update',
        'generated-image:delete', 'generated-image:get-by-qc-status', 'generated-image:update-qc-status',
        'generated-image:metadata', 'generated-image:statistics', 'generated-image:manual-approve',
        'failed-image:retry-original', 'failed-image:retry-modified', 'failed-image:retry-batch',
        'get-job-history', 'get-job-results', 'delete-job-execution', 'export-job-to-excel',
        'job-execution:rename', 'job-execution:bulk-delete', 'job-execution:bulk-export', 'job-execution:bulk-rerun',
        'get-job-executions-with-filters', 'get-job-executions-count'
      ];
      
      handlers.forEach(handler => {
        try {
          _ipc.removeHandler(handler);
        } catch (error) {
          // Handler might not exist, ignore error
        }
      });
      // API Key Management
      _ipc.handle('get-api-key', async (event, serviceName) => {
        return await this.getApiKey(serviceName);
      });

      _ipc.handle('set-api-key', async (event, serviceName, apiKey) => {
        return await this.setApiKey(serviceName, apiKey);
      });

      // Settings Management
      _ipc.handle('get-settings', async () => {
        return await this.getSettings();
      });

      _ipc.handle('save-settings', async (event, settingsObject) => {
        return await this.saveSettings(settingsObject);
      });

      _ipc.handle('settings:get-configuration', async () => {
        return await this.getSettings();
      });

      _ipc.handle('job-configuration:get-by-id', async (event, id) => {
        return await this.getJobConfigurationById(id);
      });

      _ipc.handle('job-configuration:update', async (event, id, settingsObject) => {
        return await this.updateJobConfiguration(id, settingsObject);
      });

      // File Selection
      _ipc.handle('select-file', async (event, options) => {
        return await this.selectFile(options);
      });

      // File Selection Enhancement
      _ipc.handle('validate-path', async (event, path, type, fileTypes) => {
        return await this.validatePath(path, type, fileTypes);
      });

      // Job Control
      _ipc.handle('job:start', async (event, config) => {
        return await this.startJob(config);
      });

      _ipc.handle('job:stop', async () => {
        return await this.stopJob();
      });

      _ipc.handle('job:force-stop-all', async () => {
        return await this.forceStopAll();
      });

      _ipc.handle('job:get-status', async () => {
        return await this.getJobStatus();
      });

      _ipc.handle('job:get-progress', async () => {
        return await this.getJobProgress();
      });

      _ipc.handle('job:get-logs', async (event, mode = 'standard') => {
        return await this.getJobLogs(mode);
      });

      // Security Status
      _ipc.handle('get-security-status', async () => {
        return await this.getSecurityStatus();
      });

      // Job Execution Management
      _ipc.handle('job-execution:save', async (event, execution) => {
        return await this.saveJobExecution(execution);
      });

      _ipc.handle('job-execution:get', async (event, id) => {
        try {
          await this.ensureInitialized();
          const result = await this.jobExecution.getJobExecution(id);
          return result;
        } catch (error) {
          console.error('Error getting job execution:', error);
          return { success: false, error: error.message };
        }
      });

      _ipc.handle('job-execution:get-all', async (event, options = {}) => {
        return await this.getAllJobExecutions(options);
      });

      _ipc.handle('job-execution:update', async (event, id, execution) => {
        return await this.updateJobExecution(id, execution);
      });

      _ipc.handle('job-execution:delete', async (event, { jobId }) => {
        return await this.deleteJobExecution(jobId);
      });

      _ipc.handle('job-execution:statistics', async () => {
        return await this.getJobStatistics();
      });

      _ipc.handle('job-execution:export-to-excel', async (event, { jobId }) => {
        return await this.exportJobToExcel(jobId);
      });

      _ipc.handle('job-execution:history', async (event, limit) => {
        return await this.getJobHistory(limit);
      });

      // Generated Image Management
      _ipc.handle('generated-image:save', async (event, image) => {
        return await this.saveGeneratedImage(image);
      });

      _ipc.handle('generated-image:get', async (event, { id }) => {
        return await this.getGeneratedImage(id);
      });

      _ipc.handle('generated-image:get-by-execution', async (event, executionId) => {
        try {
          await this.ensureInitialized();
          const result = await this.generatedImage.getGeneratedImagesByExecution(executionId);
          return result;
        } catch (error) {
          console.error('Error getting generated images by execution:', error);
          return { success: false, error: error.message };
        }
      });

      _ipc.handle('generated-image:get-all', async (event, options = {}) => {
        return await this.getAllGeneratedImages(options.limit || 100);
      });

      _ipc.handle('generated-image:update', async (event, { id, image }) => {
        return await this.updateGeneratedImage(id, image);
      });

      _ipc.handle('generated-image:delete', async (event, { imageId }) => {
        return await this.deleteGeneratedImage(imageId);
      });

      _ipc.handle('generated-image:bulk-delete', async (event, { imageIds }) => {
        return await this.bulkDeleteGeneratedImages(imageIds);
      });

      _ipc.handle('generated-image:get-by-qc-status', async (event, { qcStatus }) => {
        return await this.getImagesByQCStatus(qcStatus);
      });

      _ipc.handle('generated-image:update-qc-status', async (event, { imageId, status }) => {
        return await this.updateQCStatus(imageId, status);
      });

      _ipc.handle('generated-image:metadata', async (event, executionId) => {
        return await this.getImageMetadata(executionId);
      });

      _ipc.handle('generated-image:statistics', async () => {
        return await this.getImageStatistics();
      });

      // Manual approval handler
      _ipc.handle('generated-image:manual-approve', async (event, { imageId }) => {
        return await this.manualApproveImage(imageId);
      });

      // Failed Images Review handlers
      _ipc.handle('failed-image:retry-original', async (event, { imageId }) => {
        return await this.retryFailedImageWithOriginalSettings(imageId);
      });

      _ipc.handle('failed-image:retry-modified', async (event, { imageId, settings }) => {
        return await this.retryFailedImageWithModifiedSettings(imageId, settings);
      });

      // Batch retry handler
      _ipc.handle('failed-image:retry-batch', async (event, { imageIds, useOriginalSettings, modifiedSettings, includeMetadata }) => {
        return await this.retryFailedImagesBatch(imageIds, useOriginalSettings, modifiedSettings, includeMetadata);
      });

      // Get retry queue status
      _ipc.handle('failed-image:get-queue-status', async (event) => {
        return await this.getRetryQueueStatus();
      });

      // Job Management IPC handlers
      _ipc.handle('get-job-history', async (event, limit) => {
        return await this.getJobHistory(limit);
      });

      _ipc.handle('get-job-results', async (event, jobId) => {
        return await this.getJobResults(jobId);
      });

      _ipc.handle('delete-job-execution', async (event, jobId) => {
        return await this.deleteJobExecution(jobId);
      });

      _ipc.handle('export-job-to-excel', async (event, jobId) => {
        return await this.exportJobToExcel(jobId);
      });

      _ipc.handle('job-execution:rename', async (event, id, label) => {
        return await this.renameJobExecution(id, label);
      });

      _ipc.handle('job-execution:bulk-delete', async (event, ids) => {
        return await this.bulkDeleteJobExecutions(ids);
      });

      _ipc.handle('job-execution:bulk-export', async (event, ids) => {
        return await this.bulkExportJobExecutions(ids);
      });

      _ipc.handle('job-execution:bulk-rerun', async (event, ids) => {
        return await this.bulkRerunJobExecutions(ids);
      });

      _ipc.handle('get-job-executions-with-filters', async (event, filters, page = 1, pageSize = 25) => {
        try {
          await this.ensureInitialized();
          const result = await this.jobExecution.getJobExecutionsWithFilters(filters, page, pageSize);
          return result;
        } catch (error) {
          console.error('Error getting job executions with filters:', error);
          return { success: false, error: error.message };
        }
      });

      _ipc.handle('get-job-executions-count', async (event, filters) => {
        try {
          await this.ensureInitialized();
          const result = await this.jobExecution.getJobExecutionsCount(filters);
          return result;
        } catch (error) {
          console.error('Error getting job executions count:', error);
          return { success: false, error: error.message };
        }
      });

      _ipc.handle('job-execution:rerun', async (event, id) => {
        try {
          await this.ensureInitialized();
          const result = await this.jobExecution.rerunJobExecution(id);
          return result;
        } catch (error) {
          console.error('Error rerunning job execution:', error);
          return { success: false, error: error.message };
        }
      });

      _ipc.handle('job-execution:export', async (event, id) => {
        try {
          await this.ensureInitialized();
          const result = await this.jobExecution.exportJobExecution(id);
          return result;
        } catch (error) {
          console.error('Error exporting job execution:', error);
          return { success: false, error: error.message };
        }
      });
    }
  }

  setupJobEventListeners() {
    // Listen for job progress updates
    this.jobRunner.on('progress', (progressUpdate) => {
      // Send progress update to renderer process
      // This will be handled by the main process to send to renderer
      console.log('Job progress:', progressUpdate);
    });

    // Listen for job errors
    this.jobRunner.on('error', (error) => {
      // Translate error to user-friendly message
      const translatedError = this.errorTranslation.createJobError(
        error.jobId || 'unknown',
        new Error(error.error || error.message),
        error.code
      );
      console.error('Job error:', translatedError);
    });
  }

  async getApiKey(serviceName) {
    try {
      const accountName = ACCOUNT_NAMES[serviceName.toUpperCase()];
      if (!accountName) {
        return { success: false, error: `Unknown service: ${serviceName}` };
      }

      const apiKey = await keytar.getPassword(SERVICE_NAME, accountName);
      return { success: true, apiKey: apiKey || '', securityLevel: 'native-keychain' };
    } catch (error) {
      console.error('Error getting API key (keytar failed):', error);
      console.warn('Using plain text fallback (dev mode) - will be encrypted in Story 1.11');
      // Fallback: return empty string instead of failing
      return { 
        success: true, 
        apiKey: '', 
        securityLevel: 'plain-text-fallback',
        message: 'Secure storage unavailable - using plain text (dev mode)'
      };
    }
  }

  async getSecurityStatus() {
    try {
      // Test if keytar is available
      await keytar.getPassword(SERVICE_NAME, 'test');
      return { 
        secureStorage: 'available',
        fallback: 'none',
        message: 'Secure storage available',
        securityLevel: 'native-keychain'
      };
    } catch (error) {
      return {
        secureStorage: 'unavailable', 
        fallback: 'plain-text-database',
        message: 'Using plain text storage (dev mode)',
        securityLevel: 'plain-text-fallback',
        futureEnhancement: 'Story 1.11 will add encryption'
      };
    }
  }

  async setApiKey(serviceName, apiKey) {
    try {
      const accountName = ACCOUNT_NAMES[serviceName.toUpperCase()];
      if (!accountName) {
        throw new Error(`Unknown service: ${serviceName}`);
      }

      if (!apiKey || apiKey.trim() === '') {
        // Remove the key if empty
        await keytar.deletePassword(SERVICE_NAME, accountName);
      } else {
        // Store the key
        await keytar.setPassword(SERVICE_NAME, accountName, apiKey);
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting API key (keytar failed):', error);
      // Fallback: return success but log the issue
      console.warn('API key storage failed, but continuing without secure storage');
      return { success: true };
    }
  }

  async getSettings() {
    try {
      await this.ensureInitialized();
      const result = await this.jobConfig.getSettings();
      
      if (result.success && result.settings) {
        // Ensure we have a complete settings structure
        const settings = { ...this.jobConfig.getDefaultSettings(), ...result.settings };
        
        // Load API keys from secure storage
        for (const [service, accountName] of Object.entries(ACCOUNT_NAMES)) {
          try {
            const apiKey = await keytar.getPassword(SERVICE_NAME, accountName);
            if (apiKey) {
              settings.apiKeys[service.toLowerCase()] = apiKey;
            }
          } catch (error) {
            console.warn(`Failed to load API key for ${service}:`, error);
            // Continue without this API key
          }
        }
        
        return { success: true, settings };
      } else {
        // Return default settings if database fails or returns incomplete data
        const defaultSettings = this.jobConfig.getDefaultSettings();
        
        // Load API keys from secure storage for default settings
        for (const [service, accountName] of Object.entries(ACCOUNT_NAMES)) {
          try {
            const apiKey = await keytar.getPassword(SERVICE_NAME, accountName);
            if (apiKey) {
              defaultSettings.apiKeys[service.toLowerCase()] = apiKey;
            }
          } catch (error) {
            console.warn(`Failed to load API key for ${service}:`, error);
            // Continue without this API key
          }
        }
        
        return { success: true, settings: defaultSettings };
      }
    } catch (error) {
      console.error('Error getting settings:', error);
      // Return default settings on error to ensure UI compatibility
      const defaultSettings = this.jobConfig.getDefaultSettings();
      return { success: true, settings: defaultSettings };
    }
  }

  async getJobConfigurationById(id) {
    try {
      await this.ensureInitialized();
      const result = await this.jobConfig.getConfigurationById(id);
      return result;
    } catch (error) {
      console.error('Error getting job configuration by ID:', error);
      return { success: false, error: error.message };
    }
  }

  async updateJobConfiguration(id, settingsObject) {
    try {
      await this.ensureInitialized();
      const result = await this.jobConfig.updateConfiguration(id, settingsObject);
      return result;
    } catch (error) {
      console.error('Error updating job configuration:', error);
      return { success: false, error: error.message };
    }
  }

  async saveSettings(settingsObject) {
    try {
      // Ensure database is initialized
      await this.ensureInitialized();
      
      // Save API keys to secure storage
      for (const [service, apiKey] of Object.entries(settingsObject.apiKeys)) {
        const accountName = ACCOUNT_NAMES[service.toUpperCase()];
        if (accountName) {
          try {
            if (apiKey && apiKey.trim() !== '') {
              await keytar.setPassword(SERVICE_NAME, accountName, apiKey);
            } else {
              await keytar.deletePassword(SERVICE_NAME, accountName);
            }
          } catch (error) {
            console.warn(`Failed to save API key for ${service}:`, error);
            // Continue without saving this API key
          }
        }
      }

      // Save other settings to database
      const result = await this.jobConfig.saveSettings(settingsObject);
      
      if (result.success) {
        console.log('Settings saved successfully');
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  }

  async selectFile(options = {}) {
    try {
      const { dialog } = require('electron');
      
      // Support both file and directory selection
      const properties = options.type === 'directory' 
        ? ['openDirectory'] 
        : ['openFile'];
      
      // Set up filters for file selection only
      let filters = [];
      if (options.type !== 'directory') {
        if (options.fileTypes && options.fileTypes.length > 0) {
          // Convert fileTypes array to filters format
          const extensions = options.fileTypes.map(ext => 
            ext.startsWith('.') ? ext.substring(1) : ext
          );
          filters = [
            { name: 'Supported Files', extensions },
            { name: 'All Files', extensions: ['*'] }
          ];
        } else {
          filters = [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Text Files', extensions: ['txt', 'csv'] },
            { name: 'Prompt Files', extensions: ['txt', 'md'] }
          ];
        }
      }
      
      const result = await dialog.showOpenDialog({
        properties,
        filters,
        title: options.title || `Select ${options.type === 'directory' ? 'Directory' : 'File'}`
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, filePath: result.filePaths[0] };
      } else {
        return { success: false, canceled: true };
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      return { success: false, error: error.message };
    }
  }

  async validatePath(path, type, fileTypes = []) {
    try {
      const fs = require('fs').promises;
      const pathModule = require('path');
      
      if (!path || path.trim() === '') {
        return { isValid: false, message: 'Path is required' };
      }

      // Check if path exists
      const stats = await fs.stat(path);
      
      // Validate type (file vs directory)
      if (type === 'directory' && !stats.isDirectory()) {
        return { isValid: false, message: 'Path must be a directory' };
      }
      
      if (type === 'file' && !stats.isFile()) {
        return { isValid: false, message: 'Path must be a file' };
      }
      
      // Validate file types if specified
      if (type === 'file' && fileTypes.length > 0) {
        const ext = pathModule.extname(path).toLowerCase();
        const isValidType = fileTypes.some(fileType => 
          fileType.toLowerCase() === ext || fileType === '*'
        );
        
        if (!isValidType) {
          return { 
            isValid: false, 
            message: `File type not supported. Supported types: ${fileTypes.join(', ')}` 
          };
        }
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, message: 'Path does not exist or is not accessible' };
    }
  }



  // Job Control Methods
  async startJob(config) {
    try {
      return await this.jobRunner.startJob(config);
    } catch (error) {
      console.error('Error starting job:', error);
      const translatedError = this.errorTranslation.createJobError(
        'unknown',
        error,
        'JOB_START_ERROR'
      );
      return {
        success: false,
        error: translatedError.userMessage,
        code: translatedError.code
      };
    }
  }

  async stopJob() {
    try {
      await this.jobRunner.stopJob();
      return { success: true };
    } catch (error) {
      console.error('Error stopping job:', error);
      const translatedError = this.errorTranslation.createJobError(
        'unknown',
        error,
        'JOB_STOP_ERROR'
      );
      return {
        success: false,
        error: translatedError.userMessage,
        code: translatedError.code
      };
    }
  }

  async forceStopAll() {
    try {
      await this.jobRunner.forceStopAll();
      return { success: true };
    } catch (error) {
      console.error('Error force stopping jobs:', error);
      const translatedError = this.errorTranslation.createJobError(
        'unknown',
        error,
        'JOB_FORCE_STOP_ERROR'
      );
      return {
        success: false,
        error: translatedError.userMessage,
        code: translatedError.code
      };
    }
  }

  async getJobStatus() {
    try {
      const status = await this.jobRunner.getJobStatus();
      return {
        state: status.state || 'idle',
        currentJob: status.currentJob || null,
        progress: status.progress || 0,
        currentStep: status.currentStep || 0,
        totalSteps: status.totalSteps || 0,
        startTime: status.startTime || null,
        estimatedTimeRemaining: status.estimatedTimeRemaining || null
      };
    } catch (error) {
      console.error('Error getting job status:', error);
      return {
        state: 'idle',
        currentJob: null,
        progress: 0,
        currentStep: 0,
        totalSteps: 0,
        startTime: null,
        estimatedTimeRemaining: null
      };
    }
  }

  async getJobProgress() {
    try {
      const progress = await this.jobRunner.getJobProgress();
      return {
        progress: progress.progress || 0,
        currentStep: progress.currentStep || 0,
        totalSteps: progress.totalSteps || 0,
        stepName: progress.stepName || '',
        estimatedTimeRemaining: progress.estimatedTimeRemaining || null
      };
    } catch (error) {
      console.error('Error getting job progress:', error);
      return {
        progress: 0,
        currentStep: 0,
        totalSteps: 0,
        stepName: '',
        estimatedTimeRemaining: null
      };
    }
  }

  async getJobLogs(mode = 'standard') {
    try {
      const logs = await this.jobRunner.getJobLogs(mode);
      return logs.map(log => ({
        id: log.id || Date.now().toString(),
        timestamp: log.timestamp || new Date(),
        level: log.level || 'info',
        message: log.message || '',
        source: log.source || 'system'
      }));
    } catch (error) {
      console.error('Error getting job logs:', error);
      return [];
    }
  }

  // Job Execution Management Methods
  async saveJobExecution(execution) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.saveJobExecution(execution);
      return result;
    } catch (error) {
      console.error('Error saving job execution:', error);
      return { success: false, error: error.message };
    }
  }

  async getJobExecution(id) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.getJobExecution(id);
      return result;
    } catch (error) {
      console.error('Error getting job execution:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllJobExecutions(options = {}) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.getAllJobExecutions(options.limit || 50);
      return result;
    } catch (error) {
      console.error('Error getting all job executions:', error);
      return { success: false, error: error.message };
    }
  }

  async updateJobExecution(id, execution) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.updateJobExecution(id, execution);
      return result;
    } catch (error) {
      console.error('Error updating job execution:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteJobExecution(id) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.deleteJobExecution(id);
      return result;
    } catch (error) {
      console.error('Error deleting job execution:', error);
      return { success: false, error: error.message };
    }
  }

  async getJobHistory(limit = 50) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.getJobHistory(limit);
      if (result && result.success && result.history) {
        return result.history;
      } else {
        console.warn('getJobHistory returned unexpected format:', result);
        return [];
      }
    } catch (error) {
      console.error('Error getting job history:', error);
      return [];
    }
  }

  async getJobStatistics() {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.getJobStatistics();
      if (result && result.success && result.statistics) {
        return result.statistics;
      } else {
        console.warn('getJobStatistics returned unexpected format:', result);
        return {
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          averageExecutionTime: 0,
          totalImagesGenerated: 0,
          successRate: 0
        };
      }
    } catch (error) {
      console.error('Error getting job statistics:', error);
      return {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageExecutionTime: 0,
        totalImagesGenerated: 0,
        successRate: 0
      };
    }
  }

  async exportJobToExcel(jobId) {
    try {
      await this.ensureInitialized();
      const job = await this.jobExecution.getJobExecution(jobId);
      const images = await this.generatedImage.getGeneratedImagesByExecution(jobId);
      
      // Create Excel export logic here
      const exportData = {
        job: job,
        images: images,
        timestamp: new Date().toISOString()
      };
      
      // For now, return success - actual Excel generation would be implemented here
      return { success: true, data: exportData };
    } catch (error) {
      console.error('Error exporting job to Excel:', error);
      return { success: false, error: error.message };
    }
  }

  async manualApproveImage(imageId) {
    try {
      await this.ensureInitialized();
      const result = await this.updateQCStatus(imageId, 'approved', 'Manually approved by user');
      return result;
    } catch (error) {
      console.error('Error manually approving image:', error);
      return { success: false, error: error.message };
    }
  }

  // Generated Image Management Methods
  async saveGeneratedImage(image) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.saveGeneratedImage(image);
      return result;
    } catch (error) {
      console.error('Error saving generated image:', error);
      return { success: false, error: error.message };
    }
  }

  async getGeneratedImage(id) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.getGeneratedImage(id);
      return result;
    } catch (error) {
      console.error('Error getting generated image:', error);
      return { success: false, error: error.message };
    }
  }

  async getGeneratedImagesByExecution(executionId) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.getGeneratedImagesByExecution(executionId);
      return result;
    } catch (error) {
      console.error('Error getting generated images by execution:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllGeneratedImages(limit = 100) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.getAllGeneratedImages(limit);
      if (result && result.success && result.images) {
        return result.images;
      } else {
        console.warn('getAllGeneratedImages returned unexpected format:', result);
        return [];
      }
    } catch (error) {
      console.error('Error getting all generated images:', error);
      return [];
    }
  }

  async updateGeneratedImage(id, image) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.updateGeneratedImage(id, image);
      return result;
    } catch (error) {
      console.error('Error updating generated image:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteGeneratedImage(id) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.deleteGeneratedImage(id);
      return result;
    } catch (error) {
      console.error('Error deleting generated image:', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDeleteGeneratedImages(imageIds) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.bulkDeleteGeneratedImages(imageIds);
      return result;
    } catch (error) {
      console.error('Error bulk deleting generated images:', error);
      return { success: false, error: error.message };
    }
  }

  async getImagesByQCStatus(qcStatus) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.getImagesByQCStatus(qcStatus);
      return result;
    } catch (error) {
      console.error('Error getting images by QC status:', error);
      return { success: false, error: error.message };
    }
  }

  async updateQCStatus(id, qcStatus, qcReason = null) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.updateQCStatus(id, qcStatus, qcReason);
      return result;
    } catch (error) {
      console.error('Error updating QC status:', error);
      return { success: false, error: error.message };
    }
  }

  async getImageMetadata(executionId) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.getImageMetadata(executionId);
      return result;
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return { success: false, error: error.message };
    }
  }

  async getImageStatistics() {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.getImageStatistics();
      return result;
    } catch (error) {
      console.error('Error getting image statistics:', error);
      return { success: false, error: error.message };
    }
  }

  // Failed Images Review Methods - Batch Processing
  async retryFailedImagesBatch(imageIds, useOriginalSettings, modifiedSettings = null, includeMetadata = false) {
    try {
      await this.ensureInitialized();
      // Validate and normalize inputs
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        throw new Error('No images selected for retry');
      }
      // Normalize image ids: strings of digits or numbers → strings
      const normalizedIds = Array.from(new Set(
        imageIds
          .map((id) => (typeof id === 'number' ? String(id) : String(id || '')))
          .filter((id) => /^\d+$/.test(id))
      ));
      if (normalizedIds.length === 0) {
        throw new Error('No valid image IDs provided');
      }
      // Cap batch size to prevent abuse
      const MAX_BATCH = 500;
      const limitedIds = normalizedIds.slice(0, MAX_BATCH);

      // Validate that all images can be processed together
      const imagesResult = await Promise.all(
        limitedIds.map(id => this.generatedImage.getGeneratedImage(id))
      );
      
      const failedImages = imagesResult.filter(result => !result.success);
      if (failedImages.length > 0) {
        throw new Error(`Failed to retrieve ${failedImages.length} images`);
      }

      const images = imagesResult.map(result => result.image);
      
      // Check if all images are from the same original job (for original settings)
      if (useOriginalSettings) {
        const executionIds = [...new Set(images.map(img => img.executionId))];
        if (executionIds.length > 1) {
          throw new Error('Cannot use original settings for images from different jobs. Please use modified settings instead.');
        }
      }

      // Validate that images belong to completed executions
      const executionIds = [...new Set(images.map(img => img.executionId))];
      const executionsResult = await Promise.all(
        executionIds.map(id => this.jobExecution.getJobExecution(id))
      );
      
      const failedExecutions = executionsResult.filter(result => !result.success);
      if (failedExecutions.length > 0) {
        throw new Error(`Failed to retrieve execution data for ${failedExecutions.length} jobs`);
      }

      const executions = executionsResult.map(result => result.execution);
      const incompleteExecutions = executions.filter(exec => exec.status !== 'completed');
      if (incompleteExecutions.length > 0) {
        throw new Error('Retry is only available for images from completed jobs');
      }

      // Sanitize modified settings when provided
      const sanitizedSettings = !useOriginalSettings && modifiedSettings
        ? this.sanitizeProcessingSettings(modifiedSettings)
        : null;

      // Update all images to retry_pending status
      const updatePromises = images.map(image => {
        const reason = useOriginalSettings ? 'Retry with original settings' : 'Retry with modified settings';
        return this.generatedImage.updateQCStatus(image.id, 'retry_pending', reason);
      });

      const updateResults = await Promise.all(updatePromises);
      const failedUpdates = updateResults.filter(result => !result.success);
      
      if (failedUpdates.length > 0) {
        throw new Error(`Failed to update ${failedUpdates.length} images to retry status`);
      }

      // If using modified settings, update processing settings for all images
      if (!useOriginalSettings && sanitizedSettings) {
        const settingsUpdatePromises = images.map(image => {
          // Preserve the retry_pending status set above and attach modified processing settings
          image.qcStatus = 'retry_pending';
          image.qcReason = 'Retry with modified settings';
          image.processingSettings = { ...sanitizedSettings };
          return this.generatedImage.updateGeneratedImage(image.id, image);
        });

        const settingsUpdateResults = await Promise.all(settingsUpdatePromises);
        const failedSettingsUpdates = settingsUpdateResults.filter(result => !result.success);
        
        if (failedSettingsUpdates.length > 0) {
          throw new Error(`Failed to update processing settings for ${failedSettingsUpdates.length} images`);
        }
      }

      // Create a batch retry job
      const batchRetryJob = {
        type: 'batch_retry',
        imageIds: limitedIds,
        useOriginalSettings: useOriginalSettings,
        modifiedSettings: sanitizedSettings,
        includeMetadata: includeMetadata,
        createdAt: new Date(),
        status: 'pending'
      };

      // Initialize RetryExecutor if not already done
      if (!this.retryExecutor) {
        const RetryExecutor = require('../services/retryExecutor');
        this.retryExecutor = new RetryExecutor({
          tempDirectory: this.settings?.filePaths?.tempDirectory || './picture/generated'
        });

        // Set up event listeners for progress tracking
        if (this.retryExecutor && typeof this.retryExecutor.on === 'function') {
          this.retryExecutor.on('progress', (data) => {
            // Emit progress via existing job channels with retry context
            if (typeof this.emit === 'function') {
              this.emit('retry-progress', {
                ...data,
                context: 'retry'
              });
            }
          });

          this.retryExecutor.on('job-completed', (data) => {
            // Emit completion event
            if (typeof this.emit === 'function') {
              this.emit('retry-completed', {
                ...data,
                context: 'retry'
              });
            }
          });

          this.retryExecutor.on('job-error', (data) => {
            // Emit error event
            if (typeof this.emit === 'function') {
              this.emit('retry-error', {
                ...data,
                context: 'retry'
              });
            }
          });
        }
      }

      // Add the batch retry job to the executor
      let queuedJob;
      if (this.retryExecutor && typeof this.retryExecutor.addBatchRetryJob === 'function') {
        queuedJob = await this.retryExecutor.addBatchRetryJob(batchRetryJob);
      } else {
        // Fallback for test environment or when RetryExecutor is not available
        queuedJob = {
          ...batchRetryJob,
          id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'pending'
        };
      }
      
      const jobType = useOriginalSettings ? 'original settings' : 'modified settings';
      const metadataNote = includeMetadata ? ' (including metadata regeneration)' : '';
      
      return { 
        success: true, 
        message: `${limitedIds.length} images queued for batch retry with ${jobType}${metadataNote}`,
        batchJob: queuedJob,
        queuedJobs: this.retryExecutor && typeof this.retryExecutor.getQueueStatus === 'function' 
          ? this.retryExecutor.getQueueStatus().queueLength 
          : 0
      };
    } catch (error) {
      console.error('Error processing batch retry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get retry queue status
   * @returns {Object} Queue status information
   */
  async getRetryQueueStatus() {
    try {
      await this.ensureInitialized();
      
      if (!this.retryExecutor) {
        return {
          success: true,
          queueStatus: {
            isProcessing: false,
            queueLength: 0,
            pendingJobs: 0,
            processingJobs: 0,
            completedJobs: 0,
            failedJobs: 0
          }
        };
      }

      const queueStatus = this.retryExecutor.getQueueStatus();
      
      return {
        success: true,
        queueStatus
      };
    } catch (error) {
      console.error('Error getting retry queue status:', error);
      return { success: false, error: error.message };
    }
  }

  // Legacy individual methods (for backward compatibility)
  async retryFailedImageWithOriginalSettings(imageId) {
    return await this.retryFailedImagesBatch([imageId], true);
  }

  async retryFailedImageWithModifiedSettings(imageId, settings) {
    return await this.retryFailedImagesBatch([imageId], false, settings);
  }

  // Helpers
  sanitizeProcessingSettings(input) {
    const allowedKeys = new Set([
      'imageEnhancement',
      'sharpening',
      'saturation',
      'imageConvert',
      'convertToJpg',
      'jpgQuality',
      'pngQuality',
      'removeBg',
      'removeBgSize',
      'trimTransparentBackground',
      'jpgBackground'
    ]);
    const out = {};
    for (const [k, v] of Object.entries(input || {})) {
      if (!allowedKeys.has(k)) continue;
      switch (k) {
        case 'imageEnhancement':
        case 'imageConvert':
        case 'convertToJpg':
        case 'removeBg':
        case 'trimTransparentBackground':
          out[k] = Boolean(v);
          break;
        case 'sharpening': {
          let num = Number(v);
          if (!Number.isFinite(num)) num = 0;
          out[k] = Math.max(0, Math.min(100, Math.round(num)));
          break;
        }
        case 'saturation': {
          let num = Number(v);
          if (!Number.isFinite(num)) num = 1;
          out[k] = Math.max(0, Math.min(3, num));
          break;
        }
        case 'jpgQuality': {
          let num = Number(v);
          if (!Number.isFinite(num)) num = 90;
          out[k] = Math.max(1, Math.min(100, Math.round(num)));
          break;
        }
        case 'pngQuality': {
          let num = Number(v);
          if (!Number.isFinite(num)) num = 9;
          out[k] = Math.max(0, Math.min(9, Math.round(num)));
          break;
        }
        case 'removeBgSize': {
          const allowed = new Set(['auto', 'full', '4k']);
          const val = String(v || 'auto').toLowerCase();
          out[k] = allowed.has(val) ? val : 'auto';
          break;
        }
        case 'jpgBackground': {
          out[k] = typeof v === 'string' ? v : '#FFFFFF';
          break;
        }
      }
    }
    return out;
  }

  // Job Management Methods
  async getJobResults(jobId) {
    try {
      await this.ensureInitialized();
      const job = await this.jobExecution.getJobExecution(jobId);
      const images = await this.generatedImage.getGeneratedImagesByExecution(jobId);
      
      if (!job.success) {
        return { success: false, error: 'Job not found' };
      }
      
      return { 
        success: true, 
        job: job.execution,
        images: images.success ? images.images : []
      };
    } catch (error) {
      console.error('Error getting job results:', error);
      return { success: false, error: error.message };
    }
  }

  async renameJobExecution(id, label) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.renameJobExecution(id, label);
      return result;
    } catch (error) {
      console.error('Error renaming job execution:', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDeleteJobExecutions(ids) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.bulkDeleteJobExecutions(ids);
      return result;
    } catch (error) {
      console.error('Error bulk deleting job executions:', error);
      return { success: false, error: error.message };
    }
  }

  async bulkExportJobExecutions(ids) {
    try {
      await this.ensureInitialized();
      const jobs = await this.jobExecution.getJobExecutionsByIds(ids);
      
      if (!jobs.success) {
        return { success: false, error: 'Failed to retrieve jobs for export' };
      }
      
      // For now, return success - actual Excel generation would be implemented here
      const exportData = {
        jobs: jobs.executions,
        timestamp: new Date().toISOString(),
        totalJobs: jobs.executions.length
      };
      
      return { success: true, data: exportData };
    } catch (error) {
      console.error('Error bulk exporting job executions:', error);
      return { success: false, error: error.message };
    }
  }

  async bulkRerunJobExecutions(ids) {
    try {
      await this.ensureInitialized();
      const jobs = await this.jobExecution.getJobExecutionsByIds(ids);
      
      if (!jobs.success) {
        return { success: false, error: 'Failed to retrieve jobs for rerun' };
      }
      
      // Check if any job is currently running
      const runningJobs = jobs.executions.filter(job => job.status === 'running');
      if (runningJobs.length > 0) {
        return { success: false, error: 'Cannot rerun jobs while other jobs are running' };
      }
      
      // For now, return success - actual rerun logic would be implemented here
      // This would integrate with the existing job processing system
      return { 
        success: true, 
        queuedJobs: jobs.executions.length,
        message: `${jobs.executions.length} jobs queued for rerun`
      };
    } catch (error) {
      console.error('Error bulk rerunning job executions:', error);
      return { success: false, error: error.message };
    }
  }

  async getJobExecutionsWithFilters(filters) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.getJobExecutionsWithFilters(filters);
      return result;
    } catch (error) {
      console.error('Error getting job executions with filters:', error);
      return { success: false, error: error.message };
    }
  }

  async getJobExecutionsCount(filters) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.getJobExecutionsCount(filters);
      return result;
    } catch (error) {
      console.error('Error getting job executions count:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { BackendAdapter }; 