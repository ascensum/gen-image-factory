function logDebug(...args) {
  // Check the environment variable every time the function is called
  const isDebugMode = process.env.DEBUG_MODE === 'true';
  if (isDebugMode) {
    // Don't use console.log - it gets mixed with structured logs
    // Instead, emit a structured log event if we're in a job context
    if (global.currentJobRunner && global.currentJobRunner._logStructured) {
      global.currentJobRunner._logStructured({
        level: 'debug',
        stepName: 'ai_vision',
        subStep: 'debug',
        message: args.join(' '),
        metadata: { source: 'aiVision', args }
      });
    }
    // Fallback to console.log only in non-job contexts (CLI, etc.)
    else {
      console.log(...args);
    }
  }
}

module.exports = { logDebug }; 