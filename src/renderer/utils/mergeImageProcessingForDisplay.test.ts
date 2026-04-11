import { describe, it, expect } from 'vitest';
import { mergeImageProcessingForDisplay } from './mergeImageProcessingForDisplay';

describe('mergeImageProcessingForDisplay', () => {
  it('prefers per-image when it has known processing keys (custom retry / as-processed)', () => {
    const snap = { sharpening: 5, imageEnhancement: false };
    const per = { sharpening: 10, imageEnhancement: true };
    expect(mergeImageProcessingForDisplay(snap, per)).toMatchObject({ sharpening: 10, imageEnhancement: true });
  });

  it('prefers per-image even when values match snapshot (authoritative row)', () => {
    const snap = { sharpening: 5 };
    const per = { sharpening: 5 };
    expect(mergeImageProcessingForDisplay(snap, per)).toMatchObject({ sharpening: 5 });
  });

  it('uses snapshot when per-image has no known keys', () => {
    const snap = { removeBg: true, removeBgSize: 'full' };
    expect(mergeImageProcessingForDisplay(snap, null)).toMatchObject(snap);
  });

  it('uses snapshot when per-image is empty object', () => {
    const snap = { imageConvert: true, convertToWebp: true };
    expect(mergeImageProcessingForDisplay(snap, {})).toMatchObject(snap);
  });

  it('parses JSON string per-image', () => {
    const snap = { sharpening: 1 };
    const json = JSON.stringify({ sharpening: 9 });
    expect(mergeImageProcessingForDisplay(snap, json)).toMatchObject({ sharpening: 9 });
  });
});
