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
        metadata: payload.metadata,
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
    updateQCStatus: vi.fn(async (_id, _status, _reason) => ({ success: true, changes: 1 })),
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

describe('JobRunner.executeJob (QC enabled + removeBgFailureMode=mark_failed)', () => {
  let runner;
  let prevGlobalRunner;
  let baseDir;
  let tempDir;
  let outDir;
  let prevRemoveBg;
  let JobRunner;
  let producePictureModule;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;
    prevRemoveBg = process.env.REMOVE_BG_API_KEY;
    mockProduce.producePictureModule.mockReset();
    mockProduce.processImage.mockReset();

    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrunner-qc-markfailed-'));
    tempDir = path.join(baseDir, 'generated');
    outDir = path.join(baseDir, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    ({ JobRunner } = loadSut());
    producePictureModule = mockProduce;
    runner = new JobRunner({ parameters: { count: 1 } });
    runner.configurationId = 111;
    runner.databaseExecutionId = 222;
  });

  afterEach(() => {
    process.env.REMOVE_BG_API_KEY = prevRemoveBg;
    global.currentJobRunner = prevGlobalRunner;
    try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('marks qc_failed and skips moving to final when REMOVE_BG_API_KEY is missing (mark_failed)', async () => {
    process.env.REMOVE_BG_API_KEY = '';

    const { adapter, store } = createInMemoryAdapter();
    runner.backendAdapter = adapter;

    const src = path.join(tempDir, 'img1.png');
    fs.writeFileSync(src, 'x');

    const jobConfig = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { tempDirectory: tempDir, outputDirectory: outDir },
      parameters: { processMode: 'single', count: 1, enablePollingTimeout: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      ai: { runQualityCheck: true, runMetadataGen: true },
    };
    runner.jobConfiguration = jobConfig;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      { path: src, status: 'generated', mappingId: 'm1', aspectRatio: '1:1', metadata: { prompt: 'p' } },
    ]);
    vi.spyOn(runner, 'generateMetadata').mockResolvedValueOnce(undefined);
    vi.spyOn(runner, 'runQualityChecks').mockImplementation(async (images) => {
      // simulate QC pass so processing branch is entered
      for (const img of images) {
        img.qcStatus = 'approved';
        img.qcReason = 'ok';
        await adapter.updateQCStatusByMappingId(img.imageMappingId || img.mappingId, 'approved', 'ok');
      }
    });

    producePictureModule.processImage.mockImplementation(async () => {
      throw new Error('should not be called when key missing');
    });

    await expect(runner.executeJob(jobConfig, 'job-1')).resolves.toBeUndefined();

    expect(adapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m1', 'qc_failed', 'processing_failed:remove_bg');
    expect(adapter.updateImagePathsByMappingId).not.toHaveBeenCalled();
    expect(store.images.find((i) => i.imageMappingId === 'm1')?.finalImagePath).toBe(null);
    // source still exists in generated folder
    expect(fs.existsSync(src)).toBe(true);
  });

  it('moves to final when remove.bg applied successfully in mark_failed mode', async () => {
    process.env.REMOVE_BG_API_KEY = 'present';

    const { adapter, store } = createInMemoryAdapter();
    runner.backendAdapter = adapter;

    const src = path.join(tempDir, 'img1.png');
    fs.writeFileSync(src, 'x');

    const jobConfig = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { tempDirectory: tempDir, outputDirectory: outDir },
      parameters: { processMode: 'single', count: 1, enablePollingTimeout: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      ai: { runQualityCheck: true, runMetadataGen: false },
    };
    runner.jobConfiguration = jobConfig;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      { path: src, status: 'generated', mappingId: 'm1', aspectRatio: '1:1', metadata: { prompt: 'p' } },
    ]);
    vi.spyOn(runner, 'runQualityChecks').mockImplementation(async (images) => {
      for (const img of images) {
        img.qcStatus = 'approved';
        img.qcReason = 'ok';
      }
    });

    producePictureModule.processImage.mockImplementation(async (_srcPath, _name, cfg) => {
      // mark applied and emit a processed file in temp processing dir
      cfg._removeBgApplied = true;
      const outPath = path.join(cfg.outputDirectory, 'processed.png');
      await fs.promises.writeFile(outPath, 'processed');
      return outPath;
    });

    await expect(runner.executeJob(jobConfig, 'job-2')).resolves.toBeUndefined();

    const final = store.images.find((i) => i.imageMappingId === 'm1')?.finalImagePath;
    expect(typeof final).toBe('string');
    expect(final).toContain(outDir);
    expect(fs.existsSync(final)).toBe(true);
    expect(adapter.updateImagePathsByMappingId).toHaveBeenCalled();
  });

  it('forces qc_failed and skips final move when remove.bg did not apply (mark_failed)', async () => {
    process.env.REMOVE_BG_API_KEY = 'present';

    const { adapter, store } = createInMemoryAdapter();
    runner.backendAdapter = adapter;

    const src = path.join(tempDir, 'img1.png');
    fs.writeFileSync(src, 'x');

    const jobConfig = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { tempDirectory: tempDir, outputDirectory: outDir },
      parameters: { processMode: 'single', count: 1, enablePollingTimeout: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      ai: { runQualityCheck: true, runMetadataGen: false },
    };
    runner.jobConfiguration = jobConfig;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      { path: src, status: 'generated', mappingId: 'm1', aspectRatio: '1:1', metadata: { prompt: 'p' } },
    ]);
    vi.spyOn(runner, 'runQualityChecks').mockImplementation(async (images) => {
      for (const img of images) img.qcStatus = 'approved';
    });

    producePictureModule.processImage.mockImplementation(async (_srcPath, _name, cfg) => {
      cfg._removeBgApplied = false;
      const outPath = path.join(cfg.outputDirectory, 'processed.png');
      await fs.promises.writeFile(outPath, 'processed');
      return outPath;
    });

    await expect(runner.executeJob(jobConfig, 'job-3')).resolves.toBeUndefined();

    expect(adapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m1', 'qc_failed', 'processing_failed:remove_bg');
    expect(store.images.find((i) => i.imageMappingId === 'm1')?.finalImagePath).toBe(null);
  });

  it('forces qc_failed and skips final move when remove.bg soft-failed (mark_failed)', async () => {
    process.env.REMOVE_BG_API_KEY = 'present';

    const { adapter, store } = createInMemoryAdapter();
    runner.backendAdapter = adapter;

    const src = path.join(tempDir, 'img1.png');
    fs.writeFileSync(src, 'x');

    const jobConfig = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { tempDirectory: tempDir, outputDirectory: outDir },
      parameters: { processMode: 'single', count: 1, enablePollingTimeout: false },
      processing: { removeBg: true, removeBgFailureMode: 'mark_failed' },
      ai: { runQualityCheck: true, runMetadataGen: false },
    };
    runner.jobConfiguration = jobConfig;

    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      { path: src, status: 'generated', mappingId: 'm1', aspectRatio: '1:1', metadata: { prompt: 'p' } },
    ]);
    vi.spyOn(runner, 'runQualityChecks').mockImplementation(async (images) => {
      for (const img of images) img.qcStatus = 'approved';
    });

    producePictureModule.processImage.mockImplementation(async (_srcPath, _name, cfg) => {
      cfg._removeBgApplied = true;
      cfg._softFailures.push({ stage: 'remove_bg', vendor: 'removebg', message: 'timeout' });
      const outPath = path.join(cfg.outputDirectory, 'processed.png');
      await fs.promises.writeFile(outPath, 'processed');
      return outPath;
    });

    await expect(runner.executeJob(jobConfig, 'job-4')).resolves.toBeUndefined();

    expect(adapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m1', 'qc_failed', 'processing_failed:remove_bg');
    expect(store.images.find((i) => i.imageMappingId === 'm1')?.finalImagePath).toBe(null);
  });
});

