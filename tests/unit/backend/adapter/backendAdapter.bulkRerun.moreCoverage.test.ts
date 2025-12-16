import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter bulk rerun (unit) - more coverage', () => {
  let prevCache: Record<string, any> = {};

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => { remember(id); (req.cache as any)[id] = { id, filename: id, loaded: true, exports }; };

    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });
    set(req.resolve('exceljs'), { Workbook: vi.fn(() => ({ xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('x')) } })) });
    set(req.resolve('electron'), {
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') },
      dialog: {},
      shell: { openPath: vi.fn().mockResolvedValue('') },
    });
    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function MockJobConfiguration() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getConfigurationById: vi.fn(),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/JobExecution.js'), {
      JobExecution: function MockJobExecution() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getJobExecutionsByIds: vi.fn(),
          saveJobExecution: vi.fn(),
          updateJobExecution: vi.fn(),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function MockGeneratedImage() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
        };
      },
    });

    const jobRunnerObj: any = {
      on: vi.fn(),
      startJob: vi.fn(async () => ({ success: true, jobId: 'jr-1' })),
      getJobStatus: vi.fn(async () => ({ status: 'idle', state: 'idle', progress: 0 })),
      persistedLabel: null,
      isRerun: false,
      databaseExecutionId: null,
      configurationId: null,
    };
    set(req.resolve('../../../../src/services/jobRunner.js'), { JobRunner: function MockJobRunner() { return jobRunnerObj; } });
    set(req.resolve('../../../../src/services/retryExecutor.js'), function MockRetryExecutor() { return { on: vi.fn() }; });
    set(req.resolve('../../../../src/services/errorTranslation.js'), { ErrorTranslationService: function MockETS() { return {}; } });
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

  it('bulkRerunJobExecutions returns error when any selected job is already running', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecutionsByIds = vi.fn().mockResolvedValue({
      success: true,
      executions: [{ id: 1, status: 'running' }],
    });

    const res = await adapter.bulkRerunJobExecutions([1]);
    expect(res).toEqual({ success: false, error: 'Cannot rerun jobs while other jobs are running' });
  });

  it('bulkRerunJobExecutions queues jobs, persists execution snapshot, merges runtime apiKeys, and stores remaining jobs in global queue', async () => {
    const { jobRunnerObj } = patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecutionsByIds = vi.fn().mockResolvedValue({
      success: true,
      executions: [
        { id: 10, status: 'completed', label: 'Parent', configurationId: 100 },
        { id: 11, status: 'completed', label: 'Second', configurationId: 101 },
      ],
    });
    adapter.jobConfig.getConfigurationById = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        configuration: { id: 100, settings: { parameters: { label: 'CfgLabel', runwareAdvancedEnabled: false, runwareAdvanced: { steps: 10 } }, processing: { removeBgFailureMode: 'approve' } } },
      })
      .mockResolvedValueOnce({
        success: true,
        configuration: { id: 101, settings: { parameters: { label: 'Cfg2' }, processing: {} } },
      });

    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'oa', runware: 'rw' } } });
    adapter.jobExecution.saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 999 });
    adapter.jobExecution.updateJobExecution = vi.fn().mockResolvedValue({ success: true });

    const res = await adapter.bulkRerunJobExecutions([10, 11]);
    expect(res.success).toBe(true);
    expect(res.queuedJobs).toBe(1);
    expect((globalThis as any).bulkRerunQueue?.length).toBe(1);

    // JobRunner should be configured for rerun mode + DB execution id
    expect(jobRunnerObj.isRerun).toBe(true);
    expect(jobRunnerObj.databaseExecutionId).toBe(999);
    expect(jobRunnerObj.configurationId).toBe(100);
    expect(String(jobRunnerObj.persistedLabel)).toMatch(/\(Rerun\)$/);

    // Runtime apiKeys were merged into config passed to startJob
    expect(jobRunnerObj.startJob).toHaveBeenCalledWith(expect.objectContaining({
      apiKeys: expect.objectContaining({ openai: 'oa', runware: 'rw' }),
    }));

    // Snapshot persisted without apiKeys
    expect(adapter.jobExecution.updateJobExecution).toHaveBeenCalledWith(999, expect.objectContaining({
      configurationSnapshot: expect.not.objectContaining({ apiKeys: expect.anything() }),
    }));
  });

  it('processNextBulkRerunJob starts next queued job and updates execution status to failed on start failure', async () => {
    const { jobRunnerObj } = patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });

    // Queue with one job
    (globalThis as any).bulkRerunQueue = [{
      jobId: 77,
      label: 'Q',
      configurationId: 55,
      configuration: { parameters: { label: 'QLabel', runwareAdvancedEnabled: false }, processing: {} },
    }];

    adapter.jobExecution.saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 500 });
    adapter.jobExecution.updateJobExecution = vi.fn().mockResolvedValue({ success: true });
    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'oa' } } });

    // fail startJob
    jobRunnerObj.startJob = vi.fn(async () => ({ success: false, error: 'nope' }));
    jobRunnerObj.getJobStatus = vi.fn(async () => ({ status: 'idle', state: 'idle', progress: 0 }));

    const res = await adapter.processNextBulkRerunJob();
    expect(res.success).toBe(false);
    expect(adapter.jobExecution.updateJobExecution).toHaveBeenCalledWith(500, { status: 'failed' });
  });
});

