import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner full pipeline (Runware + QC + metadata + post-processing) (more coverage)', () => {
  let prevCache = {};
  let prevGlobalBackendAdapter;

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const patchCjs = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };

  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/jobRunner.js');
    remember(sutId);
    delete req.cache[sutId];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};
    prevGlobalBackendAdapter = global.backendAdapter;
  });

  afterEach(() => {
    global.backendAdapter = prevGlobalBackendAdapter;
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('runs end-to-end happy path without real external IO', async () => {
    // Let JobRunner._logStructured run (coverage) but silence console noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-full-'));
    const tmpDir = path.join(tmpRoot, 'tmp');
    const outDir = path.join(tmpRoot, 'out');
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });

    const mockAiVision = {
      runQualityCheck: vi.fn(async () => ({ passed: true, reason: 'ok' })),
      generateMetadata: vi.fn(async () => ({ new_title: 'T', new_description: 'D', upload_tags: 'a,b' })),
    };

    const mockParamsGeneratorModule = {
      paramsGeneratorModule: vi.fn(async () => ({ prompt: 'A prompt', promptContext: 'ctx' })),
    };

    const mockProducePictureModule = {
      // Called by JobRunner.generateImages()
      producePictureModule: vi.fn(async (_settings, imgNameBase, _metaPrompt, moduleConfig) => {
        const file1 = path.join(moduleConfig.outputDirectory, `${imgNameBase}_1.png`);
        const file2 = path.join(moduleConfig.outputDirectory, `${imgNameBase}_2.png`);
        await fs.writeFile(file1, 'x');
        await fs.writeFile(file2, 'y');
        return [
          { outputPath: file1, mappingId: 'm1', settings: {} },
          { outputPath: file2, mappingId: 'm2', settings: {} },
        ];
      }),
      // Called by executeJob() QC-approved post-processing
      processImage: vi.fn(async (srcPath, _srcName, cfg) => {
        const processed = path.join(cfg.tempDirectory, `processed_${path.basename(srcPath)}`);
        await fs.copyFile(srcPath, processed);
        cfg._removeBgApplied = true;
        return processed;
      }),
    };

    patchCjs(req.resolve('../../../src/aiVision.js'), mockAiVision);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), mockParamsGeneratorModule);
    patchCjs(req.resolve('../../../src/producePictureModule.js'), mockProducePictureModule);

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    const store = [];
    const backendAdapter = {
      saveJobExecution: vi.fn(async () => ({ success: true, id: 101 })),
      updateJobExecution: vi.fn(async () => ({ success: true })),
      updateJobExecutionStatistics: vi.fn(async () => ({ success: true })),
      getJobExecution: vi.fn(async () => ({ success: true, execution: { id: 101 } })),

      saveGeneratedImage: vi.fn(async (img) => {
        store.push({ ...img, id: store.length + 1 });
        return { success: true, id: store.length };
      }),
      getAllGeneratedImages: vi.fn(async () => ({ success: true, images: store })),

      updateGeneratedImageByMappingId: vi.fn(async (mappingId, patch) => {
        const idx = store.findIndex((x) => x.imageMappingId === mappingId || x.mappingId === mappingId);
        if (idx >= 0) store[idx] = { ...store[idx], ...patch };
        return { success: true };
      }),

      updateQCStatusByMappingId: vi.fn(async (mappingId, qcStatus, qcReason) => {
        const idx = store.findIndex((x) => x.imageMappingId === mappingId || x.mappingId === mappingId);
        if (idx >= 0) store[idx] = { ...store[idx], qcStatus, qcReason };
        return { success: true };
      }),

      updateImagePathsByMappingId: vi.fn(async (mappingId, tempImagePath, finalImagePath) => {
        const idx = store.findIndex((x) => x.imageMappingId === mappingId || x.mappingId === mappingId);
        if (idx >= 0) store[idx] = { ...store[idx], tempImagePath, finalImagePath };
        return { success: true };
      }),

      processNextBulkRerunJob: vi.fn(async () => ({ success: false, message: 'No jobs in queue' })),
    };

    // Let startJob pick it up via global.backendAdapter.
    global.backendAdapter = backendAdapter;

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw', removeBg: 'rb' },
      filePaths: { outputDirectory: outDir, tempDirectory: tmpDir },
      parameters: {
        processMode: 'relax',
        count: 1,
        variations: 2,
        enablePollingTimeout: false,
        pollingTimeout: 1,
        runwareModel: 'runware:101@1',
        runwareFormat: 'png',
        runwareDimensionsCsv: '1024x1024',
      },
      processing: { removeBg: true, removeBgFailureMode: 'approve' },
      ai: { runQualityCheck: true, runMetadataGen: true },
      advanced: { debugMode: false },
    };

    // Ensure JobRunner saves execution under this configurationId
    runner.configurationId = 55;

    const startRes = await runner.startJob(config);
    expect(startRes.success).toBe(true);

    // startJob fires executeJob asynchronously; wait for it to complete
    await expect(runner.currentJob).resolves.toBeUndefined();

    // We should have persisted images and advanced through QC + move
    expect(backendAdapter.saveJobExecution).toHaveBeenCalled();
    expect(backendAdapter.saveGeneratedImage).toHaveBeenCalledTimes(2);
    expect(mockAiVision.generateMetadata).toHaveBeenCalled();
    expect(mockAiVision.runQualityCheck).toHaveBeenCalled();

    // Final paths should be present after move
    const finals = store.map((x) => x.finalImagePath).filter(Boolean);
    expect(finals.length).toBeGreaterThanOrEqual(1);

    // Job should complete
    expect(runner.jobState.status).toBe('completed');
  }, 60000);
});
