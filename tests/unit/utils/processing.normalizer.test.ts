import { describe, it, expect } from 'vitest';

// Use CommonJS require since the util exports via module.exports
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { normalizeProcessingSettings, normalizeRemoveBgFailureMode } = require('../../../src/utils/processing');

describe('normalizeProcessingSettings', () => {
  it('clamps pngQuality to 1-100 and coerces string numbers', () => {
    expect(normalizeProcessingSettings({ pngQuality: -5 }).pngQuality).toBe(1);
    expect(normalizeProcessingSettings({ pngQuality: 0 }).pngQuality).toBe(1);
    expect(normalizeProcessingSettings({ pngQuality: 101 }).pngQuality).toBe(100);
    expect(normalizeProcessingSettings({ pngQuality: '73' }).pngQuality).toBe(73);
    expect(normalizeProcessingSettings({}).pngQuality).toBeUndefined();
  });

  it('clamps jpgQuality to 1-100 and defaults to 90 for invalid', () => {
    expect(normalizeProcessingSettings({ jpgQuality: -1 }).jpgQuality).toBe(1);
    expect(normalizeProcessingSettings({ jpgQuality: 150 }).jpgQuality).toBe(100);
    expect(normalizeProcessingSettings({ jpgQuality: '42' }).jpgQuality).toBe(42);
  });

  it('clamps sharpening to 0-100 and rounds', () => {
    expect(normalizeProcessingSettings({ sharpening: -3 }).sharpening).toBe(0);
    expect(normalizeProcessingSettings({ sharpening: 101 }).sharpening).toBe(100);
    expect(normalizeProcessingSettings({ sharpening: 9.7 }).sharpening).toBe(10);
  });

  it('clamps saturation to 0-3 and preserves decimals', () => {
    expect(normalizeProcessingSettings({ saturation: -1 }).saturation).toBe(0);
    expect(normalizeProcessingSettings({ saturation: 4.5 }).saturation).toBe(3);
    expect(normalizeProcessingSettings({ saturation: '1.4' }).saturation).toBe(1.4);
  });

  it('casts booleans for flags', () => {
    const out = normalizeProcessingSettings({ imageEnhancement: '1', imageConvert: 0, convertToJpg: 'true', removeBg: '', trimTransparentBackground: 123 });
    expect(out.imageEnhancement).toBe(true);
    expect(out.imageConvert).toBe(false);
    // convertToJpg forced false when imageConvert is false
    expect(out.convertToJpg).toBe(false);
    expect(out.removeBg).toBe(false);
    expect(out.trimTransparentBackground).toBe(true);
  });

  it('forces convertToJpg=false when imageConvert=false', () => {
    const out = normalizeProcessingSettings({ imageConvert: false, convertToJpg: true });
    expect(out.imageConvert).toBe(false);
    expect(out.convertToJpg).toBe(false);
  });

  it('normalizes removeBgSize to allowed values (auto, full, 4k)', () => {
    expect(normalizeProcessingSettings({ removeBgSize: 'FULL' }).removeBgSize).toBe('full');
    expect(normalizeProcessingSettings({ removeBgSize: '4k' }).removeBgSize).toBe('4k');
    expect(normalizeProcessingSettings({ removeBgSize: 'weird' }).removeBgSize).toBe('auto');
    expect(normalizeProcessingSettings({}).removeBgSize).toBeUndefined();
  });

  it('defaults jpgBackground to #FFFFFF if not a string', () => {
    expect(normalizeProcessingSettings({ jpgBackground: 123 }).jpgBackground).toBe('#FFFFFF');
    expect(normalizeProcessingSettings({ jpgBackground: 'white' }).jpgBackground).toBe('white');
  });

  it('ignores unknown keys', () => {
    // @ts-expect-error test unknown key
    const out = normalizeProcessingSettings({ foo: 'bar', pngQuality: 10 });
    // @ts-expect-error test unknown key
    expect(out.foo).toBeUndefined();
    expect(out.pngQuality).toBe(10);
  });

  it('normalizes removeBgFailureMode: maps Settings vocabulary (fail/soft) to backend (mark_failed/approve)', () => {
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'fail' }).removeBgFailureMode).toBe('mark_failed');
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'soft' }).removeBgFailureMode).toBe('approve');
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'mark_failed' }).removeBgFailureMode).toBe('mark_failed');
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'approve' }).removeBgFailureMode).toBe('approve');
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'FAIL' }).removeBgFailureMode).toBe('mark_failed');
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'SOFT' }).removeBgFailureMode).toBe('approve');
    expect(normalizeProcessingSettings({ removeBgFailureMode: 'unknown' }).removeBgFailureMode).toBe('approve');
    expect(normalizeProcessingSettings({}).removeBgFailureMode).toBeUndefined();
  });
});

describe('normalizeRemoveBgFailureMode', () => {
  it('maps fail and mark_failed to mark_failed', () => {
    expect(normalizeRemoveBgFailureMode('fail')).toBe('mark_failed');
    expect(normalizeRemoveBgFailureMode('mark_failed')).toBe('mark_failed');
    expect(normalizeRemoveBgFailureMode('FAIL')).toBe('mark_failed');
  });

  it('maps soft and approve to approve', () => {
    expect(normalizeRemoveBgFailureMode('soft')).toBe('approve');
    expect(normalizeRemoveBgFailureMode('approve')).toBe('approve');
    expect(normalizeRemoveBgFailureMode('SOFT')).toBe('approve');
  });

  it('defaults unknown or empty to approve', () => {
    expect(normalizeRemoveBgFailureMode('')).toBe('approve');
    expect(normalizeRemoveBgFailureMode(undefined)).toBe('approve');
    expect(normalizeRemoveBgFailureMode('other')).toBe('approve');
  });
});


