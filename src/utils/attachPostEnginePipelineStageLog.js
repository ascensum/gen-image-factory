/**
 * After JobEngine.executeJob, wire config.pipelineStageLog so PostGenerationService emits the same
 * [PIPELINE_STAGE] signals as the in-engine pipeline (metadata, QC, deferred remove.bg).
 *
 * @param {Object} config - Job configuration object (mutated)
 * @param {Function} addLog - JobService._addLog(level, message, opts)
 */
function attachPostEnginePipelineStageLog(config, addLog) {
  config.pipelineStageLog = (subStep, message, metadata = {}) => {
    addLog('info', message, {
      stepName: 'image_pipeline',
      subStep,
      metadata: { ...metadata, scope: 'post_engine' }
    });
  };
}

module.exports = { attachPostEnginePipelineStageLog };
