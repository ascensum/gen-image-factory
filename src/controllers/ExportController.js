/**
 * ExportController - IPC Handler Registration for Export operations
 * 
 * Architectural Requirements (ADR-002):
 * - All handlers must be < 5 lines
 * - Handlers are thin adapters - no business logic
 * - All validation, transformation, and business logic belongs in Services
 * 
 * Responsibility: Map Electron IPC events to BackendAdapter/ExportService calls
 * Extracted from: backendAdapter.js (lines ~550-552, ~604-605, ~679-681, ~684-697)
 * Related ADRs: ADR-002 (Vertical Slice IPC), ADR-003 (Dependency Injection)
 */

const { safeLogger } = require('../utils/logMasking');
const path = require('path');

/**
 * Register all export:* IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main interface
 * @param {BackendAdapter} backendAdapter - Backend service adapter
 */
function registerExportHandlers(ipcMain, backendAdapter) {
  safeLogger.log('ExportController: Registering export:* IPC handlers');

  // Job Execution Export Handlers
  ipcMain.handle('job-execution:export-to-excel', async (event, { jobId, options }) => {
    return await backendAdapter.exportJobToExcel(jobId, options);
  });

  ipcMain.handle('job-execution:bulk-export', async (event, { ids, options }) => {
    return await backendAdapter.bulkExportJobExecutions(ids, options);
  });

  // Legacy export handler (backwards compatibility)
  ipcMain.handle('export-job-to-excel', async (event, jobId, options = {}) => {
    return await backendAdapter.exportJobToExcel(jobId, options);
  });

  // Generated Image Export Handlers
  ipcMain.handle('generated-image:export-zip', async (event, { imageIds, includeExcel, options }) => {
    return await backendAdapter.createZipExport(imageIds, includeExcel, options);
  });

  // Exports folder path helper
  ipcMain.handle('get-exports-folder-path', async () => {
    try {
      const electronMod = require('electron');
      const app = electronMod && electronMod.app ? electronMod.app : undefined;
      const exportDir = app && typeof app.getPath === 'function'
        ? path.join(app.getPath('userData'), 'exports')
        : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
      const fs = require('fs');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      return { success: true, path: exportDir };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  safeLogger.log('ExportController: Export IPC handlers registered');
}

module.exports = { registerExportHandlers };
