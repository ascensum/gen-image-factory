/**
 * SettingsController - IPC Handler Registration for Settings and Configuration
 *
 * ADR-002: All handlers < 5 lines, thin adapters only.
 * ADR-003: Dependency Injection - accepts modular services, not backendAdapter.
 * Story 5.3: Decommissioned backendAdapter dependency.
 */

const { safeLogger } = require('../utils/logMasking');

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} deps - Injected service dependencies
 * @param {Object} deps.settingsComposer
 * @param {Object} deps.imageRepository
 * @param {Object} deps.jobRepository
 */
function registerSettingsHandlers(ipcMain, deps) {
  safeLogger.log('SettingsController: Registering settings:* IPC handlers');

  const { settingsComposer, imageRepository, jobRepository } = deps;

  ipcMain.handle('get-settings', async () =>
    settingsComposer.getSettings());

  ipcMain.handle('save-settings', async (_event, settingsObject) =>
    settingsComposer.saveSettings(settingsObject));

  ipcMain.handle('settings:get-configuration', async () =>
    settingsComposer.getSettings());

  ipcMain.handle('job-configuration:get-by-id', async (_event, id) =>
    settingsComposer.getConfigurationById(id));

  ipcMain.handle('job-configuration:get-by-image-id', async (_event, imageId) => {
    try {
      const imageRes = await imageRepository.getGeneratedImage(imageId);
      if (!imageRes?.success || !imageRes.image?.executionId) return { success: false, error: 'Image not found' };
      const execRes = await jobRepository.getJobExecution(imageRes.image.executionId);
      if (!execRes?.success || !execRes.execution?.configurationId) return { success: false, error: 'Execution not found' };
      return await settingsComposer.getConfigurationById(execRes.execution.configurationId);
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('job-execution:get-by-image-id', async (_event, imageId) => {
    try {
      const imageRes = await imageRepository.getGeneratedImage(imageId);
      if (!imageRes?.success || !imageRes.image) return { success: false, error: 'Image not found' };
      return await jobRepository.getJobExecution(imageRes.image.executionId);
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('job-configuration:update', async (_event, id, settingsObject) =>
    settingsComposer.updateConfiguration(id, settingsObject));

  ipcMain.handle('job-configuration:update-name', async (_event, id, newName) =>
    settingsComposer.updateConfigurationName(id, newName));

  // File System Handlers
  ipcMain.handle('select-file', async (_event, options) => {
    try {
      const { dialog } = require('electron');

      if (options.mode === 'save' || options.type === 'save') {
        const filters = options.filters || [{ name: 'All Files', extensions: ['*'] }];
        const saveRes = await dialog.showSaveDialog({ title: options.title || 'Save As', defaultPath: options.defaultPath, filters });
        if (!saveRes.canceled && saveRes.filePath) return { success: true, filePath: saveRes.filePath };
        return { success: false, canceled: true };
      }

      const properties = options.type === 'directory' ? ['openDirectory'] : ['openFile'];
      let filters = [];
      if (options.type !== 'directory') {
        filters = options.fileTypes?.length
          ? [{ name: 'Supported Files', extensions: options.fileTypes.map(e => e.startsWith('.') ? e.substring(1) : e) }, { name: 'All Files', extensions: ['*'] }]
          : [{ name: 'All Files', extensions: ['*'] }];
      }
      const result = await dialog.showOpenDialog({ properties, filters, title: options.title || `Select ${options.type === 'directory' ? 'Directory' : 'File'}` });
      if (!result.canceled && result.filePaths.length > 0) return { success: true, filePath: result.filePaths[0] };
      return { success: false, canceled: true };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('validate-path', async (_event, filePath, type, fileTypes) => {
    try {
      const fs = require('fs');
      const pathMod = require('path');
      if (!filePath) return { isValid: false, message: 'Path is required' };
      const resolved = pathMod.resolve(filePath);
      const stat = fs.statSync(resolved);
      if (type === 'directory' && !stat.isDirectory()) return { isValid: false, message: 'Not a directory' };
      if (type === 'file' && !stat.isFile()) return { isValid: false, message: 'Not a file' };
      return { isValid: true, path: resolved };
    } catch (error) { return { isValid: false, message: error.message }; }
  });

  ipcMain.handle('reveal-in-folder', async (_event, fullPath) => {
    try {
      const { shell } = require('electron');
      if (fullPath && typeof fullPath === 'string') { await shell.showItemInFolder(fullPath); return { success: true }; }
      return { success: false, error: 'Invalid path' };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('open-exports-folder', async () => {
    try {
      const { shell, app } = require('electron');
      const pathMod = require('path');
      const fs = require('fs');
      const exportDir = pathMod.join(app.getPath('userData'), 'exports');
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      shell.openPath(exportDir);
      return { success: true, path: exportDir };
    } catch (error) { return { success: false, error: error.message }; }
  });

  safeLogger.log('SettingsController: Settings IPC handlers registered');
}

module.exports = { registerSettingsHandlers };
