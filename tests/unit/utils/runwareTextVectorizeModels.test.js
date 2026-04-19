const {
  isRunwareTextVectorizeModel,
  RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER,
} = require('../../../src/utils/runwareTextVectorizeModels');

describe('runwareTextVectorizeModels', () => {
  it('isRunwareTextVectorizeModel is true for configured text-to-vector AIR ids (case-insensitive, trimmed)', () => {
    expect(isRunwareTextVectorizeModel('recraft:v4@vector')).toBe(true);
    expect(isRunwareTextVectorizeModel('  RECRAFT:V4@VECTOR  ')).toBe(true);
  });

  it('isRunwareTextVectorizeModel is false for standard imageInference models', () => {
    expect(isRunwareTextVectorizeModel('runware:101@1')).toBe(false);
    expect(isRunwareTextVectorizeModel('recraft:1@1')).toBe(false);
    expect(isRunwareTextVectorizeModel('')).toBe(false);
    expect(isRunwareTextVectorizeModel(null)).toBe(false);
  });

  it('exports non-empty settings helper copy', () => {
    expect(typeof RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER).toBe('string');
    expect(RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER.length).toBeGreaterThan(20);
    expect(RUNWARE_TEXT_VECTORIZE_SETTINGS_HELPER).toMatch(/vectorize/i);
  });
});
