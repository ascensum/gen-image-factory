/**
 * Clears in-process job runner state and emits terminal events after _runJobInBackground.
 * Emits only after clearing ids so getJobStatus() (no-arg) is idle for bulk rerun chain.
 */

function finalizeBackgroundRun(jobService, { successResult, lastError }) {
  jobService._backgroundPipelineActive = false;
  jobService.databaseExecutionId = null;
  jobService.configurationId = null;
  jobService.persistedLabel = null;
  jobService.isRerun = false;
  jobService.currentExecutionId = null;
  jobService.currentJobId = null;
  jobService.currentLabel = null;
  jobService.currentConfigurationId = null;
  jobService.currentStartedAt = null;
  jobService.abortController = null;

  if (successResult) {
    jobService.liveProgress = {
      state: 'completed',
      progress: 100,
      currentStep: 'completed',
      totalImages: successResult.totalImages || 0
    };
    jobService.emit('job-complete', successResult);
  } else if (lastError) {
    jobService.emit('job-failed', { error: lastError.message });
  }
}

module.exports = { finalizeBackgroundRun };
