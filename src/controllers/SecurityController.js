/**
 * SecurityController - IPC Handler Registration for Security and API Key operations
 * 
 * Architectural Requirements (ADR-002):
 * - All handlers must be < 5 lines
 * - Handlers are thin adapters - no business logic
 * - All validation, transformation, and business logic belongs in Services
 * 
 * Responsibility: Map Electron IPC events to BackendAdapter/SecurityService calls
 * Extracted from: backendAdapter.js (lines ~387-393, ~514-516)
 * Related ADRs: ADR-002 (Vertical Slice IPC), ADR-003 (Dependency Injection)
 */

const { safeLogger } = require('../utils/logMasking');

/**
 * Register all security:* and API key IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main interface
 * @param {BackendAdapter} backendAdapter - Backend service adapter
 */
function registerSecurityHandlers(ipcMain, backendAdapter) {
  safeLogger.log('SecurityController: Registering security:* IPC handlers');

  // API Key Management
  ipcMain.handle('get-api-key', async (event, serviceName) => {
    return await backendAdapter.getApiKey(serviceName);
  });

  ipcMain.handle('set-api-key', async (event, serviceName, apiKey) => {
    return await backendAdapter.setApiKey(serviceName, apiKey);
  });

  // Security Status
  ipcMain.handle('get-security-status', async () => {
    return await backendAdapter.getSecurityStatus();
  });

  safeLogger.log('SecurityController: Security IPC handlers registered');
}

module.exports = { registerSecurityHandlers };
