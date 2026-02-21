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

let mockJeInit;
let mockJeGetJobExecution;
let mockJcInit;
let mockJcGetDefaultSettings;
let mockJcGetConfigurationById;

const installCjsMocks = (desktopPath) => {
  const electronId = require.resolve('electron');
  rememberCache(electronId);
  require.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: { app: { getPath: () => desktopPath } },
  };

  // Stub JobExecution module used by getOriginalJobConfiguration
  const jeId = require.resolve('../../../src/database/models/JobExecution.js');
  rememberCache(jeId);
  require.cache[jeId] = {
    id: jeId,
    filename: jeId,
    loaded: true,
    exports: {
      JobExecution: function MockJobExecution() {
        return {
          init: mockJeInit,
          getJobExecution: mockJeGetJobExecution,
        };
      },
    },
  };

  // Stub JobConfiguration class required at module load
  const jcId = require.resolve('../../../src/database/models/JobConfiguration.js');
  rememberCache(jcId);
  require.cache[jcId] = {
    id: jcId,
    filename: jcId,
    loaded: true,
    exports: {
      JobConfiguration: function MockJobConfiguration() {
        return {
          init: mockJcInit,
          getDefaultSettings: mockJcGetDefaultSettings,
          getConfigurationById: mockJcGetConfigurationById,
        };
      },
    },
  };

  const sutId = require.resolve('../../../src/services/retryExecutor.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = (desktopPath) => {
  installCjsMocks(desktopPath);
  const RetryExecutor = require('../../../src/services/retryExecutor.js');
  return RetryExecutor;
};

describe('RetryExecutor processQueue + getOriginalJobConfiguration (unit)', () => {
  let tmpRoot;
  let desktopPath;
  let generatedPath;
  let toUploadPath;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJeInit = vi.fn().mockResolvedValue(undefined);
    mockJeGetJobExecution = vi.fn().mockResolvedValue({ success: true, execution: { id: 10, configurationId: 5 } });
    mockJcInit = vi.fn().mockResolvedValue(undefined);
    mockJcGetDefaultSettings = vi.fn().mockReturnValue({
      filePaths: {
        outputDirectory: path.join(os.tmpdir(), 'toupload-default'),
        tempDirectory: path.join(os.tmpdir(), 'generated-default'),
      },
      apiKeys: {},
    });
    mockJcGetConfigurationById = vi.fn().mockResolvedValue({
      success: true,
      configuration: { id: 5, settings: { filePaths: { outputDirectory: path.join(desktopPath || os.tmpdir(), 'out'), tempDirectory: path.join(desktopPath || os.tmpdir(), 'tmp') } } },
    });

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-q-'));
    desktopPath = path.join(tmpRoot, 'desktop');
    generatedPath = path.join(desktopPath, 'gen-image-factory', 'pictures', 'generated');
    toUploadPath = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
    fs.mkdirSync(generatedPath, { recursive: true });
    fs.mkdirSync(toUploadPath, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    restoreCache();
  });

  it('addBatchRetryJob validates inputs and returns error when imageIds missing', async () => {
    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });
    const res = await exec.addBatchRetryJob({ type: 'retry', imageIds: [] });
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('No image IDs');
  });

  it('processQueue executes queued jobs sequentially and emits completion', async () => {
    const RetryExecutor = loadSut(desktopPath);
    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, executionId: 10, tempImagePath: path.join(generatedPath, 'x.png') } }),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
    };
    fs.writeFileSync(path.join(generatedPath, 'x.png'), 'x', 'utf8');

    const exec = new RetryExecutor({ generatedImage });
    // Avoid deep pipeline in this test; focus on queue orchestration
    vi.spyOn(exec, 'processSingleImage').mockResolvedValue({ success: true, message: 'ok' });

    const completed = vi.fn();
    exec.on('job-completed', completed);

    exec.queue.push({ id: 'j1', imageId: 1, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] }, status: 'pending' });

    await exec.processQueue();

    expect(completed).toHaveBeenCalled();
    expect(exec.isProcessing).toBe(false);
  });

  it('getOriginalJobConfiguration returns corrected file paths (defaults if missing custom)', async () => {
    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });
    vi.spyOn(exec, 'delay').mockResolvedValue(undefined);
    // jobConfig instance comes from constructor (mocked JobConfiguration)
    const image = { id: 1, executionId: 10 };
    const cfg = await exec.getOriginalJobConfiguration(image);
    expect(cfg).toHaveProperty('settings.filePaths.outputDirectory');
    expect(cfg).toHaveProperty('settings.filePaths.tempDirectory');
  });

  it('getOriginalJobConfiguration retries getJobExecution once then succeeds', async () => {
    mockJeGetJobExecution
      .mockResolvedValueOnce({ success: false, error: 'nope' })
      .mockResolvedValueOnce({ success: true, execution: { id: 10, configurationId: 5 } });

    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });
    const delaySpy = vi.spyOn(exec, 'delay').mockResolvedValue(undefined);

    const cfg = await exec.getOriginalJobConfiguration({ id: 2, executionId: 10 });
    expect(delaySpy).toHaveBeenCalled();
    expect(cfg).toHaveProperty('settings.filePaths.outputDirectory');
  });

  it('getOriginalJobConfiguration falls back when getJobExecution fails twice', async () => {
    mockJeGetJobExecution
      .mockResolvedValueOnce({ success: false, error: 'nope' })
      .mockResolvedValueOnce({ success: false, error: 'still nope' });

    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });
    vi.spyOn(exec, 'delay').mockResolvedValue(undefined);

    const cfg = await exec.getOriginalJobConfiguration({ id: 3, executionId: 10 });
    expect(cfg).toHaveProperty('id', 'fallback');
    expect(cfg).toHaveProperty('settings.filePaths.outputDirectory');
  });

  it('getOriginalJobConfiguration falls back when execution has no configurationId', async () => {
    mockJeGetJobExecution.mockResolvedValueOnce({ success: true, execution: { id: 10 } });

    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });

    const cfg = await exec.getOriginalJobConfiguration({ id: 4, executionId: 10 });
    expect(cfg).toHaveProperty('id', 'fallback');
  });

  it('getOriginalJobConfiguration retries getConfigurationById once then succeeds', async () => {
    mockJcGetConfigurationById
      .mockResolvedValueOnce({ success: false, error: 'nope' })
      .mockResolvedValueOnce({ success: true, configuration: { id: 5, settings: { filePaths: { outputDirectory: path.join(desktopPath, 'o'), tempDirectory: path.join(desktopPath, 't') } } } });

    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });
    const delaySpy = vi.spyOn(exec, 'delay').mockResolvedValue(undefined);

    const cfg = await exec.getOriginalJobConfiguration({ id: 5, executionId: 10 });
    expect(delaySpy).toHaveBeenCalled();
    expect(cfg.settings.filePaths.outputDirectory).toBe(path.join(desktopPath, 'o'));
  });

  it('getOriginalJobConfiguration falls back when getConfigurationById fails twice', async () => {
    mockJcGetConfigurationById
      .mockResolvedValueOnce({ success: false, error: 'nope' })
      .mockResolvedValueOnce({ success: false, error: 'still nope' });

    const RetryExecutor = loadSut(desktopPath);
    const exec = new RetryExecutor({ generatedImage: {} });
    vi.spyOn(exec, 'delay').mockResolvedValue(undefined);

    const cfg = await exec.getOriginalJobConfiguration({ id: 6, executionId: 10 });
    expect(cfg).toHaveProperty('id', 'fallback');
  });
});

