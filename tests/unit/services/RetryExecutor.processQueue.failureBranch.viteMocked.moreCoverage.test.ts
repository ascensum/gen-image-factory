import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }));
vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    getDefaultSettings: vi.fn(() => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} })),
  })),
}));
vi.mock('../../../src/producePictureModule', () => ({ processImage: vi.fn() }));
vi.mock('../../../src/aiVision', () => ({ generateMetadata: vi.fn() }));

describe('RetryExecutor.processQueue failure branch (vite-mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('emits job-error when processSingleImage returns success=false', async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    const RetryExecutor = mod?.default ?? mod;

    const exec: any = new RetryExecutor({ generatedImage: {}, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} }) } });

    exec.processSingleImage = vi.fn().mockResolvedValue({ success: false, error: 'nope' });
    const jobError = vi.fn();
    exec.on('job-error', jobError);

    exec.queue.push({ id: 'j1', imageId: 1, useOriginalSettings: false, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] }, status: 'pending' });

    await exec.processQueue();

    expect(jobError).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'j1', imageId: 1, error: 'nope' }));
  });
});
