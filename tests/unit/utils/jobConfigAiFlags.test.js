const {
  isTruthyAiFlag,
  isRunMetadataGenEnabledForJobConfig,
  isRunQualityCheckEnabledForJobConfig,
  isRunwareSvgOutputJobConfig,
} = require('../../../src/utils/jobConfigAiFlags');

describe('jobConfigAiFlags (main JobService pipeline only)', () => {
  it('isTruthyAiFlag coerces legacy string booleans', () => {
    expect(isTruthyAiFlag('TRUE')).toBe(true);
    expect(isTruthyAiFlag('false')).toBe(false);
  });

  it('isRunMetadataGenEnabledForJobConfig reads ai.runMetadataGen', () => {
    expect(isRunMetadataGenEnabledForJobConfig({ ai: { runMetadataGen: 'true' } })).toBe(true);
    expect(isRunMetadataGenEnabledForJobConfig({ ai: {} })).toBe(false);
  });

  it('isRunQualityCheckEnabledForJobConfig reads ai.runQualityCheck (not used by retry queue)', () => {
    expect(isRunQualityCheckEnabledForJobConfig({ ai: { runQualityCheck: 'true' } })).toBe(true);
  });

  it('isRunwareSvgOutputJobConfig is true when runwareFormat is svg or model is text-to-vector (Runware vectorize)', () => {
    expect(isRunwareSvgOutputJobConfig({ parameters: { runwareFormat: 'svg' } })).toBe(true);
    expect(isRunwareSvgOutputJobConfig({ parameters: { runwareFormat: 'SVG' } })).toBe(true);
    expect(isRunwareSvgOutputJobConfig({ parameters: { runwareFormat: 'png' } })).toBe(false);
    expect(isRunwareSvgOutputJobConfig({ parameters: {} })).toBe(false);
    expect(
      isRunwareSvgOutputJobConfig({
        parameters: { runwareFormat: 'png', runwareModel: 'recraft:v4@vector' },
      }),
    ).toBe(true);
  });
});
