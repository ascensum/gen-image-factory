import { describe, it, expect } from 'vitest';

const {
  imageHadSuccessfulGeneration,
  countImagesGeneratedSuccessfully,
} = require('../../../src/utils/jobExecutionOutcome.js');

describe('jobExecutionOutcome', () => {
  it('counts approved with paths', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'approved',
        tempImagePath: '/tmp/a.png',
        finalImagePath: null,
      })
    ).toBe(true);
  });

  it('counts qc_failed with temp file (vision QC)', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'qc_failed',
        qcReason: 'Vision QC: defects',
        tempImagePath: '/tmp/b.png',
        finalImagePath: null,
      })
    ).toBe(true);
  });

  it('counts metadata failure without paths when reason matches', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'qc_failed',
        qcReason: 'Metadata failed: timeout',
        tempImagePath: null,
        finalImagePath: null,
      })
    ).toBe(true);
  });

  it('counts processing_failed without paths', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'retry_failed',
        qcReason: 'processing_failed:remove_bg',
        tempImagePath: null,
        finalImagePath: null,
      })
    ).toBe(true);
  });

  it('rejects pure generation failure', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'qc_failed',
        qcReason: 'invalid_result_format',
        tempImagePath: null,
        finalImagePath: null,
      })
    ).toBe(false);
  });

  it('rejects CDN/download failure with no paths (not post-gen salvage)', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'qc_failed',
        qcReason: 'processing_failed:download',
        tempImagePath: null,
        finalImagePath: null,
      })
    ).toBe(false);
  });

  it('SVG: rejects logistics/download failure even when a .svg path exists (generation failed, not salvage)', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'qc_failed',
        qcReason: 'processing_failed:download',
        tempImagePath: '/tmp/partial.svg',
        finalImagePath: null,
      })
    ).toBe(false);
  });

  it('PNG: download failure with path still counts as successful generation (legacy raster salvage)', () => {
    expect(
      imageHadSuccessfulGeneration({
        qcStatus: 'qc_failed',
        qcReason: 'processing_failed:download',
        tempImagePath: '/tmp/partial.png',
        finalImagePath: null,
      })
    ).toBe(true);
  });

  it('countImagesGeneratedSuccessfully sums list', () => {
    const n = countImagesGeneratedSuccessfully([
      { qcStatus: 'approved', finalImagePath: '/f/1.png' },
      { qcStatus: 'qc_failed', qcReason: 'invalid_result_format' },
      { qcStatus: 'qc_failed', qcReason: 'Metadata failed: x', tempImagePath: null },
    ]);
    expect(n).toBe(2);
  });
});
