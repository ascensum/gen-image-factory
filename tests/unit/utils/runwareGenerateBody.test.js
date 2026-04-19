const {
  buildRunwareImageInferenceBody,
  buildRunwareTextVectorizeBody,
} = require('../../../src/utils/runwareGenerateBody');

describe('runwareGenerateBody', () => {
  const taskUUID = '650c5f43-2a43-4fd3-bf08-57d6fa14105d';

  it('buildRunwareTextVectorizeBody uses vectorize task and SVG output', () => {
    const body = buildRunwareTextVectorizeBody({
      taskUUID,
      runwareModel: 'recraft:v4@vector',
      positivePrompt: 'A logo',
      width: 1024,
      height: 1024,
    });
    expect(body).toEqual({
      taskType: 'vectorize',
      taskUUID,
      model: 'recraft:v4@vector',
      positivePrompt: 'A logo',
      outputType: 'URL',
      outputFormat: 'SVG',
      width: 1024,
      height: 1024,
    });
    expect(body).not.toHaveProperty('negativePrompt');
    expect(body).not.toHaveProperty('numberResults');
    expect(body).not.toHaveProperty('lora');
  });

  it('buildRunwareImageInferenceBody uses imageInference and optional negative prompt', () => {
    const body = buildRunwareImageInferenceBody({
      taskUUID,
      runwareModel: 'runware:101@1',
      positivePrompt: 'sunset',
      negativePromptSanitized: 'blur',
      numberResults: 2,
      outputFormat: 'png',
      width: 512,
      height: 512,
      loraEnabled: false,
      loraList: [],
      advanced: {},
    });
    expect(body.taskType).toBe('imageInference');
    expect(body.negativePrompt).toBe('blur');
    expect(body.numberResults).toBe(2);
    expect(body.outputFormat).toBe('png');
  });

  it('buildRunwareImageInferenceBody omits negativePrompt when unset', () => {
    const body = buildRunwareImageInferenceBody({
      taskUUID,
      runwareModel: 'runware:101@1',
      positivePrompt: 'x',
      negativePromptSanitized: undefined,
      numberResults: 1,
      outputFormat: 'webp',
      width: 768,
      height: 768,
      loraEnabled: false,
      loraList: [],
      advanced: {},
    });
    expect(body).not.toHaveProperty('negativePrompt');
  });
});
