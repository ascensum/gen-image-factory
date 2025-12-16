import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter wrappers/defaults (unit) - more coverage', () => {
  let prevCache: Record<string, any> = {};

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => { remember(id); (req.cache as any)[id] = { id, filename: id, loaded: true, exports }; };

    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });
    set(req.resolve('exceljs'), { Workbook: vi.fn(() => ({ xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('x')) } })) });
    set(req.resolve('electron'), { ipcMain: undefined, app: { getPath: vi.fn(() => '/tmp') }, dialog: {}, shell: { openPath: vi.fn().mockResolvedValue('') } });

    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function MockJobConfiguration() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getDefaultSettings: vi.fn(() => ({ apiKeys: {}, parameters: {}, processing: {}, filePaths: {}, ai: {} })),
          getSettings: vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: {} } }),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/JobExecution.js'), {
      JobExecution: function MockJobExecution() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          saveJobExecution: vi.fn(),
          getJobExecution: vi.fn(),
          getAllJobExecutions: vi.fn(),
          updateJobExecution: vi.fn(),
          deleteJobExecution: vi.fn(),
          getJobHistory: vi.fn(),
          getJobStatistics: vi.fn(),
          calculateJobExecutionStatistics: vi.fn(),
          updateJobExecutionStatistics: vi.fn(),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function MockGeneratedImage() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getGeneratedImagesByExecution: vi.fn(),
          getAllGeneratedImages: vi.fn(),
          getImagesByQCStatus: vi.fn(),
          updateQCStatus: vi.fn(),
          updateQCStatusByMappingId: vi.fn(),
          updateGeneratedImageByMappingId: vi.fn(),
          updateMetadataById: vi.fn(),
          updateImagePathsByMappingId: vi.fn(),
        };
      },
    });

    const jobRunnerObj: any = {
      on: vi.fn(),
      getJobStatus: vi.fn(async () => ({ state: 'running', progress: 12 })),
      getJobProgress: vi.fn(async () => ({ progress: 50, currentStep: 2, totalSteps: 10, stepName: 'x' })),
      getJobLogs: vi.fn(async () => ([{ id: '1', level: 'warn', message: 'm', source: 'system' }, { message: 'no defaults' }])),
      forceStopAll: vi.fn(),
    };
    set(req.resolve('../../../../src/services/jobRunner.js'), { JobRunner: function MockJobRunner() { return jobRunnerObj; } });
    set(req.resolve('../../../../src/services/retryExecutor.js'), function MockRetryExecutor() { return { on: vi.fn() }; });
    set(req.resolve('../../../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function MockETS() {
        return {
          createJobError: vi.fn((_jobId: string, _err: any) => ({ userMessage: 'translated', code: 'X' })),
        };
      },
    });
    set(req.resolve('../../../../src/utils/logMasking.js'), { safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });

    const sutId = req.resolve('../../../../src/adapter/backendAdapter.js');
    remember(sutId);
    delete req.cache[sutId];

    return { jobRunnerObj };
  };

  const restore = () => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
  };

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
    vi.resetModules();
    delete (globalThis as any).bulkRerunQueue;
  });

  it('covers status/progress/log wrappers, history/statistics defaults, and forceStopAll error mapping', async () => {
    const { jobRunnerObj } = patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    // getJobStatus normalizes missing fields
    await expect(adapter.getJobStatus()).resolves.toEqual(expect.objectContaining({ state: 'running', progress: 12 }));

    // getJobProgress returns normalized object
    await expect(adapter.getJobProgress()).resolves.toEqual(expect.objectContaining({ progress: 50, currentStep: 2, totalSteps: 10, stepName: 'x' }));

    // getJobLogs maps shape + provides defaults for missing fields
    const logs = await adapter.getJobLogs('standard');
    expect(Array.isArray(logs)).toBe(true);
    expect(logs[0]).toEqual(expect.objectContaining({ id: '1', level: 'warn', message: 'm' }));
    expect(logs[1]).toEqual(expect.objectContaining({ level: 'info', source: 'system' }));

    // getAllJobExecutions enriches pendingJobs using global bulk queue
    (globalThis as any).bulkRerunQueue = [{ jobId: 2 }];
    adapter.jobExecution.getAllJobExecutions = vi.fn().mockResolvedValue({ success: true, executions: [{ id: 2 }, { id: 3 }] });
    const all = await adapter.getAllJobExecutions({ limit: 2 });
    expect(all.executions).toEqual([expect.objectContaining({ id: 2, pendingJobs: 1 }), expect.objectContaining({ id: 3, pendingJobs: 0 })]);

    // history/statistics unexpected format fallbacks
    adapter.jobExecution.getJobHistory = vi.fn().mockResolvedValue({ success: true }); // missing history
    await expect(adapter.getJobHistory(5)).resolves.toEqual([]);
    adapter.jobExecution.getJobStatistics = vi.fn().mockResolvedValue({ success: true }); // missing statistics
    await expect(adapter.getJobStatistics()).resolves.toEqual(expect.objectContaining({ totalJobs: 0, successRate: 0 }));

    // forceStopAll error mapping
    jobRunnerObj.forceStopAll = vi.fn(async () => { throw new Error('boom'); });
    const forced = await adapter.forceStopAll();
    expect(forced).toEqual({ success: false, error: 'translated', code: 'X' });

    // wrappers for generated image queries
    adapter.generatedImage.getAllGeneratedImages = vi.fn().mockResolvedValue({ success: true, images: [] });
    await expect(adapter.getAllGeneratedImages(10)).resolves.toEqual([]);
    adapter.generatedImage.getImagesByQCStatus = vi.fn().mockResolvedValue({ success: true, images: [{ id: 1 }] });
    await expect(adapter.getImagesByQCStatus('qc_failed')).resolves.toEqual({ success: true, images: [{ id: 1 }] });
  });

  it('covers error fallbacks for getJobStatus/getJobProgress/getJobLogs', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });

    adapter.jobRunner.getJobStatus = vi.fn(async () => { throw new Error('nope'); });
    await expect(adapter.getJobStatus()).resolves.toEqual(expect.objectContaining({ state: 'idle', progress: 0 }));

    adapter.jobRunner.getJobProgress = vi.fn(async () => { throw new Error('nope'); });
    await expect(adapter.getJobProgress()).resolves.toEqual(expect.objectContaining({ progress: 0, stepName: '' }));

    adapter.jobRunner.getJobLogs = vi.fn(async () => { throw new Error('nope'); });
    await expect(adapter.getJobLogs()).resolves.toEqual([]);
  });

  it('covers additional DB wrapper methods and retry queue status fallbacks', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    // Job execution wrappers (success)
    adapter.jobExecution.saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 1 });
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 1 } });
    adapter.jobExecution.updateJobExecution = vi.fn().mockResolvedValue({ success: true, changes: 1 });
    adapter.jobExecution.deleteJobExecution = vi.fn().mockResolvedValue({ success: true, changes: 1 });
    adapter.jobExecution.calculateJobExecutionStatistics = vi.fn().mockResolvedValue({ success: true, statistics: {} });
    adapter.jobExecution.updateJobExecutionStatistics = vi.fn().mockResolvedValue({ success: true });

    await expect(adapter.saveJobExecution({ status: 'running' })).resolves.toEqual({ success: true, id: 1 });
    await expect(adapter.getJobExecution(1)).resolves.toEqual({ success: true, execution: { id: 1 } });
    await expect(adapter.updateJobExecution(1, { status: 'completed' })).resolves.toEqual({ success: true, changes: 1 });
    await expect(adapter.deleteJobExecution(1)).resolves.toEqual({ success: true, changes: 1 });
    await expect(adapter.calculateJobExecutionStatistics(1)).resolves.toEqual({ success: true, statistics: {} });
    await expect(adapter.updateJobExecutionStatistics(1)).resolves.toEqual({ success: true });

    // Generated image mutation wrappers
    adapter.generatedImage.updateQCStatusByMappingId = vi.fn().mockResolvedValue({ success: true, changes: 1 });
    adapter.generatedImage.updateGeneratedImageByMappingId = vi.fn().mockResolvedValue({ success: true, changes: 1 });
    adapter.generatedImage.updateMetadataById = vi.fn().mockResolvedValue({ success: true, changes: 1 });
    adapter.generatedImage.updateImagePathsByMappingId = vi.fn().mockResolvedValue({ success: true, changes: 1 });

    await expect(adapter.updateQCStatusByMappingId('m1', 'approved', 'ok')).resolves.toEqual({ success: true, changes: 1 });
    await expect(adapter.updateGeneratedImageByMappingId('m1', { qcStatus: 'approved' })).resolves.toEqual({ success: true, changes: 1 });
    await expect(adapter.updateMetadataById(1, { title: 't' })).resolves.toEqual({ success: true, changes: 1 });
    await expect(adapter.updateImagePathsByMappingId('m1', '/tmp/a', '/tmp/b')).resolves.toEqual({ success: true, changes: 1 });

    // Retry queue status: no executor
    adapter.ensureRetryExecutorInitialized = vi.fn().mockResolvedValue(true);
    adapter.retryExecutor = null;
    const empty = await adapter.getRetryQueueStatus();
    expect(empty.success).toBe(true);
    expect(empty.queueStatus).toEqual(expect.objectContaining({ queueLength: 0, isProcessing: false }));

    // Retry queue status: has executor
    adapter.retryExecutor = { getQueueStatus: vi.fn(() => ({ queueLength: 2, isProcessing: true })) };
    const q = await adapter.getRetryQueueStatus();
    expect(q).toEqual({ success: true, queueStatus: { queueLength: 2, isProcessing: true } });

    // Error branch example
    adapter.jobExecution.deleteJobExecution = vi.fn(async () => { throw new Error('db down'); });
    await expect(adapter.deleteJobExecution(2)).resolves.toEqual({ success: false, error: 'db down' });
  });
});

