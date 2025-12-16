import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fsSync from 'fs';

const req = createRequire(import.meta.url);

describe('BackendAdapter (unit) - bulk export + retry init + filters (more coverage)', () => {
  let prevCache: Record<string, any> = {};

  const patchCjs = (overrides: {
    electron?: any;
    retryExecutorImpl?: any;
    archiverImpl?: any;
    excelWorkbookFactory?: () => any;
  } = {}) => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => {
      remember(id);
      (req.cache as any)[id] = { id, filename: id, loaded: true, exports };
    };

    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });

    const workbookFactory = overrides.excelWorkbookFactory ?? (() => ({
      addWorksheet: vi.fn(() => ({ addRows: vi.fn(), columns: [] })),
      xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) },
    }));
    set(req.resolve('exceljs'), { Workbook: vi.fn(workbookFactory) });

    set(req.resolve('electron'), overrides.electron ?? {
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') },
      dialog: {},
      shell: { openPath: vi.fn().mockResolvedValue('') },
    });

    // DB models (avoid sqlite init)
    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function MockJobConfiguration() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getConfigurationById: vi.fn(),
          getDefaultSettings: vi.fn(),
          getSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
          saveSettings: vi.fn(),
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
          getJobExecutionsWithFilters: vi.fn(),
          getJobExecutionsCount: vi.fn(),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function MockGeneratedImage() {
        return {
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          getGeneratedImagesByExecution: vi.fn(),
        };
      },
    });

    // Services
    set(req.resolve('../../../../src/services/jobRunner.js'), {
      JobRunner: function MockJobRunner() {
        return {
          on: vi.fn(),
          startJob: vi.fn(async () => ({ success: true, jobId: 'job-1' })),
          getJobStatus: vi.fn(async () => ({ status: 'idle', state: 'idle', progress: 0 })),
        };
      },
    });
    const RetryExecutorImpl = overrides.retryExecutorImpl ?? function MockRetryExecutor() {
      return { on: vi.fn(), getQueueStatus: vi.fn(() => ({ queueLength: 0 })) };
    };
    set(req.resolve('../../../../src/services/retryExecutor.js'), RetryExecutorImpl);
    set(req.resolve('../../../../src/services/errorTranslation.js'), { ErrorTranslationService: function MockETS() { return { translateError: vi.fn((e: any) => e) }; } });
    set(req.resolve('../../../../src/utils/logMasking.js'), { safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });

    // archiver (dynamic require inside bulkExport/createZipExport)
    const archive = {
      pipe: vi.fn(),
      append: vi.fn(),
      finalize: vi.fn(async () => undefined),
      file: vi.fn(),
    };
    const archiverFn = overrides.archiverImpl ?? vi.fn(() => archive);
    set(req.resolve('archiver'), archiverFn);

    // Ensure reload
    const sutId = req.resolve('../../../../src/adapter/backendAdapter.js');
    remember(sutId);
    delete req.cache[sutId];

    return { archiverFn, archive };
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
    // keep queue clean across tests
    delete (globalThis as any).bulkRerunQueue;
  });

  it('initializeRetryExecutor uses settings filePaths and wires progress event to mainWindow', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.mainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };

    adapter.getSettings = vi.fn().mockResolvedValue({
      success: true,
      settings: { filePaths: { tempDirectory: '/tmp/gen', outputDirectory: '/tmp/out' } },
    });

    await adapter.initializeRetryExecutor();

    expect(adapter.retryExecutor).toBeTruthy();
    expect(typeof adapter.retryExecutor.on).toBe('function');
    // Event listener registration is the important part (it pipes progress via mainWindow)
    expect(adapter.retryExecutor.on).toHaveBeenCalledWith('progress', expect.any(Function));
  });

  it('getJobExecutionsWithFilters: hasPendingRetries returns empty list when no queue; enriches pendingJobs when queue exists', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    // filter ON but no queue
    adapter.jobExecution.getJobExecutionsWithFilters = vi.fn();
    await expect(adapter.getJobExecutionsWithFilters({ hasPendingRetries: true })).resolves.toEqual({ success: true, jobs: [] });

    // queue exists -> ids injected and pendingJobs enriched
    (globalThis as any).bulkRerunQueue = [{ jobId: 7 }, { jobId: 9 }];
    adapter.jobExecution.getJobExecutionsWithFilters = vi.fn().mockResolvedValue({
      success: true,
      jobs: [{ id: 7, label: 'a' }, { id: 8, label: 'b' }],
    });

    const res = await adapter.getJobExecutionsWithFilters({ hasPendingRetries: true });
    expect(res.success).toBe(true);
    expect(adapter.jobExecution.getJobExecutionsWithFilters).toHaveBeenCalledWith(expect.objectContaining({ ids: [7, 9] }));
    expect(res.jobs).toEqual([
      expect.objectContaining({ id: 7, pendingJobs: 1 }),
      expect.objectContaining({ id: 8, pendingJobs: 0 }),
    ]);
  });

  it('openExportsFolder creates export dir and calls shell.openPath', async () => {
    patchCjs({
      electron: {
        ipcMain: undefined,
        app: { getPath: vi.fn(() => '/tmp/userData') },
        shell: { openPath: vi.fn().mockResolvedValue('') },
        dialog: {},
      },
    });
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });

    vi.spyOn(fsSync, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);

    const res = await adapter.openExportsFolder();
    expect(res.success).toBe(true);
    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/userData/exports', { recursive: true });
  });

  it('openExportsFolder falls back to os.tmpdir when app.getPath is unavailable', async () => {
    patchCjs({
      electron: {
        ipcMain: undefined,
        app: {}, // no getPath -> fallback to os.tmpdir()
        shell: { openPath: vi.fn().mockResolvedValue('') },
        dialog: {},
      },
    });
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });

    vi.spyOn(fsSync, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);

    const res = await adapter.openExportsFolder();
    expect(res.success).toBe(true);
    expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining('gen-image-factory-exports'), { recursive: true });
  });

  it('bulkExportJobExecutions: returns errors when jobs cannot be retrieved or are empty', async () => {
    patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecutionsByIds = vi.fn().mockResolvedValue({ success: false });
    await expect(adapter.bulkExportJobExecutions([1, 2])).resolves.toEqual({
      success: false,
      error: 'Failed to retrieve jobs for export',
    });

    adapter.jobExecution.getJobExecutionsByIds = vi.fn().mockResolvedValue({ success: true, executions: [] });
    await expect(adapter.bulkExportJobExecutions([1])).resolves.toEqual({
      success: false,
      error: 'No jobs found for export',
    });
  });

  it('bulkExportJobExecutions: happy path writes per-job excel buffers and adds summary file (overwrite duplicate policy)', async () => {
    const { archive, archiverFn } = patchCjs();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    // FS behavior for output path + overwrite
    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s === '/tmp') return true;
      if (s.endsWith('/tmp/bulk.zip')) return true;
      if (s.endsWith('/tmp/exports')) return true;
      return false;
    });
    const unlinkSpy = vi.spyOn(fsSync, 'unlinkSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue({ on: vi.fn() } as any);

    adapter.jobExecution.getJobExecutionsByIds = vi.fn().mockResolvedValue({
      success: true,
      executions: [
        { id: 101, label: 'My Job', status: 'completed', configurationId: 55, startedAt: null, completedAt: null },
      ],
    });
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({
      success: true,
      images: [{ id: 1, executionId: 101, generationPrompt: 'p', qcStatus: 'approved', finalImagePath: '/tmp/a.png' }],
    });
    adapter.jobConfig.getConfigurationById = vi.fn().mockResolvedValue({
      success: true,
      configuration: { id: 55, name: 'Cfg', settings: { parameters: { processMode: 'relax' }, processing: { removeBg: true } } },
    });

    const res = await adapter.bulkExportJobExecutions([101], { outputPath: '/tmp/bulk.zip', duplicatePolicy: 'overwrite' });
    expect(res.success).toBe(true);
    expect(res.totalJobs).toBe(1);
    expect(res.successfulExports).toBe(1);

    expect(archiverFn).toHaveBeenCalledWith('zip', expect.any(Object));
    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/bulk.zip');
    expect(archive.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: expect.stringMatching(/\.xlsx$/) }));
    expect(archive.append).toHaveBeenCalledWith(expect.stringContaining('Bulk Export Summary'), { name: 'export_summary.txt' });
    expect(archive.finalize).toHaveBeenCalled();
  });
});

