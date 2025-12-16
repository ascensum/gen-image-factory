import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

type CacheEntry = any;

describe('BackendAdapter retry batch (unit) - high value coverage', () => {
  let prevCache: Record<string, CacheEntry> = {};

  const patchCjs = (overrides: {
    retryExecutorImpl?: any;
  } = {}) => {
    prevCache = {};

    const remember = (id: string) => {
      if (!(id in prevCache)) prevCache[id] = req.cache[id];
    };

    const set = (id: string, exports: any) => {
      remember(id);
      req.cache[id] = { id, filename: id, loaded: true, exports };
    };

    // keytar + exceljs are required at module scope
    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });
    set(req.resolve('exceljs'), { Workbook: vi.fn(() => ({ xlsx: { writeFile: vi.fn(), writeBuffer: vi.fn().mockResolvedValue(Buffer.from('x')) } })) });

    // electron is required at module scope for ipcMain
    set(req.resolve('electron'), {
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') },
      dialog: {},
      shell: {},
    });

    // DB models (avoid sqlite init)
    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function MockJobConfiguration() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/JobExecution.js'), {
      JobExecution: function MockJobExecution() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getJobExecution: vi.fn(),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function MockGeneratedImage() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getGeneratedImage: vi.fn(),
          updateQCStatus: vi.fn(),
        };
      },
    });

    // Services
    set(req.resolve('../../../../src/services/jobRunner.js'), { JobRunner: function MockJobRunner() { return { on: vi.fn(), startJob: vi.fn(), stopJob: vi.fn() }; } });

    const RetryExecutorImpl = overrides.retryExecutorImpl ?? function MockRetryExecutor() {
      return { on: vi.fn(), addBatchRetryJob: vi.fn(), getQueueStatus: vi.fn(() => ({ queueLength: 0 })) };
    };
    set(req.resolve('../../../../src/services/retryExecutor.js'), RetryExecutorImpl);

    set(req.resolve('../../../../src/services/errorTranslation.js'), { ErrorTranslationService: function MockETS() { return {}; } });
    set(req.resolve('../../../../src/utils/logMasking.js'), { safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });

    // Ensure we reload backendAdapter.js after patching its deps
    const sutId = req.resolve('../../../../src/adapter/backendAdapter.js');
    remember(sutId);
    delete req.cache[sutId];
  };

  const restore = () => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restore();
    vi.resetModules();
  });

  it('rejects empty imageIds early', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.ensureRetryExecutorInitialized = vi.fn().mockResolvedValue(true);

    const res = await adapter.retryFailedImagesBatch([], false, {}, false);
    expect(res).toEqual({ success: false, error: 'No images selected for retry' });
  });

  it('queues a batch retry using RetryExecutor (modified settings path)', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.ensureRetryExecutorInitialized = vi.fn().mockResolvedValue(true);

    // Inject fake models
    adapter.generatedImage.getGeneratedImage = vi.fn()
      .mockResolvedValueOnce({ success: true, image: { id: 1, executionId: 10 } })
      .mockResolvedValueOnce({ success: true, image: { id: 2, executionId: 10 } });
    adapter.generatedImage.updateQCStatus = vi.fn().mockResolvedValue({ success: true });
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 10, status: 'completed' } });

    adapter.sanitizeProcessingSettings = vi.fn((s: any) => ({ ...s, sanitized: true }));

    adapter.retryExecutor = {
      addBatchRetryJob: vi.fn().mockResolvedValue({ success: true, jobId: 'b1', queuedJobs: 2 }),
      getQueueStatus: vi.fn(() => ({ queueLength: 7 })),
    };

    const res = await adapter.retryFailedImagesBatch([1, '2', 'bad'], false, { trimTransparentBackground: true }, true, { enabled: true, steps: ['metadata'] });
    expect(res.success).toBe(true);
    expect(adapter.retryExecutor.addBatchRetryJob).toHaveBeenCalled();
    expect(res.queuedJobs).toBe(7);
    expect(String(res.message)).toMatch(/queued/i);
  });

  it('fails when useOriginalSettings=true but images are from different jobs', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.ensureRetryExecutorInitialized = vi.fn().mockResolvedValue(true);

    adapter.generatedImage.getGeneratedImage = vi.fn()
      .mockResolvedValueOnce({ success: true, image: { id: 1, executionId: 10 } })
      .mockResolvedValueOnce({ success: true, image: { id: 2, executionId: 11 } });

    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 10, status: 'completed' } });
    adapter.generatedImage.updateQCStatus = vi.fn().mockResolvedValue({ success: true });

    const res = await adapter.retryFailedImagesBatch([1, 2], true, null, false);
    expect(res.success).toBe(false);
    expect(String(res.error)).toMatch(/different jobs/i);
  });

  it('falls back to creating a local queued job when RetryExecutor is missing', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.ensureRetryExecutorInitialized = vi.fn().mockResolvedValue(true);

    adapter.generatedImage.getGeneratedImage = vi.fn()
      .mockResolvedValueOnce({ success: true, image: { id: 1, executionId: 10 } });
    adapter.generatedImage.updateQCStatus = vi.fn().mockResolvedValue({ success: true });
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 10, status: 'completed' } });

    adapter.retryExecutor = null;

    const res = await adapter.retryFailedImagesBatch([1], false, { trimTransparentBackground: true }, false);
    expect(res.success).toBe(true);
    expect(res.batchJob).toEqual(expect.objectContaining({
      type: 'batch_retry',
      status: 'pending',
      id: expect.stringMatching(/^retry_/),
    }));
  });

  it('ensureRetryExecutorInitialized initializes when missing', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });

    adapter.retryExecutor = undefined;
    adapter.initializeRetryExecutor = vi.fn(async () => { adapter.retryExecutor = { ok: true }; });

    await expect(adapter.ensureRetryExecutorInitialized()).resolves.toBe(true);
    expect(adapter.initializeRetryExecutor).toHaveBeenCalled();
  });
});

