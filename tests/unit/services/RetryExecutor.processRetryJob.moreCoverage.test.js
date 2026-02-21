import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, require.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
  originalCache.clear();
};

const installCjsMocks = () => {
  const electronId = require.resolve('electron');
  rememberCache(electronId);
  require.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: { app: { getPath: () => '/tmp' } },
  };

  const sutId = require.resolve('../../../src/services/retryExecutor.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  return require('../../../src/services/retryExecutor.js');
};

describe('RetryExecutor processRetryJob/processQueue (unit) - extra coverage', () => {
  let RetryExecutor;
  let exec;

  beforeEach(() => {
    vi.clearAllMocks();
    RetryExecutor = loadSut();
    exec = new RetryExecutor({
      generatedImage: {
        updateQCStatus: vi.fn().mockResolvedValue({ success: true }),
      },
      jobConfig: {
        getDefaultSettings: vi.fn().mockReturnValue({
          filePaths: { outputDirectory: '/tmp/toupload', tempDirectory: '/tmp/generated' },
        }),
      },
    });
  });

  afterEach(() => {
    restoreCache();
  });

  it('processRetryJob emits progress, processes each image, and reports completion', async () => {
    const events = [];
    exec.on('job-status-updated', (e) => events.push(['job-status-updated', e]));
    exec.on('progress', (e) => events.push(['progress', e]));
    exec.on('job-completed', (e) => events.push(['job-completed', e]));
    exec.on('job-error', (e) => events.push(['job-error', e]));
    exec.on('image-error', (e) => events.push(['image-error', e]));

    // Avoid real delays
    exec.delay = vi.fn().mockResolvedValue(undefined);

    // First image succeeds, second fails (processRetryJob calls processSingleImage(job) per loop)
    exec.processSingleImage = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'boom' });

    const batchJob = {
      id: 'batch-1',
      imageIds: [11, 22],
      status: 'pending',
      createdAt: new Date(),
    };

    await expect(exec.processRetryJob(batchJob)).resolves.toBeUndefined();
    expect(exec.processSingleImage).toHaveBeenCalledTimes(2);
    // We expect at least a start progress + per-image progress + final progress events
    expect(events.some(([t]) => t === 'progress')).toBe(true);
    expect(events.some(([t]) => t === 'job-completed')).toBe(true);
  });

  it('processRetryJob emits image-error when an image throws, but continues with remaining images', async () => {
    const imageErrors = [];
    const progresses = [];
    exec.on('image-error', (e) => imageErrors.push(e));
    exec.on('progress', (e) => progresses.push(e));

    exec.delay = vi.fn().mockResolvedValue(undefined);
    exec.processSingleImage = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { stage: 'trim' }))
      .mockResolvedValueOnce({ success: true });

    const batchJob = { id: 'batch-2', imageIds: [1, 2], status: 'pending', createdAt: new Date() };
    await expect(exec.processRetryJob(batchJob)).resolves.toBeUndefined();

    expect(exec.processSingleImage).toHaveBeenCalledTimes(2);
    expect(imageErrors.length).toBe(1);
    expect(String(imageErrors[0].error)).toMatch(/boom/);
    expect(progresses.some((p) => p.step === 'completed')).toBe(true);
  });

  it('processQueue processes queued jobs and emits job-completed/job-error', async () => {
    const completed = [];
    const errored = [];
    exec.on('job-completed', (e) => completed.push(e));
    exec.on('job-error', (e) => errored.push(e));

    exec.processSingleImage = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'nope' });

    exec.queue.push(
      { id: 'j1', imageId: 1, status: 'pending', createdAt: new Date() },
      { id: 'j2', imageId: 2, status: 'pending', createdAt: new Date() },
    );

    await exec.processQueue();

    expect(exec.isProcessing).toBe(false);
    expect(exec.queue.length).toBe(0);
    expect(completed.length + errored.length).toBe(2);
  });

  it('getFallbackConfiguration returns settings from jobConfig when available', () => {
    const cfg = exec.getFallbackConfiguration();
    expect(cfg).toEqual(expect.objectContaining({
      settings: expect.objectContaining({
        filePaths: expect.objectContaining({ outputDirectory: '/tmp/toupload', tempDirectory: '/tmp/generated' }),
      }),
    }));
  });

  it('getQueueStatus / clearCompletedJobs / stop cover queue bookkeeping paths', () => {
    exec.queue = [
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'completed' },
      { id: 'c', status: 'failed' },
      { id: 'd', status: 'processing' },
    ];

    const status = exec.getQueueStatus();
    expect(status).toEqual(expect.objectContaining({
      pendingJobs: 1,
      completedJobs: 1,
      failedJobs: 1,
      processingJobs: 1,
    }));

    const queueUpdated = vi.fn();
    exec.on('queue-updated', queueUpdated);
    exec.clearCompletedJobs();
    expect(exec.queue.some((j) => j.status === 'completed')).toBe(false);
    expect(queueUpdated).toHaveBeenCalled();

    const stopped = vi.fn();
    exec.on('stopped', stopped);
    exec.stop();
    expect(exec.queue).toEqual([]);
    expect(exec.isProcessing).toBe(false);
    expect(stopped).toHaveBeenCalled();
  });
});

