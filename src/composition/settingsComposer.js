/**
 * SettingsComposer - Composed settings operations (getSettings / saveSettings).
 *
 * Replaces the settings composition that lived in backendAdapter.js.
 * Merges JobConfigurationRepository data with SecurityService API keys.
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

    if (!normalizedConfig.filePaths) {
      try {
        const currentSettings = await this.getSettings();
        const fp = currentSettings?.settings?.filePaths;
        if (fp && (fp.outputDirectory || fp.tempDirectory)) {
          normalizedConfig.filePaths = { ...fp };
        }
      } catch (e) {
        console.warn('prepareJobConfig: failed to merge saved filePaths:', e.message);
      }
    }

    if (normalizedConfig.filePaths) {
      const defaults = this.getDefaultSettings();
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

    try {
      const currentSettings = await this.getSettings();
      const apiKeys = currentSettings?.settings?.apiKeys || {};
      normalizedConfig.apiKeys = { ...(normalizedConfig.apiKeys || {}), ...apiKeys };
    } catch (e) {
      console.warn('prepareJobConfig: failed to merge API keys:', e.message);
    }

    try {
      if (normalizedConfig.processing) {
        const { normalizeProcessingSettings } = require('../utils/processing');
        normalizedConfig.processing = normalizeProcessingSettings(normalizedConfig.processing);
      }
    } catch { /* proceed */ }

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
