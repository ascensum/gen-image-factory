/**
 * SettingsController - IPC Handler Registration for Settings and Configuration
 * 
 * Architectural Requirements (ADR-002):
 * - All handlers must be < 5 lines
 * - Handlers are thin adapters - no business logic
 * - All validation, transformation, and business logic belongs in Services
 * 
 * Responsibility: Map Electron IPC events to BackendAdapter service calls
 * Extracted from: backendAdapter.js (lines ~396-478)
 * Related ADRs: ADR-002 (Vertical Slice IPC), ADR-003 (Dependency Injection)
 */

const { safeLogger } = require('../utils/logMasking');

/**
 * Register all settings:* and configuration IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main interface
 * @param {BackendAdapter} backendAdapter - Backend service adapter
 */
function registerSettingsHandlers(ipcMain, backendAdapter) {
  safeLogger.log('SettingsController: Registering settings:* IPC handlers');

  // Settings Management
  ipcMain.handle('get-settings', async () => {
    return await backendAdapter.getSettings();
  });

  ipcMain.handle('save-settings', async (event, settingsObject) => {
    return await backendAdapter.saveSettings(settingsObject);
  });

  ipcMain.handle('settings:get-configuration', async () => {
    return await backendAdapter.getSettings();
  });

  // Job Configuration Handlers
  ipcMain.handle('job-configuration:get-by-id', async (event, id) => {
    return await backendAdapter.getJobConfigurationById(id);
  });

  ipcMain.handle('job-configuration:get-by-image-id', async (event, imageId) => {
    return await backendAdapter.ensureInitialized().then(() => 
      backendAdapter.getJobConfigurationForImage(imageId)
    ).catch(error => ({ success: false, error: error.message }));
  });

  ipcMain.handle('job-execution:get-by-image-id', async (event, imageId) => {
    return await backendAdapter.ensureInitialized().then(async () => {
      const imageRes = await backendAdapter.generatedImage.getGeneratedImage(imageId);
      if (!imageRes || !imageRes.success || !imageRes.image) {
        return { success: false, error: 'Image not found' };
      }
      return await backendAdapter.jobExecution.getJobExecution(imageRes.image.executionId);
    }).catch(error => ({ success: false, error: error.message }));
  });

  ipcMain.handle('job-configuration:update', async (event, id, settingsObject) => {
    return await backendAdapter.updateJobConfiguration(id, settingsObject);
  });

  ipcMain.handle('job-configuration:update-name', async (event, id, newName) => {
    return await backendAdapter.updateJobConfigurationName(id, newName);
  });

  // File System Handlers
  ipcMain.handle('select-file', async (event, options) => {
    return await backendAdapter.selectFile(options);
  });

  ipcMain.handle('validate-path', async (event, path, type, fileTypes) => {
    return await backendAdapter.validatePath(path, type, fileTypes);
  });

  ipcMain.handle('reveal-in-folder', async (event, fullPath) => {
    try {
      const { shell } = require('electron');
      if (fullPath && typeof fullPath === 'string') {
        await shell.showItemInFolder(fullPath);
        return { success: true };
      }
      return { success: false, error: 'Invalid path' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-exports-folder', async () => {
    return await backendAdapter.openExportsFolder();
  });

  safeLogger.log('SettingsController: Settings IPC handlers registered');
}

module.exports = { registerSettingsHandlers };
