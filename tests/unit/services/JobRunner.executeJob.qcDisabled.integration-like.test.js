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

const mockProducePictureModule = {
  producePictureModule: vi.fn(),
};
const mockParamsGeneratorModule = {
  paramsGeneratorModule: vi.fn(),
};
const mockAiVision = {
  runQualityCheck: vi.fn(),
  generateMetadata: vi.fn(),
};

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

  // Provide deterministic electron paths for temp processing dirs if reached
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
  const { JobRunner } = require('../../../src/services/jobRunner.js');
  return JobRunner;
};

describe('JobRunner.executeJob (QC disabled, integration-like)', () => {
  let tmpRoot;
  let tempDir;
  let outDir;
  let backendAdapter;
  let prevGlobalBackendAdapter;
  let prevProcessBackendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProducePictureModule.producePictureModule.mockReset();
    mockParamsGeneratorModule.paramsGeneratorModule.mockReset();
    mockAiVision.runQualityCheck.mockReset();
    mockAiVision.generateMetadata.mockReset();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrunner-full-'));
    tempDir = path.join(tmpRoot, 'generated');
    outDir = path.join(tmpRoot, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    backendAdapter = {
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 101 }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 101 } }),

      saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      updateQCStatusByMappingId: vi.fn().mockResolvedValue({ success: true }),
      updateImagePathsByMappingId: vi.fn().mockResolvedValue({ success: true }),
      getAllGeneratedImages: vi.fn(),
      getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }),
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, qcStatus: 'approved' } }),
      updateQCStatus: vi.fn().mockResolvedValue({ success: true }),
    };

    // Discover backend adapter via process.mainModule.exports.backendAdapter
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
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    // Restore global/process backendAdapter references to avoid cross-test leakage
    // @ts-ignore
    if (process.mainModule && process.mainModule.exports) {
      // @ts-ignore
      process.mainModule.exports.backendAdapter = prevProcessBackendAdapter;
    }
    // @ts-ignore
    global.backendAdapter = prevGlobalBackendAdapter;
    // @ts-ignore
    delete global.currentJobRunner;
    restoreCache();
  });

  it('runs end-to-end happy flow and performs immediate move+QC approve when QC is disabled', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;
    runner.configurationId = 77;

    // parameter generation -> prompt
    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({ prompt: 'P', promptContext: 'C' });

    const tempImagePath = path.join(tempDir, 'img.png');
    fs.writeFileSync(tempImagePath, 'img', 'utf8');

    // producePictureModule returns array; each item must have settings object
    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: tempImagePath, mappingId: 'map-1', settings: {} },
    ]);

    // getSavedImagesForExecution() uses getAllGeneratedImages; provide saved image with temp path
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce({
      success: true,
      images: [
        {
          id: 1,
          executionId: 101,
          imageMappingId: 'map-1',
          tempImagePath,
          finalImagePath: null,
          qcStatus: 'pending',
          metadata: { prompt: 'P' },
        },
      ],
    });
    // second call (post-QC/move)
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce({
      success: true,
      images: [
        {
          id: 1,
          executionId: 101,
          imageMappingId: 'map-1',
          tempImagePath,
          finalImagePath: null,
          qcStatus: 'pending',
          metadata: { prompt: 'P' },
        },
      ],
    });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: outDir, tempDirectory: tempDir },
      parameters: { processMode: 'single', variations: 1, enablePollingTimeout: false, pollingTimeout: 1 },
      processing: { removeBg: false, imageConvert: false },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    // startJob initializes databaseExecutionId via saveJobExecution
    const startRes = await runner.startJob(config);
    expect(startRes.success).toBe(true);
    expect(backendAdapter.saveJobExecution).toHaveBeenCalled();
    expect(runner.databaseExecutionId).toBe(101);

    // Wait for the async executeJob to complete
    await runner.currentJob;

    // QC-disabled immediate move should mark approved + update paths
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map-1', 'approved', expect.stringContaining('QC disabled'));
    expect(backendAdapter.updateImagePathsByMappingId).toHaveBeenCalled();
    expect(backendAdapter.updateJobExecution).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ configurationId: 77 }),
    );
  });
});

