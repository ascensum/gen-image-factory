const {
  isTruthyAiFlag,
  isRunMetadataGenEnabledForJobConfig,
  isRunQualityCheckEnabledForJobConfig,
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
});
