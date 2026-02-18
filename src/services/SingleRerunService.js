/**
 * SingleRerunService - Single job execution rerun (create new execution, start job)
 *
 * Extracted from: BackendAdapter (legacy _ipc.handle('job-execution:rerun'))
 * Story 3.1 pattern: logic lives in service; backendAdapter is thin shadow-bridge layer only.
 *
 * ADR-001: File Size Guardrail (< 400 lines)
 * ADR-003: Dependency Injection (constructor-based)
 * CRITICAL: Logic copied from backendAdapter - no behavior change.
 */

class SingleRerunService {
  /**
   * @param {Object} deps - Injected dependencies (DI)
   * @param {Object} deps.jobExecution - Job execution model/repository
   * @param {Object} deps.jobConfig - Job configuration model
   * @param {Object} deps.jobRunner - JobRunner instance (startJob, getJobStatus)
   * @param {Function} deps.saveJobExecution - (execution) => Promise<{ success, id?, execution? }>
   * @param {Function} deps.getSettings - () => Promise<settings>
   */
  constructor(deps) {
    this.jobExecution = deps.jobExecution;
    this.jobConfig = deps.jobConfig;
    this.jobRunner = deps.jobRunner;
    this.saveJobExecution = deps.saveJobExecution;
    this.getSettings = deps.getSettings;
  }

  /**
   * Rerun a single job execution by id.
   * @param {string|number} id - Job execution id
   * @returns {Promise<{ success: boolean, error?: string, message?: string, jobId?: string, originalJobId?: string, newExecutionId?: string }>}
   */
  async rerunJobExecution(id) {
    try {
      const jobData = await this.jobExecution.getJobExecution(id);
      if (!jobData.success) {
        return { success: false, error: 'Job execution not found' };
      }
      if (!jobData.execution.configurationId) {
        return {
          success: false,
          error: 'Job has no configuration. Cannot rerun jobs started from Dashboard without saved settings.'
        };
      }
      const configResult = await this.jobConfig.getConfigurationById(jobData.execution.configurationId);
      if (!configResult.success || !configResult.configuration || !configResult.configuration.settings) {
        return {
          success: false,
          error: 'Job configuration not found or invalid. Cannot rerun without valid settings.'
        };
      }
      const currentStatus = await this.jobRunner.getJobStatus();
      if (currentStatus.status === 'running') {
        return {
          success: false,
          error: 'Another job is currently running. Please wait for it to complete.'
        };
      }
      let baseLabel = '';
      try {
        const cfgLabel = String(
          (configResult?.configuration?.settings?.parameters && configResult.configuration.settings.parameters.label) || ''
        ).trim();
        if (cfgLabel) baseLabel = cfgLabel;
      } catch {
        // Ignore errors when extracting label from config
      }
      if (!baseLabel) {
        try {
          const cfgName = String(configResult?.configuration?.name || '').trim();
          if (cfgName) baseLabel = cfgName;
        } catch {
          // Ignore errors when extracting label from config
        }
      }
      if (!baseLabel) {
        const prior = String(jobData?.execution?.label || '').trim();
        if (prior) baseLabel = prior.replace(/\s*\(Rerun\)$/, '');
      }
      const rerunLabel = baseLabel ? `${baseLabel} (Rerun)` : 'Rerun Job';
      const newExecutionData = {
        configurationId: jobData.execution.configurationId,
        label: rerunLabel,
        status: 'running'
      };
      const newExecution = await this.saveJobExecution(newExecutionData);
      if (!newExecution.success) {
        return { success: false, error: 'Failed to create job execution record' };
      }
      const newExecutionId = newExecution.id ?? newExecution.execution?.id;
      try {
        const cfg = configResult?.configuration?.settings || null;
        if (cfg) {
          // eslint-disable-next-line no-unused-vars
          const { apiKeys, ...sanitized } = cfg;
          if (sanitized && sanitized.parameters) {
            const adv = sanitized.parameters.runwareAdvanced || {};
            const advEnabled = Boolean(
              adv && (
                adv.CFGScale != null ||
                adv.steps != null ||
                (adv.scheduler && String(adv.scheduler).trim() !== '') ||
                adv.checkNSFW === true ||
                (Array.isArray(adv.lora) && adv.lora.length > 0)
              )
            );
            sanitized.parameters.runwareAdvancedEnabled = advEnabled;
          }
          try {
            if (!sanitized.processing) sanitized.processing = {};
            const { normalizeRemoveBgFailureMode } = require('../utils/processing');
            const modeFromCfg = (cfg.processing && cfg.processing.removeBgFailureMode) ? String(cfg.processing.removeBgFailureMode) : undefined;
            const existing = (sanitized.processing && sanitized.processing.removeBgFailureMode) ? String(sanitized.processing.removeBgFailureMode) : undefined;
            const mode = modeFromCfg || existing;
            sanitized.processing.removeBgFailureMode = normalizeRemoveBgFailureMode(mode);
          } catch {
            // Ignore errors when setting removeBgFailureMode
          }
          await this.jobExecution.updateJobExecution(newExecutionId, {
            configurationId: jobData.execution.configurationId,
            status: 'running',
            configurationSnapshot: sanitized || null
          });
        }
      } catch (e) {
        console.warn(' Rerun snapshot persistence failed (non-fatal):', e.message);
      }
      this.jobRunner.persistedLabel = newExecutionData.label;
      try {
        const currentSettings = await this.getSettings();
        const apiKeys = currentSettings?.settings?.apiKeys || {};
        configResult.configuration.settings.apiKeys = { ...(configResult.configuration.settings.apiKeys || {}), ...apiKeys };
      } catch (e) {
        console.warn('Rerun: failed to merge runtime API keys into configuration:', e.message);
      }
      this.jobRunner.configurationId = jobData.execution.configurationId;
      this.jobRunner.databaseExecutionId = newExecutionId;
      this.jobRunner.isRerun = true;
      let settingsForRun = configResult.configuration.settings || {};
      try {
        const params = settingsForRun.parameters || {};
        if (params.runwareAdvancedEnabled !== true) {
          const adv = params.runwareAdvanced || {};
          if (!Array.isArray(params.lora) && Array.isArray(adv.lora) && adv.lora.length > 0) {
            params.lora = adv.lora;
          }
          params.runwareAdvancedEnabled = false;
          if (params.runwareAdvanced) params.runwareAdvanced = {};
          settingsForRun.parameters = params;
        }
      } catch {
        // Ignore errors when normalizing parameters
      }
      const jobResult = await this.jobRunner.startJob(settingsForRun);
      if (jobResult.success) {
        return {
          success: true,
          message: 'Job rerun started successfully',
          jobId: jobResult.jobId,
          originalJobId: id,
          newExecutionId: newExecutionId
        };
      }
      await this.jobExecution.updateJobExecution(newExecutionId, { status: 'failed' });
      return { success: false, error: `Failed to start job rerun: ${jobResult.error}` };
    } catch (error) {
      console.error('Error rerunning job execution:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { SingleRerunService };
