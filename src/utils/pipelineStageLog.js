/**
 * Visible pipeline boundaries for manual testing (e.g. WiFi cut between Runware, CDN download, remove.bg, QC, metadata).
 * - Invokes config.pipelineStageLog when provided (JobEngine → JobService buffer).
 * - In development (or PIPELINE_STAGE_LOG=true), prints one JSON line per call: grep [PIPELINE_STAGE]
 */

function shouldPrintConsole() {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false;
  if (process.env.PIPELINE_STAGE_LOG === 'false') return false;
  return process.env.NODE_ENV === 'development' || process.env.PIPELINE_STAGE_LOG === 'true';
}

function printConsole(subStep, message, metadata) {
  if (!shouldPrintConsole()) return;
  const payload = {
    subStep,
    message,
    ...metadata,
    t: new Date().toISOString()
  };
  console.info('[PIPELINE_STAGE]', JSON.stringify(payload));
}

/**
 * @param {Object|null|undefined} config - May carry pipelineStageLog(subStep, message, metadata)
 * @param {string} subStep - Stable machine id, e.g. runware_api_begin
 * @param {string} message - Short human summary
 * @param {Object} [metadata]
 */
function emitPipelineStage(config, subStep, message, metadata = {}) {
  const fn = config && config.pipelineStageLog;
  if (typeof fn === 'function') {
    try {
      fn(subStep, message, metadata);
    } catch (e) {
      console.warn('[PIPELINE_STAGE] pipelineStageLog failed:', e && e.message);
    }
  }
  printConsole(subStep, message, metadata);
}

module.exports = { emitPipelineStage, shouldPrintConsole };
