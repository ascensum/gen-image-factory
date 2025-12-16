import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('BackendAdapter start/stop (unit) - critical guards and error mapping', () => {
  let prevCache: Record<string, any> = {};
  let prevEnv: Record<string, string | undefined> = {};

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => { remember(id); req.cache[id] = { id, filename: id, loaded: true, exports }; };

    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });
    set(req.resolve('exceljs'), { Workbook: vi.fn(() => ({ xlsx: { writeFile: vi.fn(), writeBuffer: vi.fn().mockResolvedValue(Buffer.from('x')) } })) });
    set(req.resolve('electron'), { ipcMain: undefined, app: { getPath: vi.fn(() => '/tmp') }, dialog: {}, shell: {} });

    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), {
      JobConfiguration: function () {
        return {
          getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} }),
          saveSettings: vi.fn().mockResolvedValue({ success: true, id: 10 }),
        };
      },
    });
    set(req.resolve('../../../../src/database/models/JobExecution.js'), {
      JobExecution: function () {
        return { saveJobExecution: vi.fn(), updateJobExecution: vi.fn(), init: vi.fn(), createTables: vi.fn() };
      },
    });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), {
      GeneratedImage: function () {
        return { init: vi.fn(), createTables: vi.fn() };
      },
    });

    set(req.resolve('../../../../src/services/jobRunner.js'), { JobRunner: function () { return { on: vi.fn() }; } });
    set(req.resolve('../../../../src/services/retryExecutor.js'), function () { return {}; });

    set(req.resolve('../../../../src/services/errorTranslation.js'), {
      ErrorTranslationService: function () {
        return {
          createJobError: (_id: any, err: any, code: string) => ({
            userMessage: `translated:${err?.message || 'err'}`,
            code,
          }),
        };
      },
    });
    set(req.resolve('../../../../src/utils/logMasking.js'), { safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });

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

  const withNonTestEnv = () => {
    prevEnv = { VITEST: process.env.VITEST, NODE_ENV: process.env.NODE_ENV };
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';
  };
  const restoreEnv = () => {
    process.env.VITEST = prevEnv.VITEST;
    process.env.NODE_ENV = prevEnv.NODE_ENV;
    prevEnv = {};
  };

  beforeEach(() => {
    vi.clearAllMocks();
    patchCjs();
  });

  afterEach(() => {
    restoreEnv();
    restore();
    vi.resetModules();
  });

  it('startJob rejects when a job is already running', async () => {
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true, existingJobRunner: { isRunning: true } });
    const res = await adapter.startJob({ parameters: {} });
    expect(res).toEqual({ success: false, error: 'Job is already running' });
  });

  it('startJob rejects when OpenAI API key is missing in non-test env', async () => {
    withNonTestEnv();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true, existingJobRunner: { isRunning: false } });

    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: '' } } });
    adapter.jobConfig.saveSettings = vi.fn();

    const res = await adapter.startJob({ apiKeys: {}, parameters: {} });
    expect(res).toEqual(expect.objectContaining({
      success: false,
      code: 'JOB_CONFIGURATION_ERROR',
    }));
    expect(String(res.error)).toMatch(/OpenAI API key is required/i);
    expect(adapter.jobConfig.saveSettings).not.toHaveBeenCalled();
  });

  it('startJob maps JobRunner initialization failures via ErrorTranslationService', async () => {
    withNonTestEnv();
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true, existingJobRunner: { isRunning: false } });

    adapter.getSettings = vi.fn().mockResolvedValue({ success: true, settings: { apiKeys: { openai: 'k' } } });

    // Force jobRunner without startJob to hit "JobRunner not properly initialized"
    adapter.jobRunner = { isRunning: false };

    const res = await adapter.startJob({ apiKeys: { openai: 'k' }, parameters: {} });
    expect(res.success).toBe(false);
    expect(res.code).toBe('JOB_START_ERROR');
    expect(String(res.error)).toMatch(/^translated:/);
  });

  it('stopJob maps errors via ErrorTranslationService', async () => {
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true, existingJobRunner: { stopJob: vi.fn().mockRejectedValue(new Error('stop failed')) } });

    const res = await adapter.stopJob();
    expect(res.success).toBe(false);
    expect(res.code).toBe('JOB_STOP_ERROR');
    expect(String(res.error)).toMatch(/translated:stop failed/);
  });
});

