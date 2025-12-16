import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force Vite/Vitest module mocking (instead of require.cache patching)
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));

vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    getDefaultSettings: vi.fn(() => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} })),
  })),
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: vi.fn(async (p: string) => p),
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: vi.fn(),
}));

describe('RetryExecutor (vite-mocked) success paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('addBatchRetryJob success path pushes jobs into queue', async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    const RetryExecutor = mod?.default ?? mod;

    const exec: any = new RetryExecutor({ generatedImage: {} });
    exec.isProcessing = true; // avoid starting the queue automatically

    const res = await exec.addBatchRetryJob({
      type: 'retry',
      imageIds: ['img-1', 'img-2'],
      useOriginalSettings: false,
      modifiedSettings: { imageConvert: false },
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(true);
    expect(exec.queue.length).toBe(2);
    expect(exec.queue[0]).toEqual(expect.objectContaining({ imageId: 'img-1', status: 'pending' }));
  });

  it('processQueue consumes queue and emits completion', async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    const RetryExecutor = mod?.default ?? mod;

    const exec: any = new RetryExecutor({ generatedImage: {} });

    const completed = vi.fn();
    exec.on('job-completed', completed);

    // Avoid deep processing logic
    exec.processSingleImage = vi.fn().mockResolvedValue({ success: true, message: 'ok' });

    exec.queue.push({
      id: 'j1',
      imageId: 1,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
      status: 'pending',
    });

    await exec.processQueue();

    expect(completed).toHaveBeenCalled();
    expect(exec.queue.length).toBe(0);
    expect(exec.isProcessing).toBe(false);
  });
});
