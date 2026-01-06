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

const mockProducePictureModule = { producePictureModule: vi.fn() };
const mockParamsGeneratorModule = { paramsGeneratorModule: vi.fn() };
const mockAiVision = { runQualityCheck: vi.fn(), generateMetadata: vi.fn() };

const installCjsMocks = () => {
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: mockProducePictureModule };

  const paramsId = require.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  require.cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: mockParamsGeneratorModule };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = { id: aiVisionId, filename: aiVisionId, loaded: true, exports: mockAiVision };

  // Minimal electron surface for getPath('desktop') if any path logic is hit
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

describe('JobRunner.executeJob (QC + metadata enabled, integration-like)', () => {
  let tmpRoot;
  let tempDir;
  let outDir;
  let backendAdapter;
  let prevGlobalBackendAdapter;
  let prevProcessBackendAdapter;
  let prevGlobalRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProducePictureModule.producePictureModule.mockReset();
    mockParamsGeneratorModule.paramsGeneratorModule.mockReset();
    mockAiVision.runQualityCheck.mockReset();
    mockAiVision.generateMetadata.mockReset();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrunner-qc-'));
    tempDir = path.join(tmpRoot, 'generated');
    outDir = path.join(tmpRoot, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    backendAdapter = {
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 202 }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 202 } }),

      saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      updateQCStatusByMappingId: vi.fn().mockResolvedValue({ success: true }),
      updateImagePathsByMappingId: vi.fn().mockResolvedValue({ success: true }),
      updateGeneratedImageByMappingId: vi.fn().mockResolvedValue({ success: true }),
      getAllGeneratedImages: vi.fn(),
      getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }),
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, qcStatus: 'approved' } }),
      updateQCStatus: vi.fn().mockResolvedValue({ success: true }),
    };

    prevGlobalBackendAdapter = global.backendAdapter;
    prevProcessBackendAdapter = process.mainModule?.exports?.backendAdapter;
    prevGlobalRunner = global.currentJobRunner;

    if (!process.mainModule) {
      // @ts-ignore
      process.mainModule = { exports: {} };
    }
    // @ts-ignore
    process.mainModule.exports.backendAdapter = backendAdapter;
    // @ts-ignore
    global.backendAdapter = backendAdapter;
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    // restore globals to avoid cross-test leakage
    // @ts-ignore
    if (process.mainModule && process.mainModule.exports) process.mainModule.exports.backendAdapter = prevProcessBackendAdapter;
    // @ts-ignore
    global.backendAdapter = prevGlobalBackendAdapter;
    // @ts-ignore
    global.currentJobRunner = prevGlobalRunner;
    restoreCache();
  });

  it('runs a job, performs QC updates, and persists regenerated metadata by mappingId', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;
    runner.configurationId = 88;

    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({ prompt: 'P', promptContext: 'C' });

    const tempImagePath = path.join(tempDir, 'img.png');
    fs.writeFileSync(tempImagePath, 'img', 'utf8');

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: tempImagePath, mappingId: 'map-1', settings: {} },
    ]);

    // Saved images fetched during post-processing
    const mockImages = [
      {
        id: 1,
        executionId: 202,
        imageMappingId: 'map-1',
        mappingId: 'map-1',
        tempImagePath,
        finalImagePath: null,
        qcStatus: 'pending',
        metadata: { prompt: 'P' },
      },
    ];

    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce({
      success: true,
      images: mockImages,
    });
    
    // Ensure getGeneratedImagesByExecution also returns the images
    backendAdapter.getGeneratedImagesByExecution.mockResolvedValue({
      success: true,
      images: mockImages,
    });
    
    // Some flows re-fetch; keep deterministic
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce({
      success: true,
      images: mockImages,
    });

    mockAiVision.runQualityCheck.mockResolvedValueOnce({ passed: true, reason: 'ok' });
    mockAiVision.generateMetadata.mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: ['x'] });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: outDir, tempDirectory: tempDir },
      parameters: { processMode: 'single', variations: 1, enablePollingTimeout: false, pollingTimeout: 1, openaiModel: 'gpt-4o-mini' },
      processing: { removeBg: false, imageConvert: false },
      ai: { runQualityCheck: true, runMetadataGen: true, qualityCheckPrompt: 'qc', metadataPrompt: 'mp' },
    };

    const startRes = await runner.startJob(config);
    expect(startRes.success).toBe(true);
    await runner.currentJob;

    // QC + metadata should have executed
    expect(mockAiVision.runQualityCheck).toHaveBeenCalled();
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map-1', 'approved', 'ok');

    expect(mockAiVision.generateMetadata).toHaveBeenCalled();
    // Success path uses backendAdapter with object metadata
    expect(backendAdapter.updateGeneratedImageByMappingId).toHaveBeenCalledWith(
      'map-1',
      expect.objectContaining({
        metadata: expect.objectContaining({ title: 't', description: 'd' }),
      }),
    );
  });
});


