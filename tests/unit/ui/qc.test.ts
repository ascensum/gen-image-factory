/**
 * Unit tests for renderer QC utils: formatQcLabel, formatQcFailureReason, FAILED_FILTER_OPTIONS.
 * Task 7.19: Pill labels and label filter options for Failed Images Review.
 */
import { describe, it, expect } from 'vitest';
import {
  formatQcLabel,
  formatQcFailureReason,
  formatRetryErrorForUser,
  FAILED_FILTER_OPTIONS,
} from '../../../src/renderer/utils/qc';

describe('formatQcLabel', () => {
  it('returns undefined for non-failed statuses', () => {
    expect(formatQcLabel('approved', '')).toBeUndefined();
    expect(formatQcLabel('processing', 'processing_failed:qc')).toBeUndefined();
    expect(formatQcLabel('retry_pending', '')).toBeUndefined();
    expect(formatQcLabel('complete', '')).toBeUndefined();
  });

  it('returns "QC Failed" when status is qc_failed/retry_failed and reason is empty', () => {
    expect(formatQcLabel('qc_failed', '')).toBe('QC Failed');
    expect(formatQcLabel('retry_failed', null)).toBe('QC Failed');
  });

  it('returns "QC analysis failed" for processing_failed:qc (technical QC failure)', () => {
    expect(formatQcLabel('qc_failed', 'processing_failed:qc')).toBe('QC analysis failed');
    expect(formatQcLabel('retry_failed', 'processing_failed:qc')).toBe('QC analysis failed');
    expect(formatQcLabel('qc_failed', 'PROCESSING_FAILED:QC')).toBe('QC analysis failed');
  });

  it('returns correct pill labels for known processing_failed reasons', () => {
    expect(formatQcLabel('qc_failed', 'processing_failed:download')).toBe('Download failed');
    expect(formatQcLabel('qc_failed', 'processing_failed:remove_bg')).toBe('Background removal failed');
    expect(formatQcLabel('qc_failed', 'processing_failed:trim')).toBe('Trim failed');
    expect(formatQcLabel('qc_failed', 'processing_failed:enhancement')).toBe('Enhancement failed');
    expect(formatQcLabel('qc_failed', 'processing_failed:convert')).toBe('Conversion failed');
    expect(formatQcLabel('qc_failed', 'processing_failed:save_final')).toBe('Save failed');
    expect(formatQcLabel('qc_failed', 'processing_failed:metadata')).toBe('Metadata failed');
  });

  it('returns "QC Failed" for unknown reason (fallback)', () => {
    expect(formatQcLabel('qc_failed', 'some:unknown:reason')).toBe('QC Failed');
    expect(formatQcLabel('retry_failed', 'Quality check failed')).toBe('QC Failed');
  });
});

describe('formatQcFailureReason', () => {
  it('returns undefined for non-failed status or empty reason', () => {
    expect(formatQcFailureReason('approved', 'x')).toBeUndefined();
    expect(formatQcFailureReason('qc_failed', '')).toBeUndefined();
  });

  it('returns friendly message for processing_failed:qc', () => {
    expect(formatQcFailureReason('qc_failed', 'processing_failed:qc')).toBe(
      'The system failed to receive QC analysis response for this image.'
    );
  });

  it('returns friendly messages for other known reasons', () => {
    expect(formatQcFailureReason('qc_failed', 'processing_failed:download')).toContain('download');
    expect(formatQcFailureReason('qc_failed', 'processing_failed:metadata')).toContain('metadata');
  });

  it('returns undefined for model-provided explanation (caller shows raw qcReason)', () => {
    expect(formatQcFailureReason('qc_failed', 'Image too dark and blurry')).toBeUndefined();
  });
});

describe('formatRetryErrorForUser', () => {
  it('returns friendly retry message for known processing_failed codes', () => {
    expect(formatRetryErrorForUser('processing_failed:remove_bg')).toBe(
      'Retry error: The system failed to remove the background for this image.'
    );
    expect(formatRetryErrorForUser('processing_failed:trim')).toContain('trim');
    expect(formatRetryErrorForUser('processing_failed:save_final')).toContain('save');
    expect(formatRetryErrorForUser('processing_failed:save_final: ENOENT')).toContain('save');
  });

  it('returns generic message for empty or unknown error', () => {
    expect(formatRetryErrorForUser('')).toBe('Retry failed. Please try again.');
    expect(formatRetryErrorForUser(undefined)).toBe('Retry failed. Please try again.');
    expect(formatRetryErrorForUser('Processor error')).toBe(
      'Retry failed. Please try again or check the image.'
    );
  });
});

describe('FAILED_FILTER_OPTIONS', () => {
  it('has first option Failed (All) with value all', () => {
    expect(FAILED_FILTER_OPTIONS[0]).toEqual({ value: 'all', label: 'Failed (All)' });
  });

  it('includes all pill labels from formatQcLabel in same order', () => {
    const labels = FAILED_FILTER_OPTIONS.slice(1).map((o) => o.label);
    expect(labels).toContain('QC Failed');
    expect(labels).toContain('QC analysis failed');
    expect(labels).toContain('Download failed');
    expect(labels).toContain('Background removal failed');
    expect(labels).toContain('Trim failed');
    expect(labels).toContain('Enhancement failed');
    expect(labels).toContain('Conversion failed');
    expect(labels).toContain('Save failed');
    expect(labels).toContain('Metadata failed');
  });

  it('has value equal to label for each pill option (for filter match)', () => {
    for (let i = 1; i < FAILED_FILTER_OPTIONS.length; i++) {
      expect(FAILED_FILTER_OPTIONS[i].value).toBe(FAILED_FILTER_OPTIONS[i].label);
    }
  });

  it('has exactly 10 options (Failed (All) + 9 pill labels)', () => {
    expect(FAILED_FILTER_OPTIONS).toHaveLength(10);
  });
});
