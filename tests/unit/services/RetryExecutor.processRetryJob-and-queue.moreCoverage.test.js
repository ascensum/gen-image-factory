import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('RetryExecutor processRetryJob/processQueue/constructor (more coverage)', () => {
  let prevCache = {};

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const set = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };

  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/retryExecutor.js');
    remember(sutId);
    delete req.cache[sutId];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};

    set(req.resolve('../../../src/producePictureModule.js'), { processImage: vi.fn(async (p) => p) });
    set(req.resolve('../../../src/aiVision.js'), { generateMetadata: vi.fn(async () => ({ new_title: 't', new_description: 'd', uploadTags: [] })) });
    set(req.resolve('../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function MockJobConfiguration() {
        return { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} }) };
      },
    });
  });

  afterEach(() => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('constructor uses Documents fallback when electron desktop access fails', () => {
    set(req.resolve('electron'), { app: { getPath: () => { throw new Error('no desktop'); } } });

    const RetryExecutor = loadSut();
    const exec = new RetryExecutor({ generatedImage: {} });

    expect(String(exec.tempDirectory)).toContain(path.join('Documents', 'gen-image-factory'));
    expect(String(exec.outputDirectory)).toContain(path.join('Documents', 'gen-image-factory'));
  });

  it('addBatchRetryJob enqueues jobs and starts processQueue when idle', async () => {
    set(req.resolve('electron'), { app: { getPath: () => '/tmp' } });

    const RetryExecutor = loadSut();
    const exec = new RetryExecutor({ generatedImage: {} });

    const pq = vi.spyOn(exec, 'processQueue').mockResolvedValue(undefined);
    const qEvents = [];
    exec.on('queue-updated', (e) => qEvents.push(e));

    const res = await exec.addBatchRetryJob({
      id: 'batch-1',
      type: 'retry',
      imageIds: [1, 2],
      useOriginalSettings: false,
      modifiedSettings: { imageConvert: false },
      includeMetadata: false,
      failOptions: { enabled: true, steps: ['metadata'] },
    });

    expect(res.success).toBe(true);
    expect(exec.queue.length).toBe(2);
    expect(qEvents.length).toBe(1);
    expect(pq).toHaveBeenCalled();
  });

  it('processQueue covers success + failure job events and progress emission', async () => {
    set(req.resolve('electron'), { app: { getPath: () => '/tmp' } });

    const RetryExecutor = loadSut();

    const exec = new RetryExecutor({ generatedImage: {} });
    exec.processedCount = 0;
    exec.totalCount = 2;

    // Cover both branches: success and failure
    vi.spyOn(exec, 'processSingleImage')
      .mockResolvedValueOnce({ success: true, message: 'ok' })
      .mockResolvedValueOnce({ success: false, error: 'nope' });

    const statusEvents = [];
    const completedEvents = [];
    const errorEvents = [];
    const progressEvents = [];

    exec.on('job-status-updated', (e) => statusEvents.push(e));
    exec.on('job-completed', (e) => completedEvents.push(e));
    exec.on('job-error', (e) => errorEvents.push(e));
    exec.on('progress', (e) => progressEvents.push(e));

    exec.queue.push(
      { id: 'j1', imageId: 1, useOriginalSettings: false, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] }, status: 'pending' },
      { id: 'j2', imageId: 2, useOriginalSettings: false, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] }, status: 'pending' },
    );

    await exec.processQueue();

    expect(statusEvents.length).toBe(2);
    expect(completedEvents.length).toBe(1);
    expect(errorEvents.length).toBe(1);
    expect(progressEvents.length).toBe(2);
    expect(exec.isProcessing).toBe(false);
  });

  it('processQueue early-returns when already processing', async () => {
    set(req.resolve('electron'), { app: { getPath: () => '/tmp' } });

    const RetryExecutor = loadSut();
    const exec = new RetryExecutor({ generatedImage: {} });

    exec.isProcessing = true;
    await expect(exec.processQueue()).resolves.toBeUndefined();
  });

  it('processRetryJob runs through progress phases and aggregates results (uses fake timers for delay)', async () => {
    set(req.resolve('electron'), { app: { getPath: () => '/tmp' } });

    const RetryExecutor = loadSut();
    const exec = new RetryExecutor({ generatedImage: {} });

    vi.useFakeTimers();

    // processRetryJob calls processSingleImage(job) per loop; we don\'t rely on job.imageId mutation.
    vi.spyOn(exec, 'processSingleImage')
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'fail' });

    const progress = [];
    const completed = [];
    exec.on('progress', (e) => progress.push(e));
    exec.on('job-completed', (e) => completed.push(e));

    const job = {
      id: 'batch-job-1',
      imageIds: [11, 22],
      imageId: 11,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      status: 'pending',
    };

    const p = exec.processRetryJob(job);
    // first delay(1000)
    await vi.advanceTimersByTimeAsync(1000);
    // inter-image delay(500)
    await vi.advanceTimersByTimeAsync(500);
    await p;

    expect(completed.length).toBe(1);
    expect(job.status).toBe('completed');
    expect(job.results).toEqual(expect.objectContaining({ totalImages: 2, processedCount: 2, successCount: 1, failedCount: 1 }));
    expect(progress.some((e) => e.step === 'starting')).toBe(true);
    expect(progress.some((e) => e.step === 'completed')).toBe(true);
  });
});
