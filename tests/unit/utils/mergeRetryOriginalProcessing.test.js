import { describe, it, expect } from 'vitest';

const { mergeRetryOriginalProcessing } = require('../../../src/utils/mergeRetryOriginalProcessing.js');

describe('mergeRetryOriginalProcessing', () => {
  it('prefers per-image blob when it has known keys', () => {
    const out = mergeRetryOriginalProcessing(
      { removeBg: false, imageConvert: true },
      { removeBg: true, removeBgSize: 'full' }
    );
    expect(out.removeBg).toBe(true);
    expect(out.removeBgSize).toBe('full');
  });

  it('falls back to snapshot when per-image has no known keys', () => {
    const out = mergeRetryOriginalProcessing(
      { removeBg: true, imageEnhancement: true },
      null
    );
    expect(out.removeBg).toBe(true);
    expect(out.imageEnhancement).toBe(true);
  });

  it('parses string per-image settings', () => {
    const out = mergeRetryOriginalProcessing(null, JSON.stringify({ imageConvert: true, convertToJpg: true }));
    expect(out.imageConvert).toBe(true);
  });
});
