/**
 * SettingsComposer - Composed settings operations (getSettings / saveSettings).
 *
 * Replaces the settings composition that lived in backendAdapter.js (pre–Story 5.3).
 * Contract: shallow-merge defaults with DB (`{ ...defaults, ...result.settings }`), same as
 * legacy `getSettings`. `prepareJobConfig` merges filePaths, apiKeys, then **processing** and **ai** from
 * defaults + DB; any **IPC keys present** on the incoming job config override saved for that run (snapshot +
 * retry parity). If `getSettings` fails, fall back to defaults + IPC. Boolean-like strings in stored JSON are
 * normalized in `normalizeProcessingSettings`.
 *
 * ADR-001: < 400 lines.  ADR-003: constructor injection.
 */

const { logDebug } = require('../utils/logDebug');

const ACCOUNT_NAMES = {
  OPENAI: 'openai-api-key',
  PIAPI: 'piapi-api-key',
  RUNWARE: 'runware-api-key',
  REMOVE_BG: 'remove-bg-api-key'
};

function normalizeServiceKey(service) {
  if (service === 'removeBg' || service === 'removebg' || service === 'remove_bg') return 'REMOVE_BG';
  return service.toUpperCase();
}

class SettingsComposer {
  /**
   * @param {Object} deps
   * @param {Object} deps.configRepository     - JobConfigurationRepository instance
   * @param {Object} deps.securityService       - SecurityService instance
   * @param {Function} deps.getDefaultSettings  - () => defaultSettingsObject
   */
  constructor(deps) {
    this.configRepository = deps.configRepository;
    this.securityService = deps.securityService;
    this.getDefaultSettings = deps.getDefaultSettings;
  }

  async getSettings() {
    try {
      const result = await this.configRepository.getSettings();

      const defaults = this.getDefaultSettings();
      const settings = (result.success && result.settings)
        ? { ...defaults, ...result.settings }
        : { ...defaults };

      if (!settings.apiKeys) settings.apiKeys = {};
      await this._loadApiKeys(settings.apiKeys);

      if (!settings.parameters) settings.parameters = {};
      settings.parameters.runwareModel = settings.parameters.runwareModel || 'runware:101@1';
      settings.parameters.runwareDimensionsCsv = settings.parameters.runwareDimensionsCsv || '';
      settings.parameters.runwareFormat = settings.parameters.runwareFormat || 'png';
      settings.parameters.variations = Math.max(1, Math.min(20, Number(settings.parameters.variations || 1)));

      return { success: true, settings };
    } catch (error) {
      console.error('SettingsComposer.getSettings failed:', error);
      const fallback = this.getDefaultSettings();
      return { success: true, settings: fallback };
    }
  }

