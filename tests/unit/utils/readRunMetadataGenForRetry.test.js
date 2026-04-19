const { readRunMetadataGenForRetry, isRunMetadataGenTruthy } = require('../../../src/utils/readRunMetadataGenForRetry');

describe('readRunMetadataGenForRetry', () => {
  it('prefers executionSnapshot.ai when key present', () => {
    expect(
      readRunMetadataGenForRetry(
        { ai: { runMetadataGen: true }, settings: { ai: { runMetadataGen: false } } },
        { settings: { ai: { runMetadataGen: false } } }
      )
    ).toBe(true);
  });

  it('reads settings.ai on snapshot when top-level ai omits key', () => {
    expect(
      readRunMetadataGenForRetry({ settings: { ai: { runMetadataGen: 'true' } } }, {})
    ).toBe(true);
  });

  it('falls back to jobConfiguration.settings.ai', () => {
    expect(readRunMetadataGenForRetry(null, { settings: { ai: { runMetadataGen: 1 } } })).toBe(true);
  });

  it('reads jobConfiguration.ai when nested settings missing', () => {
    expect(readRunMetadataGenForRetry(null, { ai: { runMetadataGen: false } })).toBe(false);
  });

  it('returns false when nothing defines the flag', () => {
    expect(readRunMetadataGenForRetry({}, { settings: {} })).toBe(false);
  });
});

describe('isRunMetadataGenTruthy', () => {
  it('coerces common legacy values', () => {
    expect(isRunMetadataGenTruthy('TRUE')).toBe(true);
    expect(isRunMetadataGenTruthy('yes')).toBe(true);
    expect(isRunMetadataGenTruthy('false')).toBe(false);
    expect(isRunMetadataGenTruthy(false)).toBe(false);
  });
});
