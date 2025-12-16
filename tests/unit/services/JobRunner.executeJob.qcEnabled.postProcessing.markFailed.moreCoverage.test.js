import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner.executeJob - QC-enabled post-QC processing (mark_failed big paths)', () => {
  let prevCache = {};
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};
    prevEnv = { REMOVE_BG_API_KEY: process.env.REMOVE_BG_API_KEY };
  });

  afterEach(() => {
    process.env.REMOVE_BG_API_KEY = prevEnv.REMOVE_BG_API_KEY;
    prevEnv = {};
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('mark_failed: missing REMOVE_BG_API_KEY marks qc_failed and skips processing+move', async () => {
    const desktopBase = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-desktop-'));
    patchCjs(req.resolve('electron'), { app: { getPath: vi.fn(() => desktopBase) } });

    const producePictureModule = { processImage: vi.fn() };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    process.env.REMOVE_BG_API_KEY = '';

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-src-'));
    const sourcePath = path.join(tmpDir, 'src.png');
    await fs.writeFile(sourcePath, 'x');

    const backendAdapter = {
      updateQCStatusByMappingId: vi.fn(async () => ({ success: true, changes: 1 })),
      updateQCStatus: vi.fn(async () => ({ success: true, changes: 1 })),
      updateImagePathsByMappingId: vi.fn(async () => ({ success: true })),
      getAllGeneratedImages: vi.fn(async () => ({ success: true, images: [] })),
    };
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 1;

    runner.jobConfiguration = {
      ai: { runQualityCheck: true, runMetadataGen: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      filePaths: { outputDirectory: tmpDir, tempDirectory: tmpDir },
      parameters: { processMode: 'relax', enablePollingTimeout: false, pollingTimeout: 1 },
    };

    // Skip earlier stages, jump straight to QC/move phase images
    runner.generateParameters = vi.fn(async () => ({ prompt: 'p', promptContext: '', aspectRatios: ['1:1'] }));
    runner.generateImages = vi.fn(async () => ([]));
    runner.getSavedImagesForExecution = vi.fn(async () => ([
      { imageMappingId: 'map-1', qcStatus: 'approved', qcReason: null, tempImagePath: sourcePath, finalImagePath: null, processingSettings: JSON.stringify({ removeBg: true, removeBgFailureMode: 'mark_failed' }) },
    ]));
    runner.runQualityChecks = vi.fn(async () => undefined);
    runner.moveImageToFinalLocation = vi.fn(async () => path.join(tmpDir, 'final.png'));
    runner.updateImagePaths = vi.fn(async () => true);

    await expect(runner.executeJob(runner.jobConfiguration, 'job-1')).resolves.toBeUndefined();

    expect(producePictureModule.processImage).not.toHaveBeenCalled();
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map-1', 'qc_failed', 'processing_failed:remove_bg');
    expect(runner.moveImageToFinalLocation).not.toHaveBeenCalled();
  });

  it('mark_failed: remove.bg not applied forces qc_failed and skips move', async () => {
    const desktopBase = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-desktop-'));
    patchCjs(req.resolve('electron'), { app: { getPath: vi.fn(() => desktopBase) } });

    const producePictureModule = {
      processImage: vi.fn(async (_src, _name, cfg) => {
        cfg._removeBgApplied = false;
        return path.join(cfg.tempDirectory, 'processed.png');
      }),
    };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    process.env.REMOVE_BG_API_KEY = 'k';

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-src-'));
    const sourcePath = path.join(tmpDir, 'src.png');
    await fs.writeFile(sourcePath, 'x');

    const backendAdapter = {
      updateQCStatusByMappingId: vi.fn(async () => ({ success: true, changes: 1 })),
      updateQCStatus: vi.fn(async () => ({ success: true, changes: 1 })),
      updateImagePathsByMappingId: vi.fn(async () => ({ success: true })),
      getAllGeneratedImages: vi.fn(async () => ({ success: true, images: [] })),
    };
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 1;

    runner.jobConfiguration = {
      ai: { runQualityCheck: true, runMetadataGen: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      filePaths: { outputDirectory: tmpDir, tempDirectory: tmpDir },
      parameters: { processMode: 'relax', enablePollingTimeout: false, pollingTimeout: 1 },
    };

    runner.generateParameters = vi.fn(async () => ({ prompt: 'p', promptContext: '', aspectRatios: ['1:1'] }));
    runner.generateImages = vi.fn(async () => ([]));
    runner.getSavedImagesForExecution = vi.fn(async () => ([
      { imageMappingId: 'map-2', qcStatus: 'approved', qcReason: null, tempImagePath: sourcePath, finalImagePath: null, processingSettings: JSON.stringify({ removeBg: true, removeBgFailureMode: 'mark_failed' }) },
    ]));
    runner.runQualityChecks = vi.fn(async () => undefined);
    runner.moveImageToFinalLocation = vi.fn(async () => path.join(tmpDir, 'final.png'));
    runner.updateImagePaths = vi.fn(async () => true);

    await expect(runner.executeJob(runner.jobConfiguration, 'job-1')).resolves.toBeUndefined();

    expect(producePictureModule.processImage).toHaveBeenCalled();
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map-2', 'qc_failed', 'processing_failed:remove_bg');
    expect(runner.moveImageToFinalLocation).not.toHaveBeenCalled();
  });

  it('mark_failed: remove.bg applied allows move to final and path update', async () => {
    const desktopBase = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-desktop-'));
    patchCjs(req.resolve('electron'), { app: { getPath: vi.fn(() => desktopBase) } });

    const producePictureModule = {
      processImage: vi.fn(async (_src, _name, cfg) => {
        cfg._removeBgApplied = true;
        return path.join(cfg.tempDirectory, 'processed.png');
      }),
    };
    patchCjs(req.resolve('../../../src/producePictureModule.js'), producePictureModule);
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    process.env.REMOVE_BG_API_KEY = 'k';

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-src-'));
    const sourcePath = path.join(tmpDir, 'src.png');
    await fs.writeFile(sourcePath, 'x');

    const backendAdapter = {
      updateQCStatusByMappingId: vi.fn(async () => ({ success: true, changes: 1 })),
      updateQCStatus: vi.fn(async () => ({ success: true, changes: 1 })),
      updateImagePathsByMappingId: vi.fn(async () => ({ success: true })),
      getAllGeneratedImages: vi.fn(async () => ({ success: true, images: [] })),
    };
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 1;

    runner.jobConfiguration = {
      ai: { runQualityCheck: true, runMetadataGen: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      filePaths: { outputDirectory: tmpDir, tempDirectory: tmpDir },
      parameters: { processMode: 'relax', enablePollingTimeout: false, pollingTimeout: 1 },
    };

    runner.generateParameters = vi.fn(async () => ({ prompt: 'p', promptContext: '', aspectRatios: ['1:1'] }));
    runner.generateImages = vi.fn(async () => ([]));
    const dbImg = { imageMappingId: 'map-3', qcStatus: 'approved', qcReason: null, tempImagePath: sourcePath, finalImagePath: null, processingSettings: JSON.stringify({ removeBg: true, removeBgFailureMode: 'mark_failed' }) };
    // executeJob calls getSavedImagesForExecution multiple times (metadata, qc/move, reconcile). Ensure that by the time
    // the safety reconcile runs, the image has a finalImagePath, otherwise Mark Failed mode will force qc_failed.
    runner.getSavedImagesForExecution = vi.fn()
      .mockResolvedValueOnce([dbImg]) // metadata step
      .mockResolvedValueOnce([dbImg]) // qc/move step
      .mockResolvedValueOnce([{ ...dbImg, finalImagePath: path.join(tmpDir, 'final.png') }]); // reconcile step
    runner.runQualityChecks = vi.fn(async () => undefined);

    const finalPath = path.join(tmpDir, 'final.png');
    runner.moveImageToFinalLocation = vi.fn(async () => finalPath);
    runner.updateImagePaths = vi.fn(async () => true);

    await expect(runner.executeJob(runner.jobConfiguration, 'job-1')).resolves.toBeUndefined();

    expect(producePictureModule.processImage).toHaveBeenCalled();
    expect(backendAdapter.updateQCStatusByMappingId).not.toHaveBeenCalledWith('map-3', 'qc_failed', expect.any(String));
    expect(runner.moveImageToFinalLocation).toHaveBeenCalledWith(expect.stringMatching(/processed\.png$/), 'map-3');
    expect(runner.updateImagePaths).toHaveBeenCalledWith('map-3', null, finalPath);
  });
});

