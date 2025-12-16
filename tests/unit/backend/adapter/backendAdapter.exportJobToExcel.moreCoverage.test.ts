import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fsSync from 'fs';

const req = createRequire(import.meta.url);

describe('BackendAdapter.exportJobToExcel (unit) - overwrite/append/error paths', () => {
  let prevCache: Record<string, any> = {};

  const patchCjs = (overrides: { excel?: any } = {}) => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = (req.cache as any)[id]; };
    const set = (id: string, exports: any) => { remember(id); (req.cache as any)[id] = { id, filename: id, loaded: true, exports }; };

    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });
    set(req.resolve('electron'), { ipcMain: undefined, app: { getPath: vi.fn(() => '/tmp/userData') } });

    const workbookFactory = overrides.excel?.Workbook ?? vi.fn(() => ({
      addWorksheet: vi.fn(() => ({ addRows: vi.fn(), columns: [], addRow: vi.fn() })),
      xlsx: { writeFile: vi.fn().mockResolvedValue(undefined), writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) },
    }));
    set(req.resolve('exceljs'), { Workbook: workbookFactory });

    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), { JobConfiguration: function () { return { getConfigurationById: vi.fn(), getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' } }) }; } });
    set(req.resolve('../../../../src/database/models/JobExecution.js'), { JobExecution: function () { return { getJobExecution: vi.fn(), saveJobExecution: vi.fn(), updateJobExecution: vi.fn() }; } });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), { GeneratedImage: function () { return { getGeneratedImagesByExecution: vi.fn() }; } });

    set(req.resolve('../../../../src/services/jobRunner.js'), { JobRunner: function () { return { on: vi.fn(), startJob: vi.fn(), stopJob: vi.fn(), isRunning: false }; } });
    set(req.resolve('../../../../src/services/retryExecutor.js'), function () { return {}; });
    set(req.resolve('../../../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () {
        return { createJobError: (_id: any, err: any, code: string) => ({ userMessage: err?.message || 'err', code }) };
      },
    });
    set(req.resolve('../../../../src/utils/logMasking.js'), { safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });

    const sutId = req.resolve('../../../../src/adapter/backendAdapter.js');
    remember(sutId);
    delete (req.cache as any)[sutId];
  };

  const restore = () => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) (req.cache as any)[id] = entry;
      else delete (req.cache as any)[id];
    }
    prevCache = {};
  };

  beforeEach(() => {
    vi.clearAllMocks();
    patchCjs();
  });

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('returns error when job execution cannot be retrieved', async () => {
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({ success: false });

    const res = await adapter.exportJobToExcel(123, {});
    expect(res).toEqual({ success: false, error: 'Failed to get job execution' });
  });

  it('uses append policy when outputPath exists (adds (1).xlsx)', async () => {
    vi.useFakeTimers();

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({
      success: true,
      execution: { id: 987, label: 'My Job', status: 'completed', startedAt: new Date(), completedAt: new Date(), totalImages: 0, successfulImages: 0, failedImages: 0, configurationId: null },
    });
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({ success: true, images: [] });

    const seen: Record<string, number> = {};
    const existsSpy = vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('/tmp/out.xlsx')) return true; // full exists
      if (s.endsWith('/tmp/out (1).xlsx')) {
        // First call is for name selection (should be "doesn't exist"), later call is the
        // post-write verification (should exist).
        seen[s] = (seen[s] || 0) + 1;
        return seen[s] >= 2;
      }
      if (s === '/tmp') return true;
      return true;
    });
    const mkdirSpy = vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    const statSpy = vi.spyOn(fsSync, 'statSync').mockImplementation(() => ({ size: 10 } as any));

    const unlinkSpy = vi.spyOn(fsSync, 'unlinkSync').mockImplementation(() => undefined as any);

    const p = adapter.exportJobToExcel(987, { outputPath: '/tmp/out.xlsx', duplicatePolicy: 'append' });
    await vi.advanceTimersByTimeAsync(101);
    const res = await p;

    expect(res.success).toBe(true);
    expect(res.filePath).toBe('/tmp/out (1).xlsx');
    expect(unlinkSpy).not.toHaveBeenCalled(); // append policy
    expect(mkdirSpy).not.toHaveBeenCalledWith('/tmp', { recursive: true }); // dir already exists
    expect(existsSpy).toHaveBeenCalled();
    expect(statSpy).toHaveBeenCalled();
  });

  it('uses overwrite policy when outputPath exists (unlinks and writes to same path)', async () => {
    vi.useFakeTimers();

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({
      success: true,
      execution: { id: 111, label: 'My Job', status: 'completed', startedAt: new Date(), completedAt: new Date(), totalImages: 0, successfulImages: 0, failedImages: 0, configurationId: null },
    });
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({ success: true, images: [] });

    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('/tmp/out.xlsx')) return true;
      if (s === '/tmp') return true;
      return true;
    });
    const unlinkSpy = vi.spyOn(fsSync, 'unlinkSync').mockImplementation(() => undefined as any);
    const statSpy = vi.spyOn(fsSync, 'statSync').mockImplementation(() => ({ size: 5 } as any));

    const resPromise = adapter.exportJobToExcel(111, { outputPath: '/tmp/out.xlsx', duplicatePolicy: 'overwrite' });
    await vi.advanceTimersByTimeAsync(101);
    const res = await resPromise;

    expect(res.success).toBe(true);
    expect(res.filePath).toBe('/tmp/out.xlsx');
    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/out.xlsx');
    expect(statSpy).toHaveBeenCalledWith('/tmp/out.xlsx');
  });

  it('fails when writeFile succeeds but resulting file is missing/empty', async () => {
    vi.useFakeTimers();

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({
      success: true,
      execution: { id: 222, label: 'My Job', status: 'completed', startedAt: new Date(), completedAt: new Date(), totalImages: 0, successfulImages: 0, failedImages: 0, configurationId: null },
    });
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({ success: true, images: [] });

    vi.spyOn(fsSync, 'existsSync').mockReturnValue(false); // file not created

    const resPromise = adapter.exportJobToExcel(222, { outputPath: '/tmp/out.xlsx', duplicatePolicy: 'overwrite' });
    await vi.advanceTimersByTimeAsync(101);
    const res = await resPromise;

    expect(res.success).toBe(false);
    expect(String(res.error)).toMatch(/not created/i);
  });

  it('flattens effective settings into Job Summary and excludes apiKeys + MJ-only fields', async () => {
    vi.useFakeTimers();

    restore();
    const sheets: any[] = [];
    const workbook = {
      addWorksheet: vi.fn((name: string) => {
        const sheet = { name, addRows: vi.fn() };
        sheets.push(sheet);
        return sheet;
      }),
      xlsx: { writeFile: vi.fn().mockResolvedValue(undefined), writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) },
    };
    patchCjs({ excel: { Workbook: vi.fn(() => workbook) } });

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({
      success: true,
      execution: {
        id: 333,
        label: 'Label X',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        totalImages: 1,
        successfulImages: 1,
        failedImages: 0,
        configurationId: 55,
        configurationSnapshot: {
          apiKeys: { openai: 'SECRET' },
          // Legacy MJ-only fields (mjVersion/aspectRatios) intentionally omitted; Runware is the active provider.
          parameters: { label: 'SHOULD_NOT_EXPORT', runwareModel: 'runware:abc', runwareFormat: 'png', processMode: 'relax' },
          filePaths: { outputDirectory: '/exports', tempDirectory: '/tmp' },
          ai: { runQualityCheck: true },
          advanced: { debugMode: true },
        },
      },
    });
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({ success: true, images: [{ id: 1, executionId: 333 }] });
    adapter.jobConfig.getConfigurationById = vi.fn().mockResolvedValue({ success: true, configuration: { name: 'Cfg', createdAt: new Date(), updatedAt: new Date(), settings: {} } });

    vi.spyOn(fsSync, 'existsSync').mockReturnValue(true);
    vi.spyOn(fsSync, 'statSync').mockImplementation(() => ({ size: 10 } as any));

    const p = adapter.exportJobToExcel(333, { outputPath: '/tmp/out.xlsx', duplicatePolicy: 'overwrite' });
    await vi.advanceTimersByTimeAsync(101);
    const res = await p;

    expect(res.success).toBe(true);
    expect(sheets.map((s) => s.name)).toEqual(expect.arrayContaining(['Job Summary', 'Images']));

    const jobSummarySheet = sheets.find((s) => s.name === 'Job Summary');
    expect(jobSummarySheet.addRows).toHaveBeenCalledTimes(1);
    const rows = jobSummarySheet.addRows.mock.calls[0][0];
    const headers: string[] = rows[0];
    expect(headers).toEqual(expect.arrayContaining(['Runware Model', 'Output Directory', 'Run Quality Check', 'Debug Mode']));
    expect(headers.join(' ')).not.toMatch(/OpenAI/i); // apiKeys + openaiModel filtered
  });
});

