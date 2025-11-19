const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Test IPC communication
  ping: () => ipcRenderer.invoke('ping'),
  
  // Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Settings Management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settingsObject) => ipcRenderer.invoke('save-settings', settingsObject),
  refreshProtocolRoots: (extraPaths) => ipcRenderer.invoke('protocol:refresh-roots', extraPaths),
  requestFileAccess: (filePath) => ipcRenderer.invoke('protocol:request-access', filePath),
  getConfiguration: () => ipcRenderer.invoke('settings:get-configuration'),
  
  // API Key Management
  getApiKey: (serviceName) => ipcRenderer.invoke('get-api-key', serviceName),
  setApiKey: (serviceName, apiKey) => ipcRenderer.invoke('set-api-key', serviceName, apiKey),
  
  // File Selection
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  
  // File Selection Enhancement
  validatePath: (path, type, fileTypes) => ipcRenderer.invoke('validate-path', path, type, fileTypes),
  
  // Job Control
  jobStart: (config) => ipcRenderer.invoke('job:start', config),
  jobStop: () => ipcRenderer.invoke('job:stop'),
  jobForceStop: () => ipcRenderer.invoke('job:force-stop-all'),
  getJobStatus: () => ipcRenderer.invoke('job:get-status'),
  getJobProgress: () => ipcRenderer.invoke('job:get-progress'),
  getJobLogs: (mode) => ipcRenderer.invoke('job:get-logs', mode),
  
  // Security Status
  getSecurityStatus: () => ipcRenderer.invoke('get-security-status'),
  
  // Job Execution Management
  saveJobExecution: (execution) => ipcRenderer.invoke('job-execution:save', execution),
  getJobExecution: (id) => ipcRenderer.invoke('job-execution:get', id),
  getAllJobExecutions: (options) => ipcRenderer.invoke('job-execution:get-all', options),
  updateJobExecution: (id, execution) => ipcRenderer.invoke('job-execution:update', id, execution),
  deleteJobExecution: (jobId) => ipcRenderer.invoke('job-execution:delete', { jobId }),
  getJobHistory: (limit) => ipcRenderer.invoke('job-execution:history', limit),
  getJobStatistics: () => ipcRenderer.invoke('job-execution:statistics'),
  exportJobToExcel: (jobId) => ipcRenderer.invoke('job-execution:export-to-excel', { jobId }),
  calculateJobExecutionStatistics: (executionId) => ipcRenderer.invoke('job-execution:calculate-statistics', executionId),
  updateJobExecutionStatistics: (executionId) => ipcRenderer.invoke('job-execution:update-statistics', executionId),
  
  // Job Management
  jobManagement: {
    getAllJobExecutions: (options) => ipcRenderer.invoke('job-execution:get-all', options),
    getJobExecution: (id) => ipcRenderer.invoke('job-execution:get', id),
    updateJobExecution: (id, execution) => ipcRenderer.invoke('job-execution:update', id, execution),
    deleteJobExecution: (jobId) => ipcRenderer.invoke('job-execution:delete', { jobId }),
    exportJobToExcel: (jobId, options) => ipcRenderer.invoke('job-execution:export-to-excel', { jobId, options }),
    renameJobExecution: (id, label) => ipcRenderer.invoke('job-execution:rename', id, label),
    rerunJobExecution: (id) => ipcRenderer.invoke('job-execution:rerun', id),
    exportJobExecution: (id) => ipcRenderer.invoke('job-execution:export', id),
    bulkDeleteJobExecutions: (ids) => ipcRenderer.invoke('job-execution:bulk-delete', ids),
    bulkExportJobExecutions: (ids, options) => ipcRenderer.invoke('job-execution:bulk-export', { ids, options }),
    bulkRerunJobExecutions: (ids) => ipcRenderer.invoke('job-execution:bulk-rerun', ids),
    processNextBulkRerunJob: () => ipcRenderer.invoke('job-execution:process-next-bulk-rerun'),
    getBulkRerunQueueSize: () => ipcRenderer.invoke('job-execution:get-bulk-rerun-queue-size'),
    getJobExecutionsWithFilters: (filters, page, pageSize) => ipcRenderer.invoke('get-job-executions-with-filters', filters, page, pageSize),
    getJobExecutionsCount: (filters) => ipcRenderer.invoke('get-job-executions-count', filters),
    getJobStatistics: () => ipcRenderer.invoke('job-execution:statistics'),
    getJobHistory: (limit) => ipcRenderer.invoke('job-execution:history', limit),
    getJobStatus: () => ipcRenderer.invoke('job:get-status'),
    getJobLogs: (type) => ipcRenderer.invoke('job:get-logs', type),
    jobStart: (config) => ipcRenderer.invoke('job:start', config),
    jobStop: () => ipcRenderer.invoke('job:stop'),
    jobForceStop: () => ipcRenderer.invoke('job:force-stop'),
    getConfiguration: () => ipcRenderer.invoke('settings:get-configuration'),
    updateJobConfigurationName: (id, newName) => ipcRenderer.invoke('job-configuration:update-name', id, newName),
    deleteGeneratedImage: (imageId) => ipcRenderer.invoke('generated-image:delete', { imageId }),
    bulkDeleteImages: (imageIds) => ipcRenderer.invoke('generated-image:bulk-delete', { imageIds }),
    getAllGeneratedImages: (options) => ipcRenderer.invoke('generated-image:get-all', options),
  },
  
  // Configuration
  getConfiguration: () => ipcRenderer.invoke('settings:get-configuration'),
  getJobConfigurationById: (id) => ipcRenderer.invoke('job-configuration:get-by-id', id),
  getJobConfigurationForImage: (imageId) => ipcRenderer.invoke('job-configuration:get-by-image-id', imageId),
  getJobExecutionByImageId: (imageId) => ipcRenderer.invoke('job-execution:get-by-image-id', imageId),
  updateJobConfiguration: (id, settingsObject) => ipcRenderer.invoke('job-configuration:update', id, settingsObject),
  updateJobConfigurationName: (id, newName) => ipcRenderer.invoke('job-configuration:update-name', id, newName),
  openExportsFolder: () => ipcRenderer.invoke('open-exports-folder'),
  revealInFolder: (fullPath) => ipcRenderer.invoke('reveal-in-folder', fullPath),
  exportJobToExcel: (jobId) => ipcRenderer.invoke('job-execution:export-to-excel', { jobId }),
  
  // Generated Images
  generatedImages: {
    saveGeneratedImage: (image) => ipcRenderer.invoke('generated-image:save', image),
    getGeneratedImage: (id) => ipcRenderer.invoke('generated-image:get', { id }),
    getGeneratedImagesByExecution: (executionId) => ipcRenderer.invoke('generated-image:get-by-execution', executionId),
    getAllGeneratedImages: (options) => ipcRenderer.invoke('generated-image:get-all', options),
    updateGeneratedImage: (id, image) => ipcRenderer.invoke('generated-image:update', { id, image }),
    deleteGeneratedImage: (imageId) => ipcRenderer.invoke('generated-image:delete', { imageId }),
    bulkDeleteGeneratedImages: (imageIds) => ipcRenderer.invoke('generated-image:bulk-delete', { imageIds }),
    getImagesByQCStatus: (qcStatus) => ipcRenderer.invoke('generated-image:get-by-qc-status', { qcStatus }),
    updateQCStatus: (imageId, status) => ipcRenderer.invoke('generated-image:update-qc-status', { imageId, status }),
    updateQCStatusByMappingId: (mappingId, status, reason) => ipcRenderer.invoke('generated-image:update-qc-status-by-mapping', { mappingId, status, reason }),
    updateGeneratedImageByMappingId: (mappingId, image) => ipcRenderer.invoke('generated-image:update-by-mapping', { mappingId, image }),
    getImageMetadata: (executionId) => ipcRenderer.invoke('generated-image:metadata', executionId),
    getImageStatistics: () => ipcRenderer.invoke('generated-image:statistics'),
    manualApproveImage: (imageId) => ipcRenderer.invoke('generated-image:manual-approve', { imageId }),
    exportZip: (imageIds, includeExcel = true, options) => ipcRenderer.invoke('generated-image:export-zip', { imageIds, includeExcel, options }),
    onZipExportProgress: (callback) => ipcRenderer.on('zip-export:progress', (_e, data) => callback(data)),
    onZipExportCompleted: (callback) => ipcRenderer.on('zip-export:completed', (_e, data) => callback(data)),
    onZipExportError: (callback) => ipcRenderer.on('zip-export:error', (_e, data) => callback(data)),
    removeZipExportProgress: (callback) => ipcRenderer.removeListener('zip-export:progress', callback),
    removeZipExportCompleted: (callback) => ipcRenderer.removeListener('zip-export:completed', callback),
    removeZipExportError: (callback) => ipcRenderer.removeListener('zip-export:error', callback),
  },
  getExportsFolderPath: () => ipcRenderer.invoke('get-exports-folder-path'),
  
  // Failed Images Review
  retryFailedImageWithOriginalSettings: (imageId) => ipcRenderer.invoke('failed-image:retry-original', { imageId }),
  retryFailedImageWithModifiedSettings: (imageId, settings) => ipcRenderer.invoke('failed-image:retry-modified', { imageId, settings }),
  retryFailedImagesBatch: (imageIds, useOriginalSettings, modifiedSettings, includeMetadata, failOptions) => ipcRenderer.invoke('failed-image:retry-batch', { imageIds, useOriginalSettings, modifiedSettings, includeMetadata, failOptions }),
  getRetryQueueStatus: () => ipcRenderer.invoke('failed-image:get-queue-status'),
  
  // Retry Event Listeners
  onRetryProgress: (callback) => ipcRenderer.on('retry-progress', callback),
  onRetryCompleted: (callback) => ipcRenderer.on('retry-completed', callback),
  onRetryError: (callback) => ipcRenderer.on('retry-error', callback),
  onRetryQueueUpdated: (callback) => ipcRenderer.on('retry-queue-updated', callback),
  onRetryStatusUpdated: (callback) => ipcRenderer.on('retry-status-updated', callback),
  
  // Remove retry event listeners
  removeRetryProgress: (callback) => ipcRenderer.removeListener('retry-progress', callback),
  removeRetryCompleted: (callback) => ipcRenderer.removeListener('retry-completed', callback),
  removeRetryError: (callback) => ipcRenderer.removeListener('retry-error', callback),
  removeRetryQueueUpdated: (callback) => ipcRenderer.removeListener('retry-queue-updated', callback),
  removeRetryStatusUpdated: (callback) => ipcRenderer.removeListener('retry-status-updated', callback),
  
  // Error handling wrapper
  invoke: (channel, ...args) => {
    // Whitelist channels for security
    const validChannels = [
      'ping', 
      'get-app-version',
      'get-settings',
      'save-settings',
      'settings:get-configuration', 
      'get-api-key',
      'set-api-key',
      'select-file',
      'validate-path',
      'job:start',
      'job:stop',
      'job:force-stop-all',
      'job:get-status',
      'job:get-progress',
      'job:get-logs',
      'get-security-status',
      // Job Execution Management
      'job-execution:save',
      'job-execution:get',
      'job-execution:get-all',
      'job-execution:update',
      'job-execution:delete',
      'job-execution:statistics',
      'job-execution:export-to-excel',
      'job-execution:rename',
      'job-execution:bulk-delete',
      'job-execution:bulk-export',
      'job-execution:bulk-rerun',
      'job-execution:process-next-bulk-rerun',
      'job-execution:history',
      'job-execution:calculate-statistics',
      'job-execution:update-statistics',
      'job-execution:rerun',
      'job-execution:export',
      'job-execution:delete',
      'get-job-results',
      'get-job-executions-with-filters',
      'get-job-executions-count',
      'settings:get-configuration',
      'job-configuration:get-by-id',
      'job-configuration:get-by-image-id',
      'job-execution:get-by-image-id',
      'job-configuration:update',
      'job-configuration:update-name',
      'open-exports-folder',
      'reveal-in-folder',
      // Generated Image Management
      'generated-image:save',
      'generated-image:get',
      'generated-image:get-by-execution',
      'generated-image:get-all',
      'generated-image:update',
      'generated-image:delete',
      'generated-image:get-by-qc-status',
      'generated-image:update-qc-status',
      'generated-image:update-qc-status-by-mapping',
      'generated-image:manual-approve',
      'generated-image:metadata',
      'generated-image:statistics',
      'generated-image:export-zip',
      'generated-image:bulk-delete',
      'get-exports-folder-path',
      'failed-image:get-queue-status',
              'failed-image:retry-original',
        'failed-image:retry-modified',
        'failed-image:retry-batch'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  }
});

// Handle any errors in the preload script
window.addEventListener('error', (event) => {
  console.error('Preload script error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in preload:', event.reason);
}); 