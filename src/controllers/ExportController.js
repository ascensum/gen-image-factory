/**
 * ExportController - IPC Handler Registration for Export operations
 *
 * ADR-002: All handlers < 5 lines, thin adapters only.
 * ADR-003: Dependency Injection - accepts modular services, not backendAdapter.
 * Story 5.3: Decommissioned backendAdapter dependency.
 */

const { safeLogger } = require('../utils/logMasking');
const path = require('path');

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} deps - Injected service dependencies
 * @param {Object} deps.exportService
 * @param {Object} deps.jobRepository
 */
function registerExportHandlers(ipcMain, deps) {
  safeLogger.log('ExportController: Registering export:* IPC handlers');

  const { exportService, jobRepository } = deps;

  ipcMain.handle('job-execution:export-to-excel', async (_event, { jobId, options }) =>
    exportService.exportJobToExcel(jobId, options));

  ipcMain.handle('job-execution:bulk-export', async (_event, { ids, options }) =>
    exportService.bulkExportJobExecutions(ids, options));

  ipcMain.handle('export-job-to-excel', async (_event, jobId, options = {}) =>
    exportService.exportJobToExcel(jobId, options));

  ipcMain.handle('job-execution:export', async (_event, id) =>
    jobRepository.exportJobExecution(id));

  ipcMain.handle('generated-image:export-zip', async (_event, { imageIds, includeExcel, options }) =>
    exportService.createZipExport(imageIds, includeExcel, options));

  ipcMain.handle('get-exports-folder-path', async () => {
    try {
      const electronMod = require('electron');
      const app = electronMod?.app;
      const exportDir = (app && typeof app.getPath === 'function')
        ? path.join(app.getPath('userData'), 'exports')
        : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
      const fs = require('fs');
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      return { success: true, path: exportDir };
    } catch (error) { return { success: false, error: error.message }; }
  });

  safeLogger.log('ExportController: Export IPC handlers registered');
}

module.exports = { registerExportHandlers };
