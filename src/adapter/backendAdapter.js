const keytar = require('keytar');
const { ipcMain } = require('electron');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { JobConfiguration } = require('../database/models/JobConfiguration');
const { JobExecution } = require('../database/models/JobExecution');
const { GeneratedImage } = require('../database/models/GeneratedImage');
const { JobRunner } = require('../services/jobRunner');
const RetryExecutor = require('../services/retryExecutor');
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
    
    // Check if there's already a global backendAdapter and reuse its JobRunner
    if (global.backendAdapter && global.backendAdapter.jobRunner) {
      console.log('🔄 Reusing existing JobRunner from global backendAdapter');
      this.jobRunner = global.backendAdapter.jobRunner;
    } else if (options.existingJobRunner) {
      console.log('🔄 Using passed existing JobRunner');
      this.jobRunner = options.existingJobRunner;
    } else {
      console.log('🆕 Creating new JobRunner instance');
      this.jobRunner = new JobRunner();
    }
    
    this.errorTranslation = new ErrorTranslationService();
    this.ipc = options.ipc || (typeof ipcMain !== 'undefined' ? ipcMain : undefined);
    this.mainWindow = options.mainWindow || null;
    
    // Only setup IPC handlers if not explicitly skipped
    if (!options.skipIpcSetup) {
      this.setupIpcHandlers();
      this.setupJobEventListeners();
    }
    
    // Store the options for later use
    this._constructorOptions = options;
  }

  /**
   * Set the main window reference for sending events to renderer
   * @param {BrowserWindow} mainWindow - Electron main window instance
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
    console.log('🔧 BackendAdapter: MainWindow reference set for event sending');
    
    // Initialize RetryExecutor when mainWindow is available
    this.initializeRetryExecutor();
  }

  /**
   * Initialize RetryExecutor for handling retry operations
   */
  async initializeRetryExecutor() {
    try {
      console.log('🔧 BackendAdapter: Initializing RetryExecutor...');
      
      // Ensure settings are loaded before creating RetryExecutor
      if (!this.settings) {
        try {
          console.log('🔧 BackendAdapter: Loading settings for RetryExecutor...');
          const settingsResult = await this.getSettings();
          this.settings = settingsResult.settings || {};
          console.log('🔧 BackendAdapter: Settings loaded with keys:', Object.keys(this.settings));
        } catch (error) {
          console.warn('🔧 BackendAdapter: Failed to load settings for RetryExecutor, using defaults:', error.message);
          this.settings = {};
        }
      }
      
      // Use the same logic as JobConfiguration.getDefaultSettings()
      let tempDir, outputDir;
      try {
        const { app } = require('electron');
        const desktopPath = app.getPath('desktop');
        tempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'generated');
        outputDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
      } catch (error) {
        const os = require('os');
        const homeDir = os.homedir();
        tempDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'generated');
        outputDir = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'toupload');
      }
      
      // Override with user settings if available
      tempDir = this.settings?.filePaths?.tempDirectory || tempDir;
      outputDir = this.settings?.filePaths?.outputDirectory || outputDir;
      console.log('🔧 BackendAdapter: Creating RetryExecutor with tempDirectory:', tempDir, 'outputDirectory:', outputDir);
      
      try {
        this.retryExecutor = new RetryExecutor({
          tempDirectory: tempDir,
          outputDirectory: outputDir,
          generatedImage: this.generatedImage
        });
        console.log('🔧 BackendAdapter: RetryExecutor created successfully');
        
        // Set up event listeners for progress tracking
        if (this.retryExecutor && typeof this.retryExecutor.on === 'function' && this.mainWindow) {
          this.setupRetryExecutorEventListeners();
        }
      } catch (error) {
        console.error('🔧 BackendAdapter: Failed to create RetryExecutor:', error);
        // Don't throw error, just log it and continue without retry functionality
        console.warn('🔧 BackendAdapter: Retry functionality will be disabled due to initialization failure');
        this.retryExecutor = null;
      }
    } catch (error) {
      console.error('🔧 BackendAdapter: Error during RetryExecutor initialization:', error);
      this.retryExecutor = null;
    }
  }

  /**
   * Set up event listeners for RetryExecutor progress tracking
   */
  setupRetryExecutorEventListeners() {
    if (!this.retryExecutor || !this.mainWindow) return;
    
    try {
      this.retryExecutor.on('progress', (data) => {
        // Send progress event to frontend via mainWindow
        try {
          if (this.mainWindow && this.mainWindow.webContents && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('retry-progress', {
              ...data,
              context: 'retry'
            });
          }
        } catch (error) {
          console.warn('🔧 BackendAdapter: Failed to send retry-progress event to frontend:', error.message);
        }
        console.log('🔧 BackendAdapter: RetryExecutor progress event:', data);
      });

      this.retryExecutor.on('job-completed', (data) => {
        // Send completion event to frontend via mainWindow
        try {
          if (this.mainWindow && this.mainWindow.webContents && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('retry-completed', {
              ...data,
              context: 'retry'
            });
          }
        } catch (error) {
          console.warn('🔧 BackendAdapter: Failed to send retry-completed event to frontend:', error.message);
        }
        console.log('🔧 BackendAdapter: RetryExecutor job completed:', data);
      });

      this.retryExecutor.on('job-error', (data) => {
        // Send error event to frontend via mainWindow
        try {
          if (this.mainWindow && this.mainWindow.webContents && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('retry-error', {
              ...data,
              context: 'retry'
            });
          }
        } catch (error) {
          console.warn('🔧 BackendAdapter: Failed to send retry-error event to frontend:', error.message);
        }
        console.log('🔧 BackendAdapter: RetryExecutor job error:', data);
      });

      this.retryExecutor.on('queue-updated', (data) => {
        // Send queue update event to frontend via mainWindow
        try {
          if (this.mainWindow && this.mainWindow.webContents && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('retry-queue-updated', {
              ...data,
              context: 'retry'
            });
          }
        } catch (error) {
          console.warn('🔧 BackendAdapter: Failed to send retry-queue-updated event to frontend:', error.message);
        }
        console.log('🔧 BackendAdapter: RetryExecutor queue updated:', data);
      });

      this.retryExecutor.on('job-status-updated', (data) => {
        // Send status update event to frontend via mainWindow
        try {
          if (this.mainWindow && this.mainWindow.webContents && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('retry-status-updated', {
              ...data,
              context: 'retry'
            });
          }
        } catch (error) {
          console.warn('🔧 BackendAdapter: Failed to send retry-status-updated event to frontend:', error.message);
        }
        console.log('🔧 BackendAdapter: RetryExecutor status updated:', data);
      });
      
      console.log('🔧 BackendAdapter: RetryExecutor event listeners set up successfully');
    } catch (error) {
      console.error('🔧 BackendAdapter: Error setting up RetryExecutor event listeners:', error);
    }
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

    // Ensure required tables exist to avoid race conditions on first access
    if (this.jobConfig && this.jobConfig.createTables) {
      try { await this.jobConfig.createTables(); } catch (e) {}
    }
    if (this.jobExecution && this.jobExecution.createTables) {
      try { await this.jobExecution.createTables(); } catch (e) {}
    }
    if (this.generatedImage && this.generatedImage.createTables) {
      try { await this.generatedImage.createTables(); } catch (e) {}
    }
  }

  setupIpcHandlers() {
    console.log('🔧 BackendAdapter.setupIpcHandlers() called');
    console.log('🔧 this.ipc type:', typeof this.ipc);
    console.log('🔧 ipcMain available:', typeof ipcMain !== 'undefined');
    
    // Only set up IPC handlers if we have an IPC interface (electron main or injected)
    const _ipc = this.ipc;
    
    // If no IPC interface in constructor, try to get it from global scope (for main.js usage)
    if (!_ipc && typeof ipcMain !== 'undefined') {
      this.ipc = ipcMain;
      console.log('🔧 BackendAdapter: Using ipcMain from global scope');
    }
    
    if (typeof this.ipc !== 'undefined' && this.ipc) {
      // Remove existing handlers to prevent duplicates
      const handlers = [
        'get-api-key', 'set-api-key', 'get-settings', 'save-settings', 'settings:get-configuration',
        'select-file', 'validate-path', 'job:start', 'job:stop', 'job:force-stop', 'job:force-stop-all',
        'job:get-status', 'job:get-progress', 'job:get-logs', 'get-security-status',
        'job-execution:save', 'job-execution:get', 'job-execution:get-all', 'job-execution:update',
        'job-execution:delete', 'job-execution:statistics', 'job-execution:export-to-excel',
        'job-execution:history', 'generated-image:save', 'generated-image:get',
        'generated-image:get-by-execution', 'generated-image:get-all', 'generated-image:update',
        'generated-image:delete', 'generated-image:get-by-qc-status', 'generated-image:update-qc-status', 'generated-image:update-qc-status-by-mapping',
        'generated-image:metadata', 'generated-image:statistics', 'generated-image:manual-approve',
        'failed-image:retry-original', 'failed-image:retry-modified', 'failed-image:retry-batch',
        'get-job-history', 'get-job-results', 'delete-job-execution', 'export-job-to-excel',
        'job-execution:rename', 'job-execution:bulk-delete', 'job-execution:bulk-export', 'job-execution:bulk-rerun',
        'job-execution:calculate-statistics', 'job-execution:update-statistics',
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

      _ipc.handle('job-configuration:update-name', async (event, id, newName) => {
        return await this.updateJobConfigurationName(id, newName);
      });

      _ipc.handle('open-exports-folder', async () => {
        return await this.openExportsFolder();
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
        console.log('🚨 IPC HANDLER: job:start called with config keys:', Object.keys(config));
        console.log('🚨 IPC HANDLER: About to call this.startJob...');
        console.log('🚨 IPC HANDLER: Stack trace:', new Error().stack);
        const result = await this.startJob(config);
        console.log('🚨 IPC HANDLER: this.startJob returned:', result);
        return result;
      });

      _ipc.handle('job:stop', async () => {
        return await this.stopJob();
      });

      _ipc.handle('job:force-stop', async () => {
        return await this.forceStopAll();
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

      _ipc.handle('job-execution:calculate-statistics', async (event, executionId) => {
        return await this.calculateJobExecutionStatistics(executionId);
      });

      _ipc.handle('job-execution:update-statistics', async (event, executionId) => {
        return await this.updateJobExecutionStatistics(executionId);
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

      _ipc.handle('generated-image:update-qc-status-by-mapping', async (event, { mappingId, status, reason }) => {
        return await this.updateQCStatusByMappingId(mappingId, status, reason);
      });

      _ipc.handle('generated-image:update-by-mapping', async (event, { mappingId, image }) => {
        return await this.updateGeneratedImageByMappingId(mappingId, image);
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

      // Removed duplicate export handler - all exports now go through job-execution:export-to-excel

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

      _ipc.handle('job-execution:process-next-bulk-rerun', async (event) => {
        return await this.processNextBulkRerunJob();
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
        // Global counter to track rerun calls
        if (!global.rerunCallCount) global.rerunCallCount = 0;
        global.rerunCallCount++;
        
        console.log('🚨 DEBUG RERUN: IPC handler called with id:', id);
        console.log('🚨 DEBUG RERUN: Event source:', event.sender?.id);
        console.log('🚨 DEBUG RERUN: Current timestamp:', new Date().toISOString());
        console.log('🚨 DEBUG RERUN: Stack trace:', new Error().stack);
        console.log('🚨 DEBUG RERUN: Global call count:', global.rerunCallCount);
        console.log('🚨 DEBUG RERUN: Process ID:', process.pid);
        console.log('🚨 DEBUG RERUN: Memory usage:', process.memoryUsage());
        
        try {
          await this.ensureInitialized();
          
          // Get the job execution with its CURRENT configuration (not the old one)
          const jobData = await this.jobExecution.getJobExecution(id);
          
          if (!jobData.success) {
            return { success: false, error: 'Job execution not found' };
          }
          
          // Check if the job has a configuration BEFORE trying to rerun
          if (!jobData.execution.configurationId) {
            return { 
              success: false, 
              error: 'Job has no configuration. Cannot rerun jobs started from Dashboard without saved settings.' 
            };
          }
          
          // Get the CURRENT configuration from the database
          const configResult = await this.jobConfig.getConfigurationById(jobData.execution.configurationId);
          
          if (!configResult.success || !configResult.configuration || !configResult.configuration.settings) {
            return { 
              success: false, 
              error: 'Job configuration not found or invalid. Cannot rerun without valid settings.' 
            };
          }
          
          // Check if another job is currently running
          const currentStatus = await this.jobRunner.getJobStatus();
          if (currentStatus.status === 'running') {
            return { 
              success: false, 
              error: 'Another job is currently running. Please wait for it to complete.' 
            };
          }
          
          // Create a new job execution record FIRST (before starting the job)
          const newExecutionData = {
            configurationId: jobData.execution.configurationId,
            label: jobData.execution.label ? `${jobData.execution.label} (Rerun)` : 'Rerun Job',
            status: 'running'
          };
          
          const newExecution = await this.jobExecution.saveJobExecution(newExecutionData);
          
          if (!newExecution.success) {
            return { 
              success: false, 
              error: 'Failed to create job execution record' 
            };
          }
          
          // Start the job with the CURRENT configuration (respects user changes)
          // Use the main JobRunner for reruns to ensure proper UI integration and progress tracking
          this.jobRunner.configurationId = jobData.execution.configurationId;
          this.jobRunner.databaseExecutionId = newExecution.id; // Set the execution ID for database operations
          this.jobRunner.isRerun = true; // Set rerun flag to prevent duplicate database saves
          
          const jobResult = await this.jobRunner.startJob(configResult.configuration.settings);
          
          if (jobResult.success) {
            return { 
              success: true, 
              message: 'Job rerun started successfully',
              jobId: jobResult.jobId,
              originalJobId: id,
              newExecutionId: newExecution.id
            };
          } else {
            // If the job failed to start, update the execution record to failed
            await this.jobExecution.updateJobExecution(newExecution.id, { status: 'failed' });
            return { 
              success: false, 
              error: `Failed to start job rerun: ${jobResult.error}` 
            };
          }
          
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

  async updateJobConfigurationName(id, newName) {
    try {
      await this.ensureInitialized();
      const result = await this.jobConfig.updateConfigurationName(id, newName);
      return result;
    } catch (error) {
      console.error('Error updating job configuration name:', error);
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
      console.log('🚨 METHOD ENTRY: backendAdapter.startJob method entered!');
      console.log('🔧 backendAdapter.startJob called with config keys:', Object.keys(config));
      console.log('🔧 DEBUG - filePaths in config:', JSON.stringify(config.filePaths, null, 2));
      
      // Prevent multiple simultaneous job executions
      if (this.jobRunner && this.jobRunner.isRunning) {
        console.log('⚠️ Job is already running, ignoring duplicate start request');
        return { success: false, error: 'Job is already running' };
      }
      
      // Normalize file paths before saving - use custom paths if set, otherwise use fallback paths
      const normalizedConfig = { ...config };
      if (normalizedConfig.filePaths) {
        const defaultSettings = this.jobConfig.getDefaultSettings();
        const defaultFilePaths = defaultSettings.filePaths;
        
        // Use custom paths if they exist and are not empty, otherwise use fallback paths
        normalizedConfig.filePaths = {
          ...normalizedConfig.filePaths,
          outputDirectory: normalizedConfig.filePaths.outputDirectory && normalizedConfig.filePaths.outputDirectory.trim() !== '' 
            ? normalizedConfig.filePaths.outputDirectory 
            : defaultFilePaths.outputDirectory,
          tempDirectory: normalizedConfig.filePaths.tempDirectory && normalizedConfig.filePaths.tempDirectory.trim() !== '' 
            ? normalizedConfig.filePaths.tempDirectory 
            : defaultFilePaths.tempDirectory
        };
        
        console.log('🔧 DEBUG - Normalized filePaths:', JSON.stringify(normalizedConfig.filePaths, null, 2));
      }
      
      // Save the normalized job configuration first so it can be retrieved later
      console.log('💾 Saving normalized job configuration for future retrieval...');
      const configResult = await this.jobConfig.saveSettings(normalizedConfig, `job_${Date.now()}`);
      console.log('💾 Configuration saved with ID:', configResult.id);
      
      // Create a NEW JobRunner instance for each job to prevent state conflicts
      console.log('🆕 Creating new JobRunner instance for this job');
      const { JobRunner } = require('../services/jobRunner');
      const jobRunner = new JobRunner();
      
      // Set the backendAdapter reference
      jobRunner.backendAdapter = this;
      
      // Pass the configuration ID to the JobRunner so it can link the job execution
      jobRunner.configurationId = configResult.id;
      
      console.log('🔧 jobRunner instance:', jobRunner);
      console.log('🔧 jobRunner.startJob method type:', typeof jobRunner.startJob);
      
      if (!jobRunner || typeof jobRunner.startJob !== 'function') {
        throw new Error('JobRunner not properly initialized');
      }
      
      console.log('🔧 About to call jobRunner.startJob with normalized config keys:', Object.keys(normalizedConfig));
      const result = await jobRunner.startJob(normalizedConfig);
      console.log('✅ backendAdapter.startJob result:', result);
      
      // Store the new jobRunner instance for status queries
      this.jobRunner = jobRunner;
      
      return result;
    } catch (error) {
      console.error('❌ Error starting job in backendAdapter:', error);
      console.error('❌ Error stack:', error.stack);
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
      console.log('🔍 getJobStatus - Raw status from jobRunner:', status);
      console.log('🔍 getJobStatus - status.state:', status.state);
      console.log('🔍 getJobStatus - status.currentJob:', status.currentJob);
      
      const result = {
        state: status.state || 'idle',
        currentJob: status.currentJob || null,
        progress: status.progress || 0,
        currentStep: status.currentStep || 0,
        totalSteps: status.totalSteps || 0,
        startTime: status.startTime || null,
        estimatedTimeRemaining: status.estimatedTimeRemaining || null
      };
      
      console.log('🔍 getJobStatus - Returning result:', result);
      return result;
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

  async calculateJobExecutionStatistics(executionId) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.calculateJobExecutionStatistics(executionId);
      return result;
    } catch (error) {
      console.error('Error calculating job execution statistics:', error);
      return { success: false, error: error.message };
    }
  }

  async updateJobExecutionStatistics(executionId) {
    try {
      await this.ensureInitialized();
      const result = await this.jobExecution.updateJobExecutionStatistics(executionId);
      return result;
    } catch (error) {
      console.error('Error updating job execution statistics:', error);
      return { success: false, error: error.message };
    }
  }

  async exportJobToExcel(jobId) {
    try {
      await this.ensureInitialized();
      
      // Get job execution details
      const jobResult = await this.jobExecution.getJobExecution(jobId);
      if (!jobResult.success) {
        return { success: false, error: 'Failed to get job execution' };
      }
      
      const job = jobResult.execution;
      
      // Get generated images for this job
      const imagesResult = await this.generatedImage.getGeneratedImagesByExecution(jobId);
      const images = imagesResult.success ? imagesResult.images || [] : [];
      
      // Get job configuration if available
      let jobConfig = null;
      if (job.configurationId) {
        try {
          const configResult = await this.jobConfig.getConfigurationById(job.configurationId);
          if (configResult.success) {
            jobConfig = configResult.configuration;
          }
        } catch (error) {
          console.warn('Could not load job configuration:', error);
        }
      }
      
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Job Summary Sheet - Use classic table format (fields as headers, values below)
      const jobSummaryData = [
        ['Job ID', 'Label', 'Status', 'Started At', 'Completed At', 'Total Images', 'Successful Images', 'Failed Images', 'Error Message', 'Configuration ID'],
        [
          job.id,
          job.label || 'No label',
          job.status,
          job.startedAt ? new Date(job.startedAt).toLocaleString() : 'N/A',
          job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A',
          job.totalImages || 0,
          job.successfulImages || 0,
          job.failedImages || 0,
          job.errorMessage || 'None',
          job.configurationId || 'None'
        ]
      ];
      
      if (jobConfig) {
        // Add configuration meta info to the first row headers
        jobSummaryData[0].push('Configuration Name', 'Created At', 'Updated At');
        jobSummaryData[1].push(
          jobConfig.name || 'Unknown',
          jobConfig.createdAt ? new Date(jobConfig.createdAt).toLocaleString() : 'N/A',
          jobConfig.updatedAt ? new Date(jobConfig.updatedAt).toLocaleString() : 'N/A'
        );
      }

      // Merge settings into the same Job Summary sheet (no separate sheet)
      if (jobConfig && jobConfig.settings) {
        const formatSettingLabel = (key) => {
          const mapping = {
            'parameters.processMode': 'Process Mode',
            'parameters.aspectRatios': 'Aspect Ratios',
            'parameters.mjVersion': 'MJ Version',
            'parameters.openaiModel': 'OpenAI Model',
            'parameters.enablePollingTimeout': 'Enable Polling Timeout',
            'parameters.pollingTimeout': 'Polling Timeout (seconds)',
            'parameters.keywordRandom': 'Keyword Random',
            'processing.removeBg': 'Remove Background',
            'processing.imageConvert': 'Image Convert',
            'processing.imageEnhancement': 'Image Enhancement',
            'processing.sharpening': 'Sharpening Intensity (0-10)',
            'processing.saturation': 'Saturation Level (0-2)',
            'processing.convertToJpg': 'Convert to JPG',
            'processing.trimTransparentBackground': 'Trim Transparent Background',
            'processing.jpgBackground': 'JPG Background',
            'processing.jpgQuality': 'JPG Quality',
            'processing.pngQuality': 'PNG Quality',
            'processing.removeBgSize': 'Remove.bg Size',
            'filePaths.outputDirectory': 'Output Directory',
            'filePaths.tempDirectory': 'Temp Directory',
            'filePaths.systemPromptFile': 'System Prompt File',
            'filePaths.keywordsFile': 'Keywords File',
            'filePaths.qualityCheckPromptFile': 'Quality Check Prompt File',
            'filePaths.metadataPromptFile': 'Metadata Prompt File',
            'ai.runQualityCheck': 'Run Quality Check',
            'ai.runMetadataGen': 'Run Metadata Generation',
            'advanced.debugMode': 'Debug Mode'
          };
          if (mapping[key]) return mapping[key];
          const last = key.split('.').pop();
          return last
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (c) => c.toUpperCase());
        };
        const flattenSettings = (obj, prefix = '') => {
          const result = [];
          for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              result.push(...flattenSettings(value, fullKey));
            } else {
              result.push([fullKey, value]);
            }
          }
          return result;
        };

        const flattenedSettings = flattenSettings(jobConfig.settings)
          .filter(([key]) => !key.startsWith('apiKeys.'));
        flattenedSettings.forEach(([key, value]) => {
          jobSummaryData[0].push(formatSettingLabel(key));
          jobSummaryData[1].push(value);
        });
      }
      
      const jobSummarySheet = XLSX.utils.aoa_to_sheet(jobSummaryData);
      XLSX.utils.book_append_sheet(workbook, jobSummarySheet, 'Job Summary');
      
      // Images Sheet
      if (images.length > 0) {
        const imagesData = [
          ['Image ID', 'Execution ID', 'Generation Prompt', 'Seed', 'QC Status', 'QC Reason', 'Final Image Path', 'Created At']
        ];
        
        images.forEach(image => {
          imagesData.push([
            image.id,
            image.executionId,
            image.generationPrompt || 'N/A',
            image.seed || 'N/A',
            image.qcStatus || 'N/A',
            image.qcReason || 'N/A',
            image.finalImagePath || 'N/A',
            image.createdAt ? new Date(image.createdAt).toLocaleString() : 'N/A'
          ]);
        });
        
        const imagesSheet = XLSX.utils.aoa_to_sheet(imagesData);
        XLSX.utils.book_append_sheet(workbook, imagesSheet, 'Images');
      }
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const jobLabel = job.label && job.label.trim() !== '' ? job.label.replace(/[^a-zA-Z0-9]/g, '_') : 'Job';
      const filename = `${jobLabel}_${job.id}_${timestamp}.xlsx`;
      
      // Create export directory in user's app data folder (works in both dev and production)
      const electronMod = require('electron');
      const app = electronMod && electronMod.app ? electronMod.app : undefined;
      const exportDir = app && typeof app.getPath === 'function'
        ? path.join(app.getPath('userData'), 'exports')
        : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      const filePath = path.join(exportDir, filename);
      
      // Write Excel file
      XLSX.writeFile(workbook, filePath);
      
      // Ensure file is fully written to disk
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify file exists and has content
      if (!fs.existsSync(filePath)) {
        throw new Error('Export file was not created successfully');
      }
      
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('Export file is empty');
      }
      
      console.log('Excel export created successfully:', filePath);
      
      return { 
        success: true, 
        filePath: filePath,
        filename: filename,
        message: `Export created successfully: ${filename}`
      };
      
    } catch (error) {
      console.error('Error exporting job to Excel:', error);
      return { success: false, error: error.message };
    }
  }

  async getJobConfigurationForImage(imageId) {
    try {
      // Get the image data to find the execution ID
      const imageData = await this.generatedImage.getGeneratedImage(imageId);
      if (!imageData.success) {
        return null;
      }
      
      const image = imageData.image;
      
      // Get the job execution to find the configuration ID
      const jobExecutionData = await this.jobExecution.getJobExecution(image.executionId);
      if (!jobExecutionData.success) {
        return null;
      }
      
      const jobExecution = jobExecutionData.execution;
      
      // Get the job configuration
      const jobConfigData = await this.jobConfig.getConfiguration(jobExecution.configurationId);
      if (!jobConfigData.success) {
        return null;
      }
      
      return jobConfigData.configuration;
    } catch (error) {
      console.error('Error getting job configuration for image:', error);
      return null;
    }
  }

  async manualApproveImage(imageId) {
    try {
      await this.ensureInitialized();
      
      // Get the image data first
      const imageData = await this.generatedImage.getGeneratedImage(imageId);
      if (!imageData.success) {
        throw new Error(`Failed to get image data for ID ${imageId}`);
      }
      
      const image = imageData.image;
      
      // Check if image has tempImagePath (should be moved to final location)
      if (image.tempImagePath && !image.finalImagePath) {
        console.log(`🔧 manualApproveImage: Moving image from temp to final location`);
        
        // Get the original job configuration to determine correct output directory
        const jobConfig = await this.getJobConfigurationForImage(imageId);
        let outputDirectory;
        
        if (jobConfig && jobConfig.settings && jobConfig.settings.filePaths) {
          outputDirectory = jobConfig.settings.filePaths.outputDirectory;
          console.log(`🔧 manualApproveImage: Using custom outputDirectory: ${outputDirectory}`);
        } else {
          // Use fallback path
          try {
            const { app } = require('electron');
            const desktopPath = app.getPath('desktop');
            outputDirectory = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
            console.log(`🔧 manualApproveImage: Using fallback Desktop path: ${outputDirectory}`);
          } catch (error) {
            const os = require('os');
            const homeDir = os.homedir();
            outputDirectory = path.join(homeDir, 'Documents', 'gen-image-factory', 'pictures', 'toupload');
            console.log(`🔧 manualApproveImage: Using fallback Documents path: ${outputDirectory}`);
          }
        }
        
        // Ensure output directory exists
        await fs.mkdir(outputDirectory, { recursive: true });
        
        // Generate final filename
        const sourceFileName = path.basename(image.tempImagePath);
        const finalImagePath = path.join(outputDirectory, sourceFileName);
        
        // Move the file from temp to final location
        await fs.rename(image.tempImagePath, finalImagePath);
        console.log(`🔧 manualApproveImage: Successfully moved image to: ${finalImagePath}`);
        
        // Update database with final path and clear temp path
        await this.generatedImage.updateGeneratedImage(imageId, {
          finalImagePath: finalImagePath,
          tempImagePath: null
        });
        
        console.log(`🔧 manualApproveImage: Updated database with final path`);
      }
      
      // Update QC status to approved
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

  async updateQCStatusByMappingId(mappingId, qcStatus, qcReason = null) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.updateQCStatusByMappingId(mappingId, qcStatus, qcReason);
      return result;
    } catch (error) {
      console.error('Error updating QC status by mapping ID:', error);
      return { success: false, error: error.message };
    }
  }

  async updateGeneratedImageByMappingId(mappingId, image) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.updateGeneratedImageByMappingId(mappingId, image);
      return result;
    } catch (error) {
      console.error('Error updating generated image by mapping ID:', error);
      return { success: false, error: error.message };
    }
  }

  async updateImagePathsByMappingId(mappingId, tempImagePath, finalImagePath) {
    try {
      await this.ensureInitialized();
      const result = await this.generatedImage.updateImagePathsByMappingId(mappingId, tempImagePath, finalImagePath);
      return result;
    } catch (error) {
      console.error('Error updating image paths by mapping ID:', error);
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
      console.log('🔧 BackendAdapter: retryFailedImagesBatch called');
      console.log('🔧 BackendAdapter: imageIds:', imageIds);
      console.log('🔧 BackendAdapter: useOriginalSettings:', useOriginalSettings);
      console.log('🔧 BackendAdapter: modifiedSettings keys:', modifiedSettings ? Object.keys(modifiedSettings) : 'null');
      console.log('🔧 BackendAdapter: includeMetadata:', includeMetadata);
      
      await this.ensureInitialized();
      
      // Ensure RetryExecutor is initialized for retry operations
      await this.ensureRetryExecutorInitialized();
      
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
      
      console.log('🔧 BackendAdapter: sanitizedSettings keys:', sanitizedSettings ? Object.keys(sanitizedSettings) : 'null');

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
        console.log('🔧 BackendAdapter: Updating processing settings for images with sanitized settings');
        const settingsUpdatePromises = images.map(image => {
          // Preserve the retry_pending status set above and attach modified processing settings
          image.qcStatus = 'retry_pending';
          image.qcReason = 'Retry with modified settings';
          image.processingSettings = { ...sanitizedSettings };
          console.log(`🔧 BackendAdapter: Updating image ${image.id} with settings keys:`, Object.keys(image.processingSettings));
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
        useOriginalSettings,
        modifiedSettings: sanitizedSettings,
        includeMetadata,
        createdAt: new Date(),
        status: 'pending'
      };
      
      console.log('🔧 BackendAdapter: Created batch retry job with keys:', Object.keys(batchRetryJob));

      // Add the batch retry job to the executor
      let queuedJob;
      try {
        if (this.retryExecutor && typeof this.retryExecutor.addBatchRetryJob === 'function') {
          console.log('🔧 BackendAdapter: Adding batch retry job to RetryExecutor');
          queuedJob = await this.retryExecutor.addBatchRetryJob(batchRetryJob);
          console.log('🔧 BackendAdapter: Job queued successfully with keys:', Object.keys(queuedJob));
        } else {
          // Fallback for test environment or when RetryExecutor is not available
          console.log('🔧 BackendAdapter: RetryExecutor not available, using fallback');
          queuedJob = {
            ...batchRetryJob,
            id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'pending'
          };
        }
      } catch (error) {
        console.error('🔧 BackendAdapter: Error adding batch retry job to executor:', error);
        // Create a fallback job if the executor fails
        queuedJob = {
          ...batchRetryJob,
          id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'failed',
          error: error.message
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
   * Ensure RetryExecutor is initialized for retry operations
   */
  async ensureRetryExecutorInitialized() {
    if (!this.retryExecutor) {
      console.log('🔧 BackendAdapter: RetryExecutor not initialized, attempting to initialize...');
      await this.initializeRetryExecutor();
    }
    return this.retryExecutor !== null;
  }

  /**
   * Get retry queue status
   * @returns {Object} Queue status information
   */
  async getRetryQueueStatus() {
    try {
      await this.ensureRetryExecutorInitialized();
      
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
      
      if (jobs.executions.length === 0) {
        return { success: false, error: 'No jobs found for export' };
      }
      
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Prepare export directory
      const electronMod = require('electron');
      const app = electronMod && electronMod.app ? electronMod.app : undefined;
      const exportDir = app && typeof app.getPath === 'function'
        ? path.join(app.getPath('userData'), 'exports')
        : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const zipFilename = `bulk_export_${timestamp}.zip`;
      const zipPath = path.join(exportDir, zipFilename);
      const output = fs.createWriteStream(zipPath);
      archive.pipe(output);
      
      const exportedFiles = [];
      
      for (const job of jobs.executions) {
        try {
          // Get job execution details
          const jobData = job;
          
          // Get generated images for this job
          const imagesResult = await this.generatedImage.getGeneratedImagesByExecution(job.id);
          const images = imagesResult.success ? imagesResult.images || [] : [];
          
          // Get job configuration if available
          let jobConfig = null;
          if (jobData.configurationId) {
            try {
              const configResult = await this.jobConfig.getConfigurationById(jobData.configurationId);
              if (configResult.success) {
                jobConfig = configResult.configuration;
              }
            } catch (error) {
              console.warn('Could not load job configuration:', error);
            }
          }
          
          // Create Excel workbook
          const workbook = XLSX.utils.book_new();
          
          // Job Summary Sheet - Use classic table format
          const jobSummaryData = [
            ['Job ID', 'Label', 'Status', 'Started At', 'Completed At', 'Total Images', 'Successful Images', 'Failed Images', 'Error Message', 'Configuration ID'],
            [
              jobData.id,
              jobData.label || 'No label',
              jobData.status,
              jobData.startedAt ? new Date(jobData.startedAt).toLocaleString() : 'N/A',
              jobData.completedAt ? new Date(jobData.completedAt).toLocaleString() : 'N/A',
              jobData.totalImages || 0,
              jobData.successfulImages || 0,
              jobData.failedImages || 0,
              jobData.errorMessage || 'None',
              jobData.configurationId || 'None'
            ]
          ];

          if (jobConfig) {
            jobSummaryData[0].push('Configuration Name', 'Created At', 'Updated At');
            jobSummaryData[1].push(
              jobConfig.name || 'Unknown',
              jobConfig.createdAt ? new Date(jobConfig.createdAt).toLocaleString() : 'N/A',
              jobConfig.updatedAt ? new Date(jobConfig.updatedAt).toLocaleString() : 'N/A'
            );
          }

          // Merge settings into the same Job Summary sheet (no separate sheet)
          if (jobConfig && jobConfig.settings) {
            const formatSettingLabel = (key) => {
              const mapping = {
                'parameters.processMode': 'Process Mode',
                'parameters.aspectRatios': 'Aspect Ratios',
                'parameters.mjVersion': 'MJ Version',
                'parameters.openaiModel': 'OpenAI Model',
                'parameters.enablePollingTimeout': 'Enable Polling Timeout',
                'parameters.pollingTimeout': 'Polling Timeout (seconds)',
                'parameters.keywordRandom': 'Keyword Random',
                'processing.removeBg': 'Remove Background',
                'processing.imageConvert': 'Image Convert',
                'processing.imageEnhancement': 'Image Enhancement',
                'processing.sharpening': 'Sharpening Intensity (0-10)',
                'processing.saturation': 'Saturation Level (0-2)',
                'processing.convertToJpg': 'Convert to JPG',
                'processing.trimTransparentBackground': 'Trim Transparent Background',
                'processing.jpgBackground': 'JPG Background',
                'processing.jpgQuality': 'JPG Quality',
                'processing.pngQuality': 'PNG Quality',
                'processing.removeBgSize': 'Remove.bg Size',
                'filePaths.outputDirectory': 'Output Directory',
                'filePaths.tempDirectory': 'Temp Directory',
                'filePaths.systemPromptFile': 'System Prompt File',
                'filePaths.keywordsFile': 'Keywords File',
                'filePaths.qualityCheckPromptFile': 'Quality Check Prompt File',
                'filePaths.metadataPromptFile': 'Metadata Prompt File',
                'ai.runQualityCheck': 'Run Quality Check',
                'ai.runMetadataGen': 'Run Metadata Generation',
                'advanced.debugMode': 'Debug Mode'
              };
              if (mapping[key]) return mapping[key];
              const last = key.split('.').pop();
              return last
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (c) => c.toUpperCase());
            };
            const flattenSettings = (obj, prefix = '') => {
              const result = [];
              for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  result.push(...flattenSettings(value, fullKey));
                } else {
                  result.push([fullKey, value]);
                }
              }
              return result;
            };

            const flattenedSettings = flattenSettings(jobConfig.settings)
              .filter(([key]) => !key.startsWith('apiKeys.'));
            flattenedSettings.forEach(([key, value]) => {
              jobSummaryData[0].push(formatSettingLabel(key));
              jobSummaryData[1].push(value);
            });
          }
          
          const jobSummarySheet = XLSX.utils.aoa_to_sheet(jobSummaryData);
          XLSX.utils.book_append_sheet(workbook, jobSummarySheet, 'Job Summary');
          
          // Images Sheet
          if (images.length > 0) {
            const imagesData = [
              ['Image ID', 'Execution ID', 'Generation Prompt', 'Seed', 'QC Status', 'QC Reason', 'Final Image Path', 'Created At']
            ];
            
            images.forEach(image => {
              imagesData.push([
                image.id,
                image.executionId,
                image.generationPrompt || 'N/A',
                image.seed || 'N/A',
                image.qcStatus || 'N/A',
                image.qcReason || 'N/A',
                image.finalImagePath || 'N/A',
                image.createdAt ? new Date(image.createdAt).toLocaleString() : 'N/A'
              ]);
            });
            
            const imagesSheet = XLSX.utils.aoa_to_sheet(imagesData);
            XLSX.utils.book_append_sheet(workbook, imagesSheet, 'Images');
          }
          
          // Generate filename for this job
          const jobLabel = jobData.label && jobData.label.trim() !== '' ? jobData.label.replace(/[^a-zA-Z0-9]/g, '_') : 'Job';
          const filename = `${jobLabel}_${jobData.id}_${timestamp}.xlsx`;
          
          // Convert workbook to buffer and add to ZIP
          const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          archive.append(excelBuffer, { name: filename });
          
          exportedFiles.push({
            jobId: jobData.id,
            label: jobData.label || 'No label',
            filename: filename
          });
        } catch (error) {
          console.warn(`Error exporting job ${job.id}:`, error);
        }
      }
      
      if (exportedFiles.length === 0) {
        return { success: false, error: 'Failed to export any jobs' };
      }
      
      // Add a summary text file
      const summaryContent = `Bulk Export Summary\nGenerated: ${new Date().toISOString()}\nTotal Jobs: ${jobs.executions.length}\nSuccessfully Exported: ${exportedFiles.length}\n\nExported Jobs:\n${exportedFiles.map(file => `- ${file.label} (ID: ${file.jobId}): ${file.filename}`).join('\n')}\n`;
      
      archive.append(summaryContent, { name: 'export_summary.txt' });
      
      await archive.finalize();
      
      return { 
        success: true, 
        exportedFiles: exportedFiles,
        zipFile: zipFilename,
        totalJobs: jobs.executions.length,
        successfulExports: exportedFiles.length,
        message: `Successfully exported ${exportedFiles.length} out of ${jobs.executions.length} jobs to ZIP file`
      };
      
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
      
      if (jobs.executions.length === 0) {
        return { success: false, error: 'No jobs found for rerun' };
      }
      
      // Check if any job is currently running
      const runningJobs = jobs.executions.filter(job => job.status === 'running');
      if (runningJobs.length > 0) {
        return { 
          success: false, 
          error: 'Cannot rerun jobs while other jobs are running' 
        };
      }
      
      // Check if we have a job runner available
      const currentStatus = await this.jobRunner.getJobStatus();
      if (currentStatus.status === 'running') {
        return { 
          success: false, 
          error: 'Another job is currently running. Please wait for it to complete.' 
        };
      }
      
      const queuedJobs = [];
      const failedJobs = [];
      
      // Process each job for rerun
      for (const job of jobs.executions) {
        try {
          // Check if the job has a configuration BEFORE trying to rerun
          if (!job.configurationId) {
            failedJobs.push({
              jobId: job.id,
              label: job.label || 'No label',
              error: 'Job has no configuration. Cannot rerun jobs started from Dashboard without saved settings.'
            });
            continue;
          }
          
          // Get the CURRENT configuration (don't corrupt the original job)
          const configResult = await this.jobConfig.getConfigurationById(job.configurationId);
          
          if (configResult.success && configResult.configuration && configResult.configuration.settings) {
            // Add to queue for execution
            queuedJobs.push({
              jobId: job.id,
              label: job.label || 'No label',
              configuration: configResult.configuration.settings,
              configurationId: job.configurationId
            });
          } else {
            failedJobs.push({
              jobId: job.id,
              label: job.label || 'No label',
              error: 'Job configuration not found or invalid. Cannot rerun without valid settings.'
            });
          }
        } catch (error) {
          failedJobs.push({
            jobId: job.id,
            label: job.label || 'No label',
            error: error.message
          });
        }
      }
      
      if (queuedJobs.length === 0) {
        return { 
          success: false, 
          error: 'No jobs could be queued for rerun',
          failedJobs: failedJobs
        };
      }
      
      // Start the first job in the queue
      const firstJob = queuedJobs[0];
      
      // Create a new job execution record FIRST (before starting the job) - SAME AS SINGLE RERUN
      const newExecutionData = {
        configurationId: firstJob.configurationId,
        label: firstJob.label ? `${firstJob.label} (Rerun)` : 'Rerun Job',
        status: 'running'
      };
      
      const newExecution = await this.jobExecution.saveJobExecution(newExecutionData);
      
      if (!newExecution.success) {
        return { 
          success: false, 
          error: 'Failed to create job execution record',
          failedJobs: failedJobs
        };
      }
      
      // Configure JobRunner for rerun mode (same as individual reruns)
      this.jobRunner.configurationId = firstJob.configurationId;
      this.jobRunner.databaseExecutionId = newExecution.id; // Set the execution ID for database operations
      this.jobRunner.isRerun = true; // Set rerun flag to prevent duplicate database saves
      
      const jobResult = await this.jobRunner.startJob(firstJob.configuration);
      
      if (jobResult.success) {
              // Store remaining jobs in queue for sequential execution
      const remainingJobs = queuedJobs.slice(1);
      
      // Store the remaining jobs in a global queue for sequential execution
      if (remainingJobs.length > 0) {
        if (!global.bulkRerunQueue) {
          global.bulkRerunQueue = [];
        }
        
        // Add remaining jobs to the global queue
        global.bulkRerunQueue.push(...remainingJobs.map(job => ({
          ...job,
          originalJobIds: jobs.executions.map(j => j.id), // Track which original jobs this rerun is for
          queueTimestamp: new Date().toISOString()
        })));
        
        console.log(`📋 Bulk rerun: ${remainingJobs.length} jobs queued for sequential execution`);
      }
        
        return { 
          success: true, 
          startedJob: {
            jobId: firstJob.jobId,
            label: firstJob.label,
            newJobId: jobResult.jobId,
            newExecutionId: newExecution.id
          },
          queuedJobs: remainingJobs.length,
          totalJobs: jobs.executions.length,
          failedJobs: failedJobs.length,
          message: `Started rerun of ${firstJob.label || firstJob.jobId}. ${remainingJobs.length} jobs queued for sequential execution.`
        };
      } else {
        // If the job failed to start, update the execution record to failed
        await this.jobExecution.updateJobExecution(newExecution.id, { status: 'failed' });
        return { 
          success: false, 
          error: `Failed to start job rerun: ${jobResult.error}`,
          failedJobs: failedJobs
        };
      }
      
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

  /**
   * Process the next job in the bulk rerun queue
   * This method is called when a job finishes to start the next queued job
   */
  async processNextBulkRerunJob() {
    try {
      if (!global.bulkRerunQueue || global.bulkRerunQueue.length === 0) {
        console.log('📋 Bulk rerun: No jobs in queue');
        return { success: false, message: 'No jobs in queue' };
      }

      // Check if we can start another job
      const currentStatus = await this.jobRunner.getJobStatus();
      if (currentStatus.status === 'running') {
        console.log('📋 Bulk rerun: Another job is running, waiting...');
        return { success: false, message: 'Another job is running' };
      }

      // Get the next job from the queue
      const nextJob = global.bulkRerunQueue.shift();
      console.log(`📋 Bulk rerun: Processing next job: ${nextJob.label || nextJob.jobId}`);

      // Create a new job execution record FIRST (before starting the job)
      const newExecutionData = {
        configurationId: nextJob.configurationId,
        label: nextJob.label ? `${nextJob.label} (Rerun)` : 'Rerun Job',
        status: 'running'
      };

      const newExecution = await this.jobExecution.saveJobExecution(newExecutionData);
      if (!newExecution.success) {
        console.error('📋 Bulk rerun: Failed to create execution record for queued job');
        return { success: false, error: 'Failed to create execution record' };
      }

      // Configure JobRunner for rerun mode
      this.jobRunner.configurationId = nextJob.configurationId;
      this.jobRunner.databaseExecutionId = newExecution.id;
      this.jobRunner.isRerun = true;

      // Start the job
      const jobResult = await this.jobRunner.startJob(nextJob.configuration);
      if (jobResult.success) {
        console.log(`📋 Bulk rerun: Started queued job: ${nextJob.label || nextJob.jobId}`);
        return { 
          success: true, 
          message: 'Queued job started successfully',
          jobId: jobResult.jobId,
          executionId: newExecution.id,
          remainingInQueue: global.bulkRerunQueue.length
        };
      } else {
        // Update execution record to failed
        await this.jobExecution.updateJobExecution(newExecution.id, { status: 'failed' });
        console.error(`📋 Bulk rerun: Failed to start queued job: ${jobResult.error}`);
        return { success: false, error: jobResult.error };
      }

    } catch (error) {
      console.error('Error processing next bulk rerun job:', error);
      return { success: false, error: error.message };
    }
  }

  async openExportsFolder() {
    try {
      // Use the same path as exportJobToExcel
      const electronMod = require('electron');
      const app = electronMod && electronMod.app ? electronMod.app : undefined;
      const exportDir = app && typeof app.getPath === 'function'
        ? path.join(app.getPath('userData'), 'exports')
        : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
      
      // Create export directory if it doesn't exist
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      // Open folder in file explorer
      const { shell } = require('electron');
      await shell.openPath(exportDir);
      
      return { success: true, message: 'Exports folder opened' };
    } catch (error) {
      console.error('Error opening exports folder:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { BackendAdapter }; 