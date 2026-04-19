/**
 * Runware POST /v1/images/generate task bodies (ADR-008).
 * `imageInference` vs text-to-SVG `vectorize` use different `taskType` + fields per Runware docs.
 */

function buildRunwareImageInferenceBody(params) {
  const {
    taskUUID,
    runwareModel,
    positivePrompt,
    negativePromptSanitized,
    numberResults,
    outputFormat,
    width,
    height,
    loraEnabled,
    loraList,
    advanced,
  } = params;

  const lora =
    loraEnabled && Array.isArray(loraList) && loraList.length > 0
      ? loraList.filter((x) => x && x.model).map((x) => ({ model: x.model, weight: Number(x.weight) || 1 }))
      : null;

  return {
    taskType: 'imageInference',
    taskUUID,
    model: runwareModel,
    positivePrompt,
    ...(negativePromptSanitized ? { negativePrompt: negativePromptSanitized } : {}),
    numberResults,
    outputType: 'URL',
    outputFormat,
    width,
    height,
    ...(lora && lora.length > 0 ? { lora } : {}),
    ...(typeof advanced.checkNSFW === 'boolean' ? { checkNSFW: !!advanced.checkNSFW } : {}),
    ...(advanced.scheduler ? { scheduler: String(advanced.scheduler) } : {}),
    ...(Number.isFinite(Number(advanced.CFGScale)) ? { CFGScale: Number(advanced.CFGScale) } : {}),
    ...(Number.isFinite(Number(advanced.steps)) ? { steps: Number(advanced.steps) } : {}),
  };
}

/** Text-to-SVG vectorize (e.g. Recraft V4 Vector). No providerSettings, no image inputs. */
function buildRunwareTextVectorizeBody(params) {
  const { taskUUID, runwareModel, positivePrompt, width, height } = params;
  return {
    taskType: 'vectorize',
    taskUUID,
    model: String(runwareModel || '').trim(),
    positivePrompt,
    outputType: 'URL',
    outputFormat: 'SVG',
    width,
    height,
  };
}

module.exports = {
  buildRunwareImageInferenceBody,
  buildRunwareTextVectorizeBody,
};
