/**
 * Build a safe JSON snapshot of job config for job_executions.configuration_snapshot.
 * Strips apiKeys; normalizes runwareAdvancedEnabled and removeBgFailureMode (same rules as rerun services).
 * Used for Image Gallery / Failed Review modals (as-run processing tab) and export parity.
 */

const path = require('path');
const { normalizeRemoveBgFailureMode } = require(path.join(__dirname, './processing'));

/**
 * @param {Object|null|undefined} config - Full job config (e.g. settingsComposer.prepareJobConfig output)
 * @returns {Object|null}
 */
function sanitizeConfigurationSnapshot(config) {
  if (!config || typeof config !== 'object') return null;
  let sanitized;
  try {
    sanitized = JSON.parse(JSON.stringify(config));
  } catch {
    return null;
  }
  delete sanitized.apiKeys;

  if (sanitized.parameters && typeof sanitized.parameters === 'object') {
    const adv = sanitized.parameters.runwareAdvanced || {};
    sanitized.parameters.runwareAdvancedEnabled = Boolean(
      adv && (
        adv.CFGScale != null ||
        adv.steps != null ||
        (adv.scheduler && String(adv.scheduler).trim() !== '') ||
        adv.checkNSFW === true ||
        (Array.isArray(adv.lora) && adv.lora.length > 0)
      )
    );
  }

  try {
    if (!sanitized.processing) sanitized.processing = {};
    const modeFromCfg = config.processing && config.processing.removeBgFailureMode
      ? String(config.processing.removeBgFailureMode)
      : undefined;
    const existing = sanitized.processing.removeBgFailureMode != null
      ? String(sanitized.processing.removeBgFailureMode)
      : undefined;
    const mode = modeFromCfg || existing;
    sanitized.processing.removeBgFailureMode = normalizeRemoveBgFailureMode(mode);
  } catch {
    // keep processing as cloned
  }

  return sanitized;
}

module.exports = { sanitizeConfigurationSnapshot };
