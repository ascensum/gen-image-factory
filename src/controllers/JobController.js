/**
 * JobController - IPC Handler Registration for Job-related operations
 *
 * ADR-002: All handlers < 5 lines, thin adapters only.
 * ADR-003: Dependency Injection - accepts modular services, not backendAdapter.
 * Story 5.3: Decommissioned backendAdapter dependency.
 */

const { safeLogger } = require('../utils/logMasking');

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Object} deps - Injected service dependencies
 * @param {Object} deps.jobService
 * @param {Object} deps.jobRepository
 * @param {Object} deps.imageRepository
 * @param {Object} deps.settingsComposer
 * @param {Object} deps.bulkRerunService
 * @param {Object} deps.singleRerunService
 * @param {Object} deps.retryQueueService
 * @param {Object} deps.jobListService
 * @param {Object} deps.errorTranslation
 */
function registerJobHandlers(ipcMain, deps) {
  safeLogger.log('JobController: Registering job:* IPC handlers');

  const {
    jobService, jobRepository, imageRepository, settingsComposer,
    bulkRerunService, singleRerunService, retryQueueService,
    jobListService, errorTranslation
  } = deps;

  // ── Job Control ──

  ipcMain.handle('job:start', async (_event, config) => {
    try {
      const isTestEnv = process.env.VITEST || process.env.NODE_ENV === 'test';
      const normalizedConfig = await settingsComposer.prepareJobConfig(config);

      if (!isTestEnv) {
        const apiKeys = normalizedConfig.apiKeys || {};
        if (!apiKeys.openai || apiKeys.openai.trim() === '') {
          return { success: false, error: 'OpenAI API key is required to start a job', code: 'JOB_CONFIGURATION_ERROR' };
        }
      }

      const { configId, label } = await settingsComposer.saveJobConfiguration(normalizedConfig);
      const executionId = await jobService.startJobAsync(normalizedConfig, { configurationId: configId, label });
      return { success: true, executionId };
    } catch (error) {
      console.error('job:start failed:', error);
      const te = errorTranslation.createJobError('unknown', error, 'JOB_START_ERROR');
      return { success: false, error: te.userMessage, code: te.code };
    }
  });

  ipcMain.handle('job:stop', async () => jobService.stopJob());

  ipcMain.handle('job:force-stop', async () => jobService.stopJob());

  ipcMain.handle('job:force-stop-all', async () => jobService.stopJob());

  ipcMain.handle('job:get-status', async () => {
    const lp = jobService.liveProgress || {};
    const isRunning = !!jobService.currentExecutionId;
    const rawProgress = lp.progress || 0;
    return {
      state: isRunning ? 'running' : (lp.state || 'idle'),
      currentJob: isRunning ? {
        executionId: jobService.currentExecutionId,
        label: jobService.currentLabel || '',
        configurationName: jobService.currentLabel || '',
        totalGenerations: lp.totalGenerations || 1,
        variations: lp.variations || 1,
        gensDone: lp.gensDone || 0
      } : null,
      progress: rawProgress / 100,
      currentStep: lp.currentStep || '',
      totalSteps: lp.totalImages || 0,
      startTime: null,
      estimatedTimeRemaining: null
    };
  });

  ipcMain.handle('job:get-progress', async () => {
    const lp = jobService.liveProgress || {};
    const rawProgress = lp.progress || 0;
    return {
      progress: rawProgress / 100,
      currentStep: lp.currentStep || '',
      totalSteps: lp.totalImages || 0,
      stepName: lp.currentStep || '',
      estimatedTimeRemaining: null
    };
  });

  ipcMain.handle('job:get-logs', async (_event, mode) =>
    jobService.getLogs(mode || 'standard')
  );

  // ── Job Execution CRUD ──

  ipcMain.handle('job-execution:save', async (_event, execution) =>
    jobRepository.saveJobExecution(execution));

  ipcMain.handle('job-execution:get', async (_event, id) =>
    jobRepository.getJobExecution(id));

  ipcMain.handle('job-execution:get-all', async () =>
    jobRepository.getAllJobExecutions());

  ipcMain.handle('job-execution:update', async (_event, id, execution) =>
    jobRepository.updateJobExecution(id, execution));

  ipcMain.handle('job-execution:delete', async (_event, { jobId }) =>
    jobRepository.deleteJobExecution(jobId));

  ipcMain.handle('job-execution:statistics', async () =>
    jobRepository.getJobStatistics());

  ipcMain.handle('job-execution:history', async (_event, limit) =>
    jobRepository.getJobHistory(limit));

  ipcMain.handle('job-execution:calculate-statistics', async (_event, executionId) =>
    jobRepository.calculateJobExecutionStatistics(executionId));

  ipcMain.handle('job-execution:update-statistics', async (_event, executionId) =>
    jobRepository.updateJobExecutionStatistics(executionId));

  ipcMain.handle('job-execution:rename', async (_event, id, label) =>
    jobRepository.renameJobExecution(id, label));

  ipcMain.handle('job-execution:bulk-delete', async (_event, ids) =>
    jobRepository.bulkDeleteJobExecutions(ids));

  ipcMain.handle('job-execution:bulk-rerun', async (_event, ids) =>
    bulkRerunService.bulkRerunJobExecutions(ids));

  ipcMain.handle('job-execution:process-next-bulk-rerun', async () =>
    bulkRerunService.processNextBulkRerunJob());

  ipcMain.handle('job-execution:get-bulk-rerun-queue-size', async () => {
    try {
      const ids = bulkRerunService.getPendingRerunExecutionIds();
      return { success: true, count: Array.isArray(ids) ? ids.length : 0 };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('job-execution:rerun', async (_event, id) =>
    singleRerunService.rerunJobExecution(id));

  ipcMain.handle('get-job-executions-with-filters', async (_event, filters, page = 1, pageSize = 25) => {
    try { return await jobListService.getJobExecutionsWithFilters(filters, page, pageSize); }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('get-job-executions-count', async (_event, filters) => {
    try { return await jobListService.getJobExecutionsCount(filters); }
    catch (error) { return { success: false, error: error.message }; }
  });

  // Legacy handler aliases
  ipcMain.handle('get-job-history', async (_event, limit) =>
    jobRepository.getJobHistory(limit));

  ipcMain.handle('get-job-results', async (_event, jobId) =>
    imageRepository.getGeneratedImagesByExecution(jobId));

  ipcMain.handle('delete-job-execution', async (_event, jobId) =>
    jobRepository.deleteJobExecution(jobId));

  // ── Generated Images ──

  ipcMain.handle('generated-image:save', async (_event, image) =>
    imageRepository.saveGeneratedImage(image));

  ipcMain.handle('generated-image:get', async (_event, { id }) =>
    imageRepository.getGeneratedImage(id));

  ipcMain.handle('generated-image:get-by-execution', async (_event, executionId) => {
    try { return await imageRepository.getGeneratedImagesByExecution(executionId); }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('generated-image:get-all', async (_event, options = {}) =>
    imageRepository.getAllGeneratedImages(options.limit || 100));

  ipcMain.handle('generated-image:update', async (_event, { id, image }) =>
    imageRepository.updateGeneratedImage(id, image));

  ipcMain.handle('generated-image:delete', async (_event, { imageId }) =>
    imageRepository.deleteGeneratedImage(imageId));

  ipcMain.handle('generated-image:bulk-delete', async (_event, { imageIds }) =>
    imageRepository.bulkDeleteGeneratedImages(imageIds));

  ipcMain.handle('generated-image:get-by-qc-status', async (_event, { qcStatus, limit, offset }) =>
    imageRepository.findByQcStatus(qcStatus, { limit, offset }));

  ipcMain.handle('generated-image:update-qc-status', async (_event, { imageId, status }) =>
    imageRepository.updateQCStatus(imageId, status));

  ipcMain.handle('generated-image:update-qc-status-by-mapping', async (_event, { mappingId, status, reason }) =>
    imageRepository.updateQCStatusByMappingId(mappingId, status, reason));

  ipcMain.handle('generated-image:update-by-mapping', async (_event, { mappingId, image }) =>
    imageRepository.updateGeneratedImageByMappingId(mappingId, image));

  ipcMain.handle('generated-image:metadata', async (_event, executionId) =>
    imageRepository.getImageMetadata(executionId));

  ipcMain.handle('generated-image:statistics', async () =>
    imageRepository.getImageStatistics());

  ipcMain.handle('generated-image:manual-approve', async (_event, { imageId }) =>
    imageRepository.updateQCStatus(imageId, 'approved'));

  // ── Failed Image Retry ──

  ipcMain.handle('failed-image:retry-original', async (_event, { imageId }) => {
    try {
      const result = await retryQueueService.addToQueue(imageId, { useOriginalSettings: true });
      return { success: result.success, error: result.error };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('failed-image:retry-modified', async (_event, { imageId, settings }) => {
    try {
      const result = await retryQueueService.addToQueue(imageId, {
        useOriginalSettings: false,
        modifiedSettings: settings
      });
      return { success: result.success, error: result.error };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('failed-image:retry-batch', async (_event, body) => {
    try {
      await validateRetryBatchSameExecutionForOriginal(imageRepository, body);
      const result = await retryQueueService.addBatchRetryJob({
        type: 'retry',
        imageIds: body.imageIds,
        useOriginalSettings: body.useOriginalSettings,
        modifiedSettings: body.modifiedSettings,
        includeMetadata: body.includeMetadata,
        failOptions: body.failOptions
      });
      return { success: result.success, error: result.error };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('failed-image:get-queue-status', async () => ({
    success: true,
    queueStatus: retryQueueService.getQueueStatus()
  }));

  safeLogger.log('JobController: Job IPC handlers registered');
}

/**
 * Original-settings retry assumes one shared job config snapshot; mixed executions are invalid.
 */
async function validateRetryBatchSameExecutionForOriginal(imageRepository, body) {
  const { useOriginalSettings, imageIds } = body || {};
  if (useOriginalSettings !== true || !Array.isArray(imageIds) || imageIds.length < 2) return;
  const keys = new Set();
  for (const imageId of imageIds) {
    const res = await imageRepository.getGeneratedImage(imageId);
    if (!res.success || !res.image) {
      throw new Error(`Image not found: ${imageId}`);
    }
    const eid = res.image.executionId;
    keys.add(eid == null ? '__no_execution__' : String(eid));
  }
  if (keys.size > 1) {
    throw new Error(
      'Retry with original settings is only available when all selected images belong to the same job execution. ' +
      'Use Retry with custom settings for a mixed selection.'
    );
  }
}

module.exports = { registerJobHandlers };
