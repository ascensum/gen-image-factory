import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
}));

vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    getDefaultSettings: vi.fn(() => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} })),
  })),
}));

vi.mock('../../../src/producePictureModule', () => ({ processImage: vi.fn() }));
vi.mock('../../../src/aiVision', () => ({ generateMetadata: vi.fn() }));

describe('RetryExecutor.addBatchRetryJob branch boost (vite-mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uses provided batchRetryJob.id (covers jobId || fallback branch)', async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    const RetryExecutor = mod?.default ?? mod;

    const exec: any = new RetryExecutor({ generatedImage: {}, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} }) } });
    exec.isProcessing = true; // avoid triggering processQueue

    const res = await exec.addBatchRetryJob({
      id: 'batch-explicit-id',
      type: 'retry',
      imageIds: ['a'],
      useOriginalSettings: false,
      // modifiedSettings intentionally omitted to hit ternary/log branches
      includeMetadata: false,
      // failOptions intentionally omitted
    });

    expect(res.success).toBe(true);
    expect(res.jobId).toBe('batch-explicit-id');
    expect(res).toEqual(expect.objectContaining({ queuedJobs: 1, queueLength: 1 }));
  });

  it('returns success payload when id is omitted (covers fallback jobId path + success return object)', async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    const RetryExecutor = mod?.default ?? mod;

    const exec: any = new RetryExecutor({ generatedImage: {}, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} }) } });
    exec.isProcessing = true; // keep deterministic; avoid queue processing

    const res = await exec.addBatchRetryJob({
      type: 'retry',
      imageIds: ['a', 'b'],
      useOriginalSettings: false,
      modifiedSettings: { imageConvert: false },
      includeMetadata: false,
      failOptions: { enabled: true, steps: ['metadata'] },
    });

    expect(res.success).toBe(true);
    expect(String(res.jobId)).toMatch(/^batch_/);
    expect(res).toEqual(expect.objectContaining({ queuedJobs: 2, queueLength: 2 }));
    expect(String(res.message)).toMatch(/Successfully queued 2/);
  });
});
