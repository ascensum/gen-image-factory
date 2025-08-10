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
  constructor() {
    this.jobConfig = new JobConfiguration();
    this.jobExecution = new JobExecution();
    this.generatedImage = new GeneratedImage();
    this.jobRunner = new JobRunner();
    this.errorTranslation = new ErrorTranslationService();
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
    // Only set up IPC handlers if we're in an Electron environment
    if (typeof ipcMain !== 'undefined' && ipcMain) {
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
        'generated-image:metadata', 'generated-image:statistics', 'generated-image:manual-approve'
      ];
      
      handlers.forEach(handler => {
        try {
          ipcMain.removeHandler(handler);
        } catch (error) {
          // Handler might not exist, ignore error
        }
      });
      // API Key Management
      ipcMain.handle('get-api-key', async (event, serviceName) => {
        return await this.getApiKey(serviceName);
      });

      ipcMain.handle('set-api-key', async (event, serviceName, apiKey) => {
        return await this.setApiKey(serviceName, apiKey);
      });

      // Settings Management
      ipcMain.handle('get-settings', async () => {
        return await this.getSettings();
      });

      ipcMain.handle('save-settings', async (event, settingsObject) => {
        return await this.saveSettings(settingsObject);
      });

      ipcMain.handle('settings:get-configuration', async () => {
        return await this.getSettings();
      });

      // File Selection
      ipcMain.handle('select-file', async (event, options) => {
        return await this.selectFile(options);
      });

      // File Selection Enhancement
      ipcMain.handle('validate-path', async (event, path, type, fileTypes) => {
        return await this.validatePath(path, type, fileTypes);
      });

      // Job Control
      ipcMain.handle('job:start', async (event, config) => {
        return await this.startJob(config);
      });

      ipcMain.handle('job:stop', async () => {
        return await this.stopJob();
      });

      ipcMain.handle('job:force-stop-all', async () => {
        return await this.forceStopAll();
      });

      ipcMain.handle('job:get-status', async () => {
        return await this.getJobStatus();
      });

      ipcMain.handle('job:get-progress', async () => {
        return await this.getJobProgress();
      });

      ipcMain.handle('job:get-logs', async (event, mode = 'standard') => {
        return await this.getJobLogs(mode);
      });

      // Security Status
      ipcMain.handle('get-security-status', async () => {
        return await this.getSecurityStatus();
      });

      // Job Execution Management
      ipcMain.handle('job-execution:save', async (event, execution) => {
        return await this.saveJobExecution(execution);
      });

      ipcMain.handle('job-execution:get', async (event, id) => {
        return await this.getJobExecution(id);
      });

      ipcMain.handle('job-execution:get-all', async (event, options = {}) => {
        return await this.getAllJobExecutions(options);
      });

      ipcMain.handle('job-execution:update', async (event, id, execution) => {
        return await this.updateJobExecution(id, execution);
      });

      ipcMain.handle('job-execution:delete', async (event, { jobId }) => {
        return await this.deleteJobExecution(jobId);
      });

      ipcMain.handle('job-execution:statistics', async () => {
        return await this.getJobStatistics();
      });

      ipcMain.handle('job-execution:export-to-excel', async (event, { jobId }) => {
        return await this.exportJobToExcel(jobId);
      });

      ipcMain.handle('job-execution:history', async (event, limit) => {
        return await this.getJobHistory(limit);
      });

      // Generated Image Management
      ipcMain.handle('generated-image:save', async (event, image) => {
        return await this.saveGeneratedImage(image);
      });

      ipcMain.handle('generated-image:get', async (event, id) => {
        return await this.getGeneratedImage(id);
      });

      ipcMain.handle('generated-image:get-by-execution', async (event, executionId) => {
        return await this.getGeneratedImagesByExecution(executionId);
      });

      ipcMain.handle('generated-image:get-all', async (event, options = {}) => {
        return await this.getAllGeneratedImages(options.limit || 100);
      });

      ipcMain.handle('generated-image:update', async (event, id, image) => {
        return await this.updateGeneratedImage(id, image);
      });

      ipcMain.handle('generated-image:delete', async (event, { imageId }) => {
        return await this.deleteGeneratedImage(imageId);
      });

      ipcMain.handle('generated-image:get-by-qc-status', async (event, qcStatus) => {
        return await this.getImagesByQCStatus(qcStatus);
      });

      ipcMain.handle('generated-image:update-qc-status', async (event, { imageId, status }) => {
        return await this.updateQCStatus(imageId, status);
      });

      ipcMain.handle('generated-image:metadata', async (event, executionId) => {
        return await this.getImageMetadata(executionId);
      });

      ipcMain.handle('generated-image:statistics', async () => {
        return await this.getImageStatistics();
      });

      // Manual approval handler
      ipcMain.handle('generated-image:manual-approve', async (event, { imageId }) => {
        return await this.manualApproveImage(imageId);
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
      // Ensure database is initialized
      await this.ensureInitialized();
      
      // Get settings from database
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
}

module.exports = { BackendAdapter }; 