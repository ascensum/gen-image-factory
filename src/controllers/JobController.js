/**
 * JobController - IPC Handler Registration for Job-related operations
 * 
 * Architectural Requirements (ADR-002):
 * - All handlers must be < 5 lines
 * - Handlers are thin adapters - no business logic
 * - All validation, transformation, and business logic belongs in Services
 * 
 * Pattern:
 * ```javascript
 * ipcMain.handle('job:start', (event, args) => 
 *   jobService.start(args)
 * )
 * ```
 * 
 * Responsibility: Map Electron IPC events to BackendAdapter service calls
 * Extracted from: backendAdapter.js (lines ~480-512, ~657-742)
 * Related ADRs: ADR-002 (Vertical Slice IPC), ADR-003 (Dependency Injection)
 */

const { safeLogger } = require('../utils/logMasking');

/**
 * Register all job:* IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main interface
 * @param {BackendAdapter} backendAdapter - Backend service adapter
 */
function registerJobHandlers(ipcMain, backendAdapter) {
  safeLogger.log('JobController: Registering job:* IPC handlers');

  // Job Control Handlers
  ipcMain.handle('job:start', async (event, config) => {
    return await backendAdapter.startJob(config);
  });

  ipcMain.handle('job:stop', async () => {
    return await backendAdapter.stopJob();
  });

  ipcMain.handle('job:force-stop', async () => {
    return await backendAdapter.forceStopAll();
  });

  ipcMain.handle('job:force-stop-all', async () => {
    return await backendAdapter.forceStopAll();
  });

  ipcMain.handle('job:get-status', async () => {
    return await backendAdapter.getJobStatus();
  });

  ipcMain.handle('job:get-progress', async () => {
    return await backendAdapter.getJobProgress();
  });

  ipcMain.handle('job:get-logs', async (event, mode = 'standard') => {
    return await backendAdapter.getJobLogs(mode);
  });

  // Job Execution Handlers
  ipcMain.handle('job-execution:save', async (event, execution) => {
    return await backendAdapter.saveJobExecution(execution);
  });

  ipcMain.handle('job-execution:get', async (event, id) => {
    return await backendAdapter.jobExecution.getJobExecution(id);
  });

  ipcMain.handle('job-execution:get-all', async (event, options = {}) => {
    return await backendAdapter.getAllJobExecutions(options);
  });

  ipcMain.handle('job-execution:update', async (event, id, execution) => {
    return await backendAdapter.updateJobExecution(id, execution);
  });

  ipcMain.handle('job-execution:delete', async (event, { jobId }) => {
    return await backendAdapter.deleteJobExecution(jobId);
  });

  ipcMain.handle('job-execution:statistics', async () => {
    return await backendAdapter.getJobStatistics();
  });

  ipcMain.handle('job-execution:history', async (event, limit) => {
    return await backendAdapter.getJobHistory(limit);
  });

  ipcMain.handle('job-execution:calculate-statistics', async (event, executionId) => {
    return await backendAdapter.calculateJobExecutionStatistics(executionId);
  });

  ipcMain.handle('job-execution:update-statistics', async (event, executionId) => {
    return await backendAdapter.updateJobExecutionStatistics(executionId);
  });

  ipcMain.handle('job-execution:rename', async (event, id, label) => {
    return await backendAdapter.renameJobExecution(id, label);
  });

  ipcMain.handle('job-execution:bulk-delete', async (event, ids) => {
    return await backendAdapter.bulkDeleteJobExecutions(ids);
  });

  ipcMain.handle('job-execution:bulk-rerun', async (event, ids) => {
    return await backendAdapter.bulkRerunJobExecutions(ids);
  });

  ipcMain.handle('job-execution:process-next-bulk-rerun', async () => {
    return await backendAdapter.processNextBulkRerunJob();
  });

  ipcMain.handle('job-execution:get-bulk-rerun-queue-size', async () => {
    return await backendAdapter.ensureInitialized().then(() => {
      const size = (global.bulkRerunQueue && Array.isArray(global.bulkRerunQueue)) 
        ? global.bulkRerunQueue.length 
        : 0;
      return { success: true, count: size };
    }).catch(error => ({ success: false, error: error.message }));
  });

  ipcMain.handle('job-execution:rerun', async (event, id) => {
    return await backendAdapter.rerunJobExecution(id);
  });

  ipcMain.handle('get-job-executions-with-filters', async (event, filters, page = 1, pageSize = 25) => {
    return await backendAdapter.ensureInitialized().then(() => 
      backendAdapter.jobExecution.getJobExecutionsWithFilters(filters, page, pageSize)
    ).catch(error => ({ success: false, error: error.message }));
  });

  ipcMain.handle('get-job-executions-count', async (event, filters) => {
    return await backendAdapter.ensureInitialized().then(() => 
      backendAdapter.jobExecution.getJobExecutionsCount(filters)
    ).catch(error => ({ success: false, error: error.message }));
  });

  // Job Management (Legacy Handlers)
  ipcMain.handle('get-job-history', async (event, limit) => {
    return await backendAdapter.getJobHistory(limit);
  });

  ipcMain.handle('get-job-results', async (event, jobId) => {
    return await backendAdapter.getJobResults(jobId);
  });

  ipcMain.handle('delete-job-execution', async (event, jobId) => {
    return await backendAdapter.deleteJobExecution(jobId);
  });

  // Generated Image Handlers
  ipcMain.handle('generated-image:save', async (event, image) => {
    return await backendAdapter.saveGeneratedImage(image);
  });

  ipcMain.handle('generated-image:get', async (event, { id }) => {
    return await backendAdapter.getGeneratedImage(id);
  });

  ipcMain.handle('generated-image:get-by-execution', async (event, executionId) => {
    return await backendAdapter.ensureInitialized().then(() => 
      backendAdapter.generatedImage.getGeneratedImagesByExecution(executionId)
    ).catch(error => ({ success: false, error: error.message }));
  });

  ipcMain.handle('generated-image:get-all', async (event, options = {}) => {
    return await backendAdapter.getAllGeneratedImages(options.limit || 100);
  });

  ipcMain.handle('generated-image:update', async (event, { id, image }) => {
    return await backendAdapter.updateGeneratedImage(id, image);
  });

  ipcMain.handle('generated-image:delete', async (event, { imageId }) => {
    return await backendAdapter.deleteGeneratedImage(imageId);
  });

  ipcMain.handle('generated-image:bulk-delete', async (event, { imageIds }) => {
    return await backendAdapter.bulkDeleteGeneratedImages(imageIds);
  });

  ipcMain.handle('generated-image:get-by-qc-status', async (event, { qcStatus, limit, offset }) => {
    return await backendAdapter.getImagesByQCStatus(qcStatus, { limit, offset });
  });

  ipcMain.handle('generated-image:update-qc-status', async (event, { imageId, status }) => {
    return await backendAdapter.updateQCStatus(imageId, status);
  });

  ipcMain.handle('generated-image:update-qc-status-by-mapping', async (event, { mappingId, status, reason }) => {
    return await backendAdapter.updateQCStatusByMappingId(mappingId, status, reason);
  });

  ipcMain.handle('generated-image:update-by-mapping', async (event, { mappingId, image }) => {
    return await backendAdapter.updateGeneratedImageByMappingId(mappingId, image);
  });

  ipcMain.handle('generated-image:metadata', async (event, executionId) => {
    return await backendAdapter.getImageMetadata(executionId);
  });

  ipcMain.handle('generated-image:statistics', async () => {
    return await backendAdapter.getImageStatistics();
  });

  ipcMain.handle('generated-image:manual-approve', async (event, { imageId }) => {
    return await backendAdapter.manualApproveImage(imageId);
  });

  // Failed Image Retry Handlers
  ipcMain.handle('failed-image:retry-original', async (event, { imageId }) => {
    return await backendAdapter.retryFailedImageWithOriginalSettings(imageId);
  });

  ipcMain.handle('failed-image:retry-modified', async (event, { imageId, settings }) => {
    return await backendAdapter.retryFailedImageWithModifiedSettings(imageId, settings);
  });

  ipcMain.handle('failed-image:retry-batch', async (event, { imageIds, useOriginalSettings, modifiedSettings, includeMetadata, failOptions }) => {
    return await backendAdapter.retryFailedImagesBatch(imageIds, useOriginalSettings, modifiedSettings, includeMetadata, failOptions);
  });

  ipcMain.handle('failed-image:get-queue-status', async () => {
    return await backendAdapter.getRetryQueueStatus();
  });

  safeLogger.log('JobController: Job IPC handlers registered');
}

module.exports = { registerJobHandlers };
