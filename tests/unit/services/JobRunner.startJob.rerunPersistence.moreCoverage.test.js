import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
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
    exports: { app: { getPath: () => path.join(os.tmpdir(), 'desktop-mock') } },
  };

  const sutId = require.resolve('../../../src/services/jobRunner.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/services/jobRunner.js').JobRunner;
};

describe('JobRunner.startJob rerun persistence (unit)', () => {
  let backendAdapter;
  let prevGlobalBackendAdapter;
  let prevProcessBackendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();

    backendAdapter = {
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 111 }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
    };

    prevGlobalBackendAdapter = global.backendAdapter;
    prevProcessBackendAdapter = process.mainModule?.exports?.backendAdapter;
    if (!process.mainModule) {
      // @ts-ignore
      process.mainModule = { exports: {} };
    }
    // @ts-ignore
    process.mainModule.exports.backendAdapter = backendAdapter;
    // @ts-ignore
    global.backendAdapter = backendAdapter;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    // @ts-ignore
    if (process.mainModule && process.mainModule.exports) process.mainModule.exports.backendAdapter = prevProcessBackendAdapter;
    // @ts-ignore
    global.backendAdapter = prevGlobalBackendAdapter;
    // @ts-ignore
    delete global.currentJobRunner;

    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('clears rerun mode when no databaseExecutionId is set, and saves jobExecution snapshot without apiKeys', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner({ isRerun: true });

    // Prevent executeJob from doing real work
    runner.executeJob = vi.fn().mockResolvedValue(undefined);

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw', removeBg: 'rb' },
      parameters: { processMode: 'single', label: 'label-1' },
      processing: { removeBgFailureMode: 'approve' },
      ai: { runQualityCheck: false },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
    };

    const res = await runner.startJob(config);
    expect(res.success).toBe(true);

    // Rerun should be cleared because no execution id was provided
    expect(runner.isRerun).toBe(false);

    expect(backendAdapter.saveJobExecution).toHaveBeenCalledTimes(1);
    const payload = backendAdapter.saveJobExecution.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ status: 'running', label: 'label-1' }));
    // Snapshot must not leak apiKeys
    expect(payload.configurationSnapshot).toBeTruthy();
    expect(payload.configurationSnapshot.apiKeys).toBeUndefined();
  });

  it('keeps rerun mode when databaseExecutionId is provided, skips saveJobExecution, and preserves persistedLabel on force stop', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner({ isRerun: true });

    runner.databaseExecutionId = 777;
    runner.persistedLabel = 'existing-label';
    runner.configurationId = 5;

    runner.executeJob = vi.fn().mockResolvedValue(undefined);

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      parameters: { processMode: 'single', label: 'should-not-overwrite' },
      processing: { removeBgFailureMode: 'approve' },
      ai: { runQualityCheck: false },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
    };

    const res = await runner.startJob(config);
    expect(res.success).toBe(true);

    expect(runner.isRerun).toBe(true);
    expect(backendAdapter.saveJobExecution).not.toHaveBeenCalled();

    await runner.forceStopAll();

    expect(backendAdapter.updateJobExecution).toHaveBeenCalledWith(
      777,
      expect.objectContaining({ status: 'failed', label: 'existing-label' }),
    );
  });
});
