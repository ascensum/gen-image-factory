import { describe, it, expect } from 'vitest';
const {
  resolveExecutionDisplayLabel,
  formatRerunExecutionLabel,
} = require('../../../src/utils/resolveExecutionDisplayLabel');

describe('resolveExecutionDisplayLabel', () => {
  it('prefers execution label', () => {
    expect(
      resolveExecutionDisplayLabel({
        label: '  My Job  ',
        configurationName: 'Config A',
        executionId: 5,
      })
    ).toBe('My Job');
  });

  it('falls back to configuration name', () => {
    expect(
      resolveExecutionDisplayLabel({
        label: '',
        configurationName: 'Bulk export',
        executionId: 12,
      })
    ).toBe('Bulk export');
  });

  it('reads parameters.label from snapshot JSON string', () => {
    const json = JSON.stringify({ parameters: { label: 'From snapshot' } });
    expect(
      resolveExecutionDisplayLabel({
        configurationSnapshotJson: json,
        executionId: 3,
      })
    ).toBe('From snapshot');
  });

  it('formats started_at when no name', () => {
    const out = resolveExecutionDisplayLabel({
      startedAt: new Date(2024, 5, 10, 14, 30, 45),
      executionId: 99,
    });
    expect(out).toMatch(/^job_\d{8}_\d{6}$/);
  });

  it('falls back to Job id', () => {
    expect(resolveExecutionDisplayLabel({ executionId: 42 })).toBe('Job 42');
  });
});

describe('formatRerunExecutionLabel', () => {
  it('appends execution tail for (Rerun) suffix', () => {
    expect(formatRerunExecutionLabel('Foo (Rerun)', 1234567)).toBe('Foo (Rerun 234567)');
  });

  it('leaves non-rerun labels unchanged', () => {
    expect(formatRerunExecutionLabel('Normal', 1)).toBe('Normal');
  });
});
