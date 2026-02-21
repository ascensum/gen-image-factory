import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner.startJob - prompt loading + DB save snapshot (unit, isolated)', () => {
  let prevCache = {};
  let prevGlobalBackendAdapter;
  let prevEnv = {};

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const patchCjs = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };

  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/jobRunner.js');
    remember(sutId);
    delete req.cache[sutId];
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};
    prevGlobalBackendAdapter = global.backendAdapter;
    prevEnv = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      RUNWARE_API_KEY: process.env.RUNWARE_API_KEY,
      REMOVE_BG_API_KEY: process.env.REMOVE_BG_API_KEY,
      DEBUG_MODE: process.env.DEBUG_MODE,
    };
  });

  afterEach(() => {
    global.backendAdapter = prevGlobalBackendAdapter;
    process.env.OPENAI_API_KEY = prevEnv.OPENAI_API_KEY;
    process.env.RUNWARE_API_KEY = prevEnv.RUNWARE_API_KEY;
    process.env.REMOVE_BG_API_KEY = prevEnv.REMOVE_BG_API_KEY;
    process.env.DEBUG_MODE = prevEnv.DEBUG_MODE;
    prevEnv = {};
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('loads qualityCheckPromptFile + metadataPromptFile and saves job execution snapshot without apiKeys', async () => {
    // Patch heavy deps (they are required at module scope)
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    // Prevent the massive executeJob from running here; focus on startJob behavior.
    runner.executeJob = vi.fn().mockResolvedValue(undefined);
    runner.configurationId = 'cfg-123';

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-prompts-'));
    const qcPath = path.join(tmpDir, 'qc.txt');
    const mdPath = path.join(tmpDir, 'md.txt');
    await fs.writeFile(qcPath, 'QC TEMPLATE');
    await fs.writeFile(mdPath, 'MD TEMPLATE');

    const saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 456 });
    global.backendAdapter = {
      saveJobExecution,
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
    };

    const config = {
      apiKeys: { openai: 'SECRET_OPENAI', runware: 'SECRET_RUNWARE', piapi: 'SECRET_PIAPI' },
      filePaths: {
        outputDirectory: path.join(tmpDir, 'out'),
        tempDirectory: path.join(tmpDir, 'tmp'),
        qualityCheckPromptFile: qcPath,
        metadataPromptFile: mdPath,
      },
      parameters: {
        label: 'My Label',
        processMode: 'relax',
        count: 1,
        variations: 1,
        runwareModel: 'runware:abc',
        runwareFormat: 'png',
        runwareAdvanced: { steps: 20 },
      },
      processing: { removeBgFailureMode: 'mark_failed' },
      ai: { runQualityCheck: true, runMetadataGen: true },
      advanced: { debugMode: true },
    };

    const res = await runner.startJob(config);
    expect(res.success).toBe(true);
    expect(runner.databaseExecutionId).toBe(456);

    // Prompts loaded from files
    expect(config.ai.qualityCheckPrompt).toBe('QC TEMPLATE');
    expect(config.ai.metadataPrompt).toBe('MD TEMPLATE');

    expect(saveJobExecution).toHaveBeenCalledTimes(1);
    const payload = saveJobExecution.mock.calls[0][0];
    expect(payload.configurationId).toBe('cfg-123');
    expect(payload.label).toBe('My Label');
    expect(payload.configurationSnapshot).toBeDefined();
    expect(payload.configurationSnapshot.apiKeys).toBeUndefined(); // sanitized out
    expect(payload.configurationSnapshot.parameters.runwareAdvancedEnabled).toBe(true);
    expect(payload.configurationSnapshot.processing.removeBgFailureMode).toBe('mark_failed');
  });

  it('clears rerun flag when isRerun=true but no databaseExecutionId was provided', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner({ isRerun: true });
    runner.executeJob = vi.fn().mockResolvedValue(undefined);
    runner.databaseExecutionId = null;
    runner.persistedLabel = 'prev';

    global.backendAdapter = { saveJobExecution: vi.fn(), updateJobExecution: vi.fn() };

    const res = await runner.startJob({
      apiKeys: { openai: 'k', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' },
      parameters: { processMode: 'relax', count: 1, variations: 1, runwareModel: 'runware:abc', runwareFormat: 'png' },
      processing: {},
      ai: {},
      advanced: {},
    });
    expect(res.success).toBe(true);
    expect(runner.isRerun).toBe(false);
    expect(String(runner.persistedLabel)).toMatch(/^job_/);
  });
});