  async saveSettings(settingsObject) {
    try {
      this._normalizeRunwareAdvanced(settingsObject);

      if (settingsObject.apiKeys) {
        await this._saveApiKeys(settingsObject.apiKeys);
      }

      const result = await this.configRepository.saveSettings(settingsObject);
      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('SettingsComposer.saveSettings failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getConfigurationById(id) {
    try {
      return await this.configRepository.getConfigurationById(id);
    } catch (error) {
      console.error('Error getting job configuration by ID:', error);
      return { success: false, error: error.message };
    }
  }

  async updateConfiguration(id, settingsObject) {
    try {
      this._normalizeRunwareAdvanced(settingsObject);
      return await this.configRepository.updateConfiguration(id, settingsObject);
    } catch (error) {
      console.error('Error updating job configuration:', error);
      return { success: false, error: error.message };
    }
  }

  async updateConfigurationName(id, newName) {
    try {
      return await this.configRepository.updateConfigurationName(id, newName);
    } catch (error) {
      console.error('Error updating job configuration name:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Prepare a job config for execution: merge file paths + API keys + normalize processing.
   * Replaces the config normalization from backendAdapter.startJob().
   */
  async prepareJobConfig(config) {
    const normalizedConfig = { ...config };
    const defaults = this.getDefaultSettings();

    let saved = null;
    try {
      const r = await this.getSettings();
      if (r?.success && r.settings) saved = r.settings;
    } catch (e) {
      console.warn('prepareJobConfig: failed to load saved settings:', e.message);
    }

    if (!normalizedConfig.filePaths && saved?.filePaths) {
      const fp = saved.filePaths;
      if (fp && (fp.outputDirectory || fp.tempDirectory)) {
        normalizedConfig.filePaths = { ...fp };
      }
    }

    if (normalizedConfig.filePaths) {
      const dfp = defaults.filePaths || {};
      normalizedConfig.filePaths = {
        ...normalizedConfig.filePaths,
        outputDirectory: (normalizedConfig.filePaths.outputDirectory || '').trim() !== ''
          ? normalizedConfig.filePaths.outputDirectory
          : dfp.outputDirectory,
        tempDirectory: (normalizedConfig.filePaths.tempDirectory || '').trim() !== ''
          ? normalizedConfig.filePaths.tempDirectory
          : dfp.tempDirectory
      };
    }

    if (saved) {
      const apiKeys = saved.apiKeys || {};
      normalizedConfig.apiKeys = { ...(normalizedConfig.apiKeys || {}), ...apiKeys };
    }

    const baseAi = defaults.ai || {};
    const ipcAi = normalizedConfig.ai && typeof normalizedConfig.ai === 'object' && normalizedConfig.ai !== null ? normalizedConfig.ai : {};
    if (saved) {
      const fromSavedAi = saved.ai && typeof saved.ai === 'object' && saved.ai !== null ? saved.ai : {};
      normalizedConfig.ai = { ...baseAi, ...fromSavedAi };
      /** Per-job dashboard flags win over global saved (execution snapshot + retry rely on them). */
      if (Object.prototype.hasOwnProperty.call(ipcAi, 'runMetadataGen')) {
        normalizedConfig.ai.runMetadataGen = !!ipcAi.runMetadataGen;
      }
      if (Object.prototype.hasOwnProperty.call(ipcAi, 'runQualityCheck')) {
        normalizedConfig.ai.runQualityCheck = !!ipcAi.runQualityCheck;
      }
    } else {
      normalizedConfig.ai = { ...baseAi, ...ipcAi };
    }

    try {
      const { normalizeProcessingSettings } = require('../utils/processing');
      const baseProc = defaults.processing || {};
      const ipcProc = normalizedConfig.processing && typeof normalizedConfig.processing === 'object'
        ? normalizedConfig.processing
        : {};
      if (saved) {
        const fromSaved = saved.processing && typeof saved.processing === 'object' && saved.processing !== null
          ? saved.processing
          : {};
        const mergedProc = { ...baseProc, ...fromSaved };
        /** Same contract as `ai`: IPC carries this-run toggles from `job:start` (must match snapshot). */
        if (ipcProc && typeof ipcProc === 'object') {
          for (const key of Object.keys(ipcProc)) {
            if (Object.prototype.hasOwnProperty.call(ipcProc, key)) {
              mergedProc[key] = ipcProc[key];
            }
          }
        }
        normalizedConfig.processing = normalizeProcessingSettings(mergedProc);
      } else {
        normalizedConfig.processing = normalizeProcessingSettings({ ...baseProc, ...ipcProc });
      }
    } catch { /* proceed */ }

    if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
      try {
        const p = normalizedConfig.processing || {};
        console.info('[prepareJobConfig] processing=', JSON.stringify({
          removeBg: !!p.removeBg,
          imageConvert: !!p.imageConvert,
          imageEnhancement: !!p.imageEnhancement,
          trimTransparentBackground: !!p.trimTransparentBackground
        }), 'ai=', JSON.stringify(normalizedConfig.ai || {}));
      } catch { /* ignore */ }
    }

    return normalizedConfig;
  }

  /**
   * Save job configuration to DB and return the config ID + label.
   */
  async saveJobConfiguration(normalizedConfig) {
    const providedLabel = (normalizedConfig?.parameters?.label || '').trim();
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fallbackLabel = `job_${ts}`;
    const configName = providedLabel !== '' ? providedLabel : fallbackLabel;

    if (providedLabel === '') {
      normalizedConfig.parameters = { ...(normalizedConfig.parameters || {}), label: fallbackLabel };
    }

    const configResult = await this.configRepository.saveSettings(normalizedConfig, configName);
    return { configId: configResult.id, label: configName };
  }

  // ─── Private helpers ───

  async _loadApiKeys(apiKeysObj) {
    for (const [service, _accountName] of Object.entries(ACCOUNT_NAMES)) {
      try {
        const apiKey = await this.securityService.getSecret(service.toLowerCase());
        if (apiKey && apiKey.success !== false) {
          const key = typeof apiKey === 'string' ? apiKey : (apiKey.apiKey || apiKey.key || '');
          if (key) apiKeysObj[service.toLowerCase()] = key;
        }
      } catch (error) {
        logDebug(`Failed to load API key for ${service}: ${error.message}`);
      }
    }
  }

  async _saveApiKeys(apiKeysObj) {
    for (const [service, apiKey] of Object.entries(apiKeysObj)) {
      try {
        await this.securityService.setSecret(normalizeServiceKey(service).toLowerCase(), apiKey);
      } catch (error) {
        console.warn(`Failed to save API key for ${service}:`, error.message);
      }
    }
  }

  _normalizeRunwareAdvanced(settingsObject) {
    try {
      const params = settingsObject?.parameters;
      if (!params) return;
      if (params.runwareAdvancedEnabled !== true) {
        const adv = params.runwareAdvanced || {};
        if (!Array.isArray(params.lora) && Array.isArray(adv.lora) && adv.lora.length > 0) {
          params.lora = adv.lora;
        }
        params.runwareAdvancedEnabled = false;
        if (params.runwareAdvanced) params.runwareAdvanced = {};
        settingsObject.parameters = params;
      }
    } catch { /* ignore */ }
  }
}

module.exports = SettingsComposer;
