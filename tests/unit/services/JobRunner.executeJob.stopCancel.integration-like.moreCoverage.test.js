import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
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
  // Provide deterministic electron surface for temp paths
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
  const { JobRunner } = require('../../../src/services/jobRunner.js');
  return JobRunner;
};

describe('JobRunner.executeJob (stop/cancel mid-flight, integration-like)', () => {
  let tmpRoot;
  let tempDir;
  let outDir;
  let backendAdapter;
  let prevGlobalBackendAdapter;
  let prevProcessBackendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-cancel-'));
    tempDir = path.join(tmpRoot, 'generated');
    outDir = path.join(tmpRoot, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    backendAdapter = {
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 909 }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 909 } }),
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
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
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}

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

  it('forceStopAll aborts an in-flight generateImages and persists failed status (no hang)', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;
    runner.configurationId = 1;

    // Make parameter generation succeed quickly
    runner.generateParameters = vi.fn().mockResolvedValue({ prompt: 'P', promptContext: '', aspectRatios: ['1:1'] });

    // Make generateImages wait for abort signal
    runner.generateImages = vi.fn((cfg) => new Promise((_, reject) => {
      const signal = cfg && cfg.__abortSignal;
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })), { once: true });
      }
    }));

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: outDir, tempDirectory: tempDir },
      parameters: { processMode: 'single', variations: 1, enablePollingTimeout: false, pollingTimeout: 1 },
      processing: { removeBg: false, imageConvert: false },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    const startRes = await runner.startJob(config);
    expect(startRes.success).toBe(true);

    const p = runner.currentJob;
    expect(p).toBeTruthy();

    // Ensure executeJob has created abortController before we abort
    await Promise.resolve();

    await runner.forceStopAll();

    // The in-flight executeJob should settle (reject) rather than hang
    await expect(p).rejects.toThrow(/aborted/i);

    // forceStopAll should have persisted failed status
    expect(backendAdapter.updateJobExecution).toHaveBeenCalledWith(
      909,
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
