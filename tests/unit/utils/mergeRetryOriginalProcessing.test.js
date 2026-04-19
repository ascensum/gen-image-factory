import { describe, it, expect } from 'vitest';

const {
  mergeRetryOriginalProcessing,
  mergeOriginalRetryProcessingUniform,
  getExecutionSnapshotProcessing,
} = require('../../../src/utils/mergeRetryOriginalProcessing.js');

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

describe('mergeOriginalRetryProcessingUniform', () => {
  it('ignores sparse per-image blob when execution snapshot defines processing (same job for all rows)', () => {
    const snapshot = { removeBg: true, removeBgSize: 'full', imageConvert: true, convertToJpg: true };
    const perImage = { removeBg: false };
    const cfg = { jpgQuality: 90 };
    const out = mergeOriginalRetryProcessingUniform(snapshot, cfg, perImage);
    expect(out.removeBg).toBe(true);
    expect(out.removeBgSize).toBe('full');
    expect(out.imageConvert).toBe(true);
    expect(out.jpgQuality).toBe(90);
  });

  it('falls back to legacy merge when snapshot has no pipeline toggles', () => {
    const out = mergeOriginalRetryProcessingUniform(
      {},
      { removeBg: false },
      JSON.stringify({ removeBg: true })
    );
    expect(out.removeBg).toBe(true);
  });

  it('reads processing from settings.processing when top-level processing is absent', () => {
    const exec = { settings: { processing: { removeBg: true, imageConvert: true } } };
    const snapProc = getExecutionSnapshotProcessing(exec);
    const out = mergeOriginalRetryProcessingUniform(snapProc, { jpgQuality: 88 }, { removeBg: false });
    expect(out.removeBg).toBe(true);
    expect(out.imageConvert).toBe(true);
    expect(out.jpgQuality).toBe(88);
  });
});

describe('getExecutionSnapshotProcessing', () => {
  it('prefers top-level processing over nested settings.processing', () => {
    const p = getExecutionSnapshotProcessing({
      processing: { removeBg: true },
      settings: { processing: { removeBg: false } },
    });
    expect(p.removeBg).toBe(true);
  });
});
