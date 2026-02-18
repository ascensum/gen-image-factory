/**
 * BulkRerunService - Bulk job execution rerun (queue + first job start, process next from queue)
 *
 * Extracted from: BackendAdapter (bulkRerunJobExecutions, processNextBulkRerunJob)
 * Story 3.1 scope gap remediation: logic in service; adapter is thin bridge only.
 *
 * ADR-001: File Size Guardrail (< 400 lines)
 * ADR-003: Dependency Injection (constructor-based)
 * Queue: uses global.bulkRerunQueue (shared with getJobExecutionsWithFilters); can be injected later.
 */

class BulkRerunService {
  /**
   * @param {Object} deps - Injected dependencies (DI)
   * @param {Object} deps.jobExecution - Job execution model/repository
   * @param {Object} deps.jobConfig - Job configuration model
   * @param {Object} deps.jobRunner - JobRunner instance (startJob, getJobStatus)
   * @param {Function} deps.getSettings - () => Promise<settings>
   */
  constructor(deps) {
    this.jobExecution = deps.jobExecution;
    this.jobConfig = deps.jobConfig;
    this.jobRunner = deps.jobRunner;
    this.getSettings = deps.getSettings;
  }

  /**
   * Bulk rerun: fetch jobs by ids, validate, queue, start first job, push rest to global.bulkRerunQueue.
   * @param {string[]|number[]} ids - Job execution ids
   * @returns {Promise<{ success: boolean, error?: string, failedJobs?: array, startedJob?: object, queuedJobs?: number, totalJobs?: number, message?: string }>}
   */
  async bulkRerunJobExecutions(ids) {
    try {
      const jobs = await this.jobExecution.getJobExecutionsByIds(ids);
      if (!jobs.success) {
        return { success: false, error: 'Failed to retrieve jobs for rerun' };
      }
      if (jobs.executions.length === 0) {
        return { success: false, error: 'No jobs found for rerun' };
      }
      const runningJobs = jobs.executions.filter(job => job.status === 'running');
      if (runningJobs.length > 0) {
        return { success: false, error: 'Cannot rerun jobs while other jobs are running' };
      }
      const currentStatus = await this.jobRunner.getJobStatus();
      if (currentStatus.status === 'running') {
        return { success: false, error: 'Another job is currently running. Please wait for it to complete.' };
      }
      const queuedJobs = [];
      const failedJobs = [];
      for (const job of jobs.executions) {
        try {
          if (!job.configurationId) {
            failedJobs.push({ jobId: job.id, label: job.label || 'No label', error: 'Job has no configuration. Cannot rerun jobs started from Dashboard without saved settings.' });
            continue;
          }
          const configResult = await this.jobConfig.getConfigurationById(job.configurationId);
          if (configResult.success && configResult.configuration && configResult.configuration.settings) {
            queuedJobs.push({
              jobId: job.id,
              label: job.label || 'No label',
              configuration: configResult.configuration.settings,
              configurationId: job.configurationId
            });
          } else {
            failedJobs.push({ jobId: job.id, label: job.label || 'No label', error: 'Job configuration not found or invalid. Cannot rerun without valid settings.' });
          }
        } catch (error) {
          failedJobs.push({ jobId: job.id, label: job.label || 'No label', error: error.message });
        }
      }
      if (queuedJobs.length === 0) {
        return { success: false, error: 'No jobs could be queued for rerun', failedJobs };
      }
      const firstJob = queuedJobs[0];
      const firstLabelBase = (firstJob?.configuration?.parameters?.label || firstJob?.label || '').toString().trim() || (firstJob?.configuration?.name || '').toString().trim();
      const newExecutionData = {
        configurationId: firstJob.configurationId,
        label: firstLabelBase ? `${firstLabelBase} (Rerun)` : 'Rerun Job',
        status: 'running'
      };
      const newExecution = await this.jobExecution.saveJobExecution(newExecutionData);
      if (!newExecution.success) {
        return { success: false, error: 'Failed to create job execution record', failedJobs };
      }
      const newExecutionId = newExecution.id ?? newExecution.execution?.id;
      this.jobRunner.persistedLabel = newExecutionData.label;
      try {
        const currentSettings = await this.getSettings();
        const apiKeys = currentSettings?.settings?.apiKeys || {};
        firstJob.configuration = { ...(firstJob.configuration || {}), apiKeys: { ...(firstJob.configuration?.apiKeys || {}), ...apiKeys } };
      } catch (e) {
        console.warn('Bulk rerun: failed to merge runtime API keys into configuration:', e.message);
      }
      try {
        const cfg = firstJob?.configuration || null;
        if (cfg) {
          // eslint-disable-next-line no-unused-vars
          const { apiKeys, ...sanitized } = cfg;
          if (sanitized && sanitized.parameters) {
            const adv = sanitized.parameters.runwareAdvanced || {};
            const advEnabled = Boolean(
              adv && (adv.CFGScale != null || adv.steps != null || (adv.scheduler && String(adv.scheduler).trim() !== '') || adv.checkNSFW === true || (Array.isArray(adv.lora) && adv.lora.length > 0))
            );
            sanitized.parameters.runwareAdvancedEnabled = advEnabled;
          }
          try {
            if (!sanitized.processing) sanitized.processing = {};
            const { normalizeRemoveBgFailureMode } = require('../utils/processing');
            const modeFromCfg = (firstJob.configuration && firstJob.configuration.processing && firstJob.configuration.processing.removeBgFailureMode) ? String(firstJob.configuration.processing.removeBgFailureMode) : undefined;
            const existing = (sanitized.processing && sanitized.processing.removeBgFailureMode) ? String(sanitized.processing.removeBgFailureMode) : undefined;
            const mode = modeFromCfg || existing;
            sanitized.processing.removeBgFailureMode = normalizeRemoveBgFailureMode(mode);
          } catch {
            // Ignore
          }
          await this.jobExecution.updateJobExecution(newExecutionId, {
            configurationId: firstJob.configurationId,
            status: 'running',
            configurationSnapshot: sanitized || null
          });
        }
      } catch (e) {
        console.warn(' Bulk rerun snapshot persistence failed (non-fatal):', e.message);
      }
      this.jobRunner.configurationId = firstJob.configurationId;
      this.jobRunner.databaseExecutionId = newExecutionId;
      this.jobRunner.isRerun = true;
      this.jobRunner.persistedLabel = newExecutionData.label;
      try {
        const params = (firstJob.configuration?.parameters || {});
        if (params.runwareAdvancedEnabled !== true) {
          const adv = params.runwareAdvanced || {};
          if (!Array.isArray(params.lora) && Array.isArray(adv.lora) && adv.lora.length > 0) params.lora = adv.lora;
          params.runwareAdvancedEnabled = false;
          if (params.runwareAdvanced) params.runwareAdvanced = {};
          firstJob.configuration.parameters = params;
        }
      } catch {
        // Ignore
      }
      const jobResult = await this.jobRunner.startJob(firstJob.configuration);
      if (jobResult.success) {
        const remainingJobs = queuedJobs.slice(1);
        if (remainingJobs.length > 0) {
          if (!global.bulkRerunQueue) global.bulkRerunQueue = [];
          global.bulkRerunQueue.push(...remainingJobs.map(job => ({
            ...job,
            originalJobIds: jobs.executions.map(j => j.id),
            queueTimestamp: new Date().toISOString()
          })));
        }
        return {
          success: true,
          startedJob: { jobId: firstJob.jobId, label: firstJob.label, newJobId: jobResult.jobId, newExecutionId: newExecutionId },
          queuedJobs: remainingJobs.length,
          totalJobs: jobs.executions.length,
          failedJobs: failedJobs.length,
          message: `Started rerun of ${firstJob.label || firstJob.jobId}. ${remainingJobs.length} jobs queued for sequential execution.`
        };
      }
      await this.jobExecution.updateJobExecution(newExecutionId, { status: 'failed' });
      return { success: false, error: `Failed to start job rerun: ${jobResult.error}`, failedJobs };
    } catch (error) {
      console.error('Error bulk rerunning job executions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process the next job in global.bulkRerunQueue (called when a job finishes).
   * @returns {Promise<{ success: boolean, message?: string, error?: string, jobId?: string, executionId?: string, remainingInQueue?: number }>}
   */
  async processNextBulkRerunJob() {
    try {
      if (!global.bulkRerunQueue || global.bulkRerunQueue.length === 0) {
        return { success: false, message: 'No jobs in queue' };
      }
      const currentStatus = await this.jobRunner.getJobStatus();
      if (currentStatus.status === 'running') {
        return { success: false, message: 'Another job is running' };
      }
      const nextJob = global.bulkRerunQueue.shift();
      const nextLabelBase = (nextJob?.configuration?.parameters?.label || nextJob?.label || '').toString().trim() || (nextJob?.configuration?.name || '').toString().trim();
      const newExecutionData = {
        configurationId: nextJob.configurationId,
        label: nextLabelBase ? `${nextLabelBase} (Rerun)` : 'Rerun Job',
        status: 'running'
      };
      const newExecution = await this.jobExecution.saveJobExecution(newExecutionData);
      if (!newExecution.success) {
        return { success: false, error: 'Failed to create execution record' };
      }
      const newExecutionId = newExecution.id ?? newExecution.execution?.id;
      try {
        const currentSettings = await this.getSettings();
        const apiKeys = currentSettings?.settings?.apiKeys || {};
        nextJob.configuration = { ...(nextJob.configuration || {}), apiKeys: { ...(nextJob.configuration?.apiKeys || {}), ...apiKeys } };
      } catch (e) {
        console.warn('Process next bulk rerun: failed to merge runtime API keys into configuration:', e.message);
      }
      this.jobRunner.configurationId = nextJob.configurationId;
      this.jobRunner.databaseExecutionId = newExecutionId;
      this.jobRunner.isRerun = true;
      this.jobRunner.persistedLabel = newExecutionData.label;
      try {
        const params = (nextJob.configuration?.parameters || {});
        if (params.runwareAdvancedEnabled !== true) {
          const adv = params.runwareAdvanced || {};
          if (!Array.isArray(params.lora) && Array.isArray(adv.lora) && adv.lora.length > 0) params.lora = adv.lora;
          params.runwareAdvancedEnabled = false;
          if (params.runwareAdvanced) params.runwareAdvanced = {};
          nextJob.configuration.parameters = params;
        }
      } catch {
        // Ignore
      }
      const jobResult = await this.jobRunner.startJob(nextJob.configuration);
      if (jobResult.success) {
        return {
          success: true,
          message: 'Queued job started successfully',
          jobId: jobResult.jobId,
          executionId: newExecutionId,
          remainingInQueue: global.bulkRerunQueue.length
        };
      }
      await this.jobExecution.updateJobExecution(newExecutionId, { status: 'failed' });
      return { success: false, error: jobResult.error };
    } catch (error) {
      console.error('Error processing next bulk rerun job:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { BulkRerunService };
