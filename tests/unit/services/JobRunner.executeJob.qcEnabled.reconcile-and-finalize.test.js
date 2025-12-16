import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, req.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) req.cache[id] = entry;
    else delete req.cache[id];
  }
  originalCache.clear();
};

const mockProduce = { producePictureModule: vi.fn(), processImage: vi.fn() };
const installCjsMocks = () => {
  const produceId = req.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  req.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: mockProduce };

  const paramsId = req.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  req.cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: {} };

  const aiVisionId = req.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  req.cache[aiVisionId] = { id: aiVisionId, filename: aiVisionId, loaded: true, exports: {} };

  const sutId = req.resolve('../../../src/services/jobRunner.js');
  rememberCache(sutId);
  delete req.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return req('../../../src/services/jobRunner.js');
};

function createInMemoryAdapter() {
  const store = { images: [] };
  const adapter = {
    saveGeneratedImage: vi.fn(async (payload) => {
      store.images.push({
        id: store.images.length + 1,
        executionId: payload.executionId,
        imageMappingId: payload.imageMappingId,
        tempImagePath: payload.tempImagePath,
        finalImagePath: payload.finalImagePath,
        qcStatus: payload.qcStatus,
        qcReason: payload.qcReason,
        processingSettings: payload.processingSettings,
      });
      return { success: true, id: store.images.length };
    }),
    getAllGeneratedImages: vi.fn(async () => ({ success: true, images: store.images })),
    getGeneratedImagesByExecution: vi.fn(async (executionId) => ({
      success: true,
      images: store.images.filter((i) => i.executionId === executionId),
    })),
    updateQCStatusByMappingId: vi.fn(async (mappingId, status, reason) => {
      const img = store.images.find((i) => i.imageMappingId === mappingId);
      if (img) { img.qcStatus = status; img.qcReason = reason; }
      return { success: true, changes: 1 };
    }),
    updateImagePathsByMappingId: vi.fn(async (mappingId, tempPath, finalPath) => {
      const img = store.images.find((i) => i.imageMappingId === mappingId);
      if (img) { img.tempImagePath = tempPath; img.finalImagePath = finalPath; }
      return { success: true };
    }),
    updateGeneratedImageByMappingId: vi.fn(async () => ({ success: true })),
    updateJobExecution: vi.fn(async () => ({ success: true })),
  };
  return { adapter, store };
}

describe('JobRunner.executeJob (QC enabled) reconcile + finalize scenarios', () => {
  let JobRunner;
  let runner;
  let prevGlobalRunner;
  let baseDir;
  let tempDir;
  let outDir;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProduce.producePictureModule.mockReset();
    mockProduce.processImage.mockReset();

    prevGlobalRunner = global.currentJobRunner;
    ({ JobRunner } = loadSut());

    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrunner-qc-reconcile-'));
    tempDir = path.join(baseDir, 'generated');
    outDir = path.join(baseDir, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    runner = new JobRunner({ parameters: { count: 1 } });
    runner.configurationId = 100;
    runner.databaseExecutionId = 200;
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
    try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('when initial move fails, reconciles approved image final path and waits for QC settle', async () => {
    const { adapter, store } = createInMemoryAdapter();
    runner.backendAdapter = adapter;

    const src = path.join(tempDir, 'img1.png');
    fs.writeFileSync(src, 'x');

    const jobConfig = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { tempDirectory: tempDir, outputDirectory: outDir },
      parameters: { processMode: 'single', count: 1, enablePollingTimeout: false },
      processing: { removeBg: true, removeBgFailureMode: 'approve' },
      ai: { runQualityCheck: true, runMetadataGen: false },
    };
    runner.jobConfiguration = jobConfig;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      { path: src, status: 'generated', mappingId: 'm1', aspectRatio: '1:1', metadata: { prompt: 'p' } },
    ]);

    // Ensure QC marks approved in DB record so QC/move phase runs on it
    vi.spyOn(runner, 'runQualityChecks').mockImplementation(async (images) => {
      for (const img of images) {
        const key = img.imageMappingId || img.mappingId;
        img.qcStatus = 'approved';
        img.qcReason = 'ok';
        await adapter.updateQCStatusByMappingId(key, 'approved', 'ok');
      }
    });

    // processing returns a non-existent path to avoid fallback-to-persist-final in the QC/move phase
    mockProduce.processImage.mockResolvedValueOnce(path.join(baseDir, 'nonexistent-processed.png'));

    // First move attempt (QC/move phase) fails, second move (reconcile phase) succeeds.
    const dest = path.join(outDir, 'm1_img1.png');
    const moveSpy = vi.spyOn(runner, 'moveImageToFinalLocation')
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async (sourcePath, imageMappingId) => {
        const finalPath = path.join(outDir, `${imageMappingId}_${path.basename(sourcePath)}`);
        // Simulate a successful move by writing a file at finalPath
        await fs.promises.writeFile(finalPath, 'moved');
        return finalPath;
      });

    const settleSpy = vi.spyOn(runner, 'waitForQCToSettle').mockResolvedValue(true);

    await expect(runner.executeJob(jobConfig, 'job-1')).resolves.toBeUndefined();

    // move called at least twice: QC/move phase and reconcile phase
    expect(moveSpy).toHaveBeenCalled();
    expect(moveSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    // final path reconciled in DB
    expect(adapter.updateImagePathsByMappingId).toHaveBeenCalled();
    expect(store.images.find((i) => i.imageMappingId === 'm1')?.finalImagePath).toBeTruthy();
    expect(fs.existsSync(dest)).toBe(true);

    // QC finalize wait executed
    expect(settleSpy).toHaveBeenCalledWith(200, expect.any(Number));
  });
});

