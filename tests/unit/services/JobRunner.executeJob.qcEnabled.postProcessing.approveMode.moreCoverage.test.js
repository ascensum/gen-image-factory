import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner.executeJob - QC-enabled post-QC processing (approve-mode big paths)', () => {
  // Ensure any other suite's fs mocks don't leak in
  vi.unmock('fs');

  let prevCache = {};

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
  });

  afterEach(() => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('approve mode: processing succeeds and job moves processed image to final', async () => {
    const desktopBase = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-desktop-'));
    patchCjs(req.resolve('electron'), { app: { getPath: vi.fn(() => desktopBase) } });

    const producePictureModule = {
      processImage: vi.fn(async (_src, _name, cfg) => {
        const processed = path.join(cfg.tempDirectory, 'processed.png');
        await fs.mkdir(cfg.tempDirectory, { recursive: true });
        await fs.writeFile(processed, 'p');
        cfg._removeBgApplied = true;
        return processed;
      }),
    };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();
    runner.emitProgress = vi.fn();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-src-'));
    const sourcePath = path.join(tmpDir, 'src.png');
    await fs.writeFile(sourcePath, 'x');

    const backendAdapter = {
      updateQCStatusByMappingId: vi.fn(async () => ({ success: true, changes: 1 })),
      updateQCStatus: vi.fn(async () => ({ success: true, changes: 1 })),
      updateImagePathsByMappingId: vi.fn(async () => ({ success: true })),
      updateJobExecution: vi.fn(async () => ({ success: true })),
      updateJobExecutionStatistics: vi.fn(async () => ({ success: true })),
      getJobExecution: vi.fn(async () => ({ success: true, changes: 1, execution: {} })),
      getGeneratedImagesByExecution: vi.fn(async () => ({ success: true, images: [] })),
    };
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 10;
    runner.configurationId = 'cfg';

    const config = {
      apiKeys: { openai: 'k', runware: 'rw' },
      ai: { runQualityCheck: true, runMetadataGen: false },
      processing: { removeBg: true, removeBgFailureMode: 'approve' },
      filePaths: { outputDirectory: tmpDir, tempDirectory: tmpDir },
      parameters: { processMode: 'relax', enablePollingTimeout: false, pollingTimeout: 1 },
    };
    runner.jobConfiguration = config;

    runner.generateParameters = vi.fn(async () => ({ prompt: 'p', promptContext: '', aspectRatios: ['1:1'] }));
    runner.generateImages = vi.fn(async () => ([]));

    const dbImg = {
      imageMappingId: 'map-a',
      qcStatus: 'approved',
      qcReason: null,
      tempImagePath: sourcePath,
      finalImagePath: null,
      processingSettings: JSON.stringify({ removeBg: true, removeBgFailureMode: 'approve' }),
    };
    const finalPath = path.join(tmpDir, 'final.png');
    runner.getSavedImagesForExecution = vi.fn()
      .mockResolvedValueOnce([dbImg]) // metadata step
      .mockResolvedValueOnce([dbImg]) // qc/move step
      .mockResolvedValueOnce([{ ...dbImg, finalImagePath: finalPath }]); // reconcile step

    runner.runQualityChecks = vi.fn(async () => undefined);
    runner.moveImageToFinalLocation = vi.fn(async () => finalPath);

    await expect(runner.executeJob(config, 'job-1')).resolves.toBeUndefined();

    expect(producePictureModule.processImage).toHaveBeenCalled();
    expect(runner.moveImageToFinalLocation).toHaveBeenCalledWith(expect.stringMatching(/processed\.png$/), 'map-a');
    expect(backendAdapter.updateImagePathsByMappingId).toHaveBeenCalledWith('map-a', null, finalPath);
    // Approve-mode should not mark qc_failed
    expect(backendAdapter.updateQCStatusByMappingId).not.toHaveBeenCalledWith('map-a', 'qc_failed', expect.any(String));
  });

  it('approve mode: move returns null but fallback persists processed path as final', async () => {
    const desktopBase = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-desktop-'));
    patchCjs(req.resolve('electron'), { app: { getPath: vi.fn(() => desktopBase) } });

    const producePictureModule = {
      processImage: vi.fn(async (_src, _name, cfg) => {
        const processed = path.join(cfg.tempDirectory, 'processed.png');
        await fs.mkdir(cfg.tempDirectory, { recursive: true });
        await fs.writeFile(processed, 'p');
        cfg._removeBgApplied = true;
        return processed;
      }),
    };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();
    runner.emitProgress = vi.fn();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-src-'));
    const sourcePath = path.join(tmpDir, 'src.png');
    await fs.writeFile(sourcePath, 'x');

    const backendAdapter = {
      updateImagePathsByMappingId: vi.fn(async () => ({ success: true })),
      updateJobExecution: vi.fn(async () => ({ success: true })),
      updateJobExecutionStatistics: vi.fn(async () => ({ success: true })),
      getJobExecution: vi.fn(async () => ({ success: true, changes: 1, execution: {} })),
      getGeneratedImagesByExecution: vi.fn(async () => ({ success: true, images: [] })),
    };
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 11;
    runner.configurationId = 'cfg';

    const config = {
      apiKeys: { openai: 'k', runware: 'rw' },
      ai: { runQualityCheck: true, runMetadataGen: false },
      processing: { removeBg: true, removeBgFailureMode: 'approve' },
      filePaths: { outputDirectory: tmpDir, tempDirectory: tmpDir },
      parameters: { processMode: 'relax', enablePollingTimeout: false, pollingTimeout: 1 },
    };
    runner.jobConfiguration = config;

    runner.generateParameters = vi.fn(async () => ({ prompt: 'p', promptContext: '', aspectRatios: ['1:1'] }));
    runner.generateImages = vi.fn(async () => ([]));

    const processedDir = path.join(desktopBase, 'gen-image-factory', 'pictures', 'temp_processing');
    const processedPath = path.join(processedDir, 'processed.png');
    const dbImg = {
      imageMappingId: 'map-b',
      qcStatus: 'approved',
      qcReason: null,
      tempImagePath: sourcePath,
      finalImagePath: null,
      processingSettings: JSON.stringify({ removeBg: true, removeBgFailureMode: 'approve' }),
    };
    runner.getSavedImagesForExecution = vi.fn()
      .mockResolvedValueOnce([dbImg]) // metadata step
      .mockResolvedValueOnce([dbImg]) // qc/move step
      .mockResolvedValueOnce([{ ...dbImg, finalImagePath: processedPath }]); // reconcile step

    runner.runQualityChecks = vi.fn(async () => undefined);
    runner.moveImageToFinalLocation = vi.fn(async () => null); // trigger fallback

    await expect(runner.executeJob(config, 'job-2')).resolves.toBeUndefined();

    expect(producePictureModule.processImage).toHaveBeenCalled();
    expect(fsSync.existsSync(processedPath)).toBe(true);
    // fallback persisted processedPath as final
    expect(backendAdapter.updateImagePathsByMappingId).toHaveBeenCalledWith('map-b', null, processedPath);
  });
});

