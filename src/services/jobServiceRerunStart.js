/**
 * Legacy JobRunner.startJob for SingleRerunService / BulkRerunService (Story 5.3 wiring parity).
 */

async function startJobForExistingExecution(jobService, config) {
  const execId = jobService.databaseExecutionId;
  if (execId == null) {
    return { success: false, error: 'databaseExecutionId not set (rerun wiring)' };
  }
  if (jobService.currentExecutionId != null || jobService._backgroundPipelineActive) {
    return { success: false, error: 'A job is already running' };
  }
  const execRes = await jobService.jobRepository.getJobExecution(execId);
  if (!execRes.success || !execRes.execution) {
    return { success: false, error: 'Job execution not found' };
  }
  const ex = execRes.execution;

  jobService.currentExecutionId = execId;
  jobService.currentJobId = null;
  jobService.currentLabel =
    jobService.persistedLabel != null && String(jobService.persistedLabel).trim() !== ''
      ? jobService.persistedLabel
      : ex.label || 'Rerun Job';
  jobService.currentConfigurationId =
    jobService.configurationId != null ? jobService.configurationId : ex.configurationId;
  jobService.currentStartedAt = ex.startedAt ? new Date(ex.startedAt) : new Date();
  jobService.abortController = new AbortController();
  jobService._logBuffer = [];
  const gens = Math.max(1, Number(config?.parameters?.count || 1));
  const vars = Math.max(1, Math.min(20, Number(config?.parameters?.variations || 1)));
  jobService.liveProgress = {
    state: 'running',
    progress: 0,
    currentStep: 'starting',
    totalImages: 0,
    totalGenerations: gens,
    variations: vars,
    gensDone: 0
  };
  jobService._addLog('info', `Job started (rerun): ${gens} generation(s), ${vars} variation(s)`, {
    stepName: 'initialization',
    subStep: 'rerun_start',
    metadata: { generations: gens, variations: vars }
  });

  jobService._runJobInBackground(config);

  return { success: true, jobId: String(execId) };
}

module.exports = { startJobForExistingExecution };
