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
  
  // Generated Image Management
  saveGeneratedImage: (image) => ipcRenderer.invoke('generated-image:save', image),
  getGeneratedImage: (id) => ipcRenderer.invoke('generated-image:get', id),
  getGeneratedImagesByExecution: (executionId) => ipcRenderer.invoke('generated-image:get-by-execution', executionId),
  getAllGeneratedImages: (options) => ipcRenderer.invoke('generated-image:get-all', options),
  updateGeneratedImage: (id, image) => ipcRenderer.invoke('generated-image:update', id, image),
  deleteGeneratedImage: (imageId) => ipcRenderer.invoke('generated-image:delete', { imageId }),
  getImagesByQCStatus: (qcStatus) => ipcRenderer.invoke('generated-image:get-by-qc-status', qcStatus),
  updateQCStatus: (imageId, status) => ipcRenderer.invoke('generated-image:update-qc-status', { imageId, status }),
  manualApproveImage: (imageId) => ipcRenderer.invoke('generated-image:manual-approve', { imageId }),
  getImageMetadata: (executionId) => ipcRenderer.invoke('generated-image:metadata', executionId),
  getImageStatistics: () => ipcRenderer.invoke('generated-image:statistics'),
  
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
      // Generated Image Management
      'generated-image:save',
      'generated-image:get',
      'generated-image:get-by-execution',
      'generated-image:get-all',
      'generated-image:update',
      'generated-image:delete',
      'generated-image:get-by-qc-status',
      'generated-image:update-qc-status',
      'generated-image:manual-approve',
      'generated-image:metadata',
      'generated-image:statistics'
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