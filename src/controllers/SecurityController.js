/**
 * SecurityController - IPC Handler Registration for Security and API Key operations
 *
 * ADR-002: All handlers < 5 lines, thin adapters only.
 * ADR-003: Dependency Injection - accepts modular services, not backendAdapter.
 * Story 5.3: Decommissioned backendAdapter dependency.
 */

const { safeLogger } = require('../utils/logMasking');

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} deps - Injected service dependencies
 * @param {Object} deps.securityService
 */
function registerSecurityHandlers(ipcMain, deps) {
  safeLogger.log('SecurityController: Registering security:* IPC handlers');

  const { securityService } = deps;

  ipcMain.handle('get-api-key', async (_event, serviceName) =>
    securityService.getSecret(serviceName));

  ipcMain.handle('set-api-key', async (_event, serviceName, apiKey) =>
    securityService.setSecret(serviceName, apiKey));

  ipcMain.handle('get-security-status', async () =>
    securityService.getSecurityStatus());

  safeLogger.log('SecurityController: Security IPC handlers registered');
}

module.exports = { registerSecurityHandlers };
