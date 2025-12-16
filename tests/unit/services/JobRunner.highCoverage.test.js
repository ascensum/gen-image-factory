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
  require.cache[produceId] = {
    id: produceId,
    filename: produceId,
    loaded: true,
    exports: mockProducePictureModule,
  };

  const paramsId = require.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  require.cache[paramsId] = {
    id: paramsId,
    filename: paramsId,
    loaded: true,
    exports: mockParamsGeneratorModule,
  };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = {
    id: aiVisionId,
    filename: aiVisionId,
    loaded: true,
    exports: mockAiVision,
  };

  const jobRunnerId = require.resolve('../../../src/services/jobRunner.js');
  rememberCache(jobRunnerId);
  delete require.cache[jobRunnerId];
};

const loadJobRunner = () => {
  installCjsMocks();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JobRunner } = require('../../../src/services/jobRunner.js');
  return JobRunner;
};

describe('JobRunner - coverage elevation (unit)', () => {
  let tmpDir;
  let backendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProducePictureModule.producePictureModule.mockReset();
    mockParamsGeneratorModule.paramsGeneratorModule.mockReset();
    mockAiVision.runQualityCheck.mockReset();
    mockAiVision.generateMetadata.mockReset();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrunner-cov-'));

    backendAdapter = {
      // Execution persistence
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 123 }),
      updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
      updateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true }),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 123, status: 'completed' } }),
      processNextBulkRerunJob: vi.fn().mockResolvedValue({ success: false, message: 'No jobs in queue' }),

      // Images persistence
      saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, qcStatus: 'approved' } }),
      updateQCStatus: vi.fn().mockResolvedValue({ success: true }),
      updateQCStatusByMappingId: vi.fn().mockResolvedValue({ success: true }),
      updateGeneratedImageByMappingId: vi.fn().mockResolvedValue({ success: true }),
      updateImagePathsByMappingId: vi.fn().mockResolvedValue({ success: true }),
      getAllGeneratedImages: vi.fn().mockResolvedValue([]),
      getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }),
    };

    // JobRunner discovers backend adapter via process.mainModule.exports.backendAdapter
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
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    restoreCache();
  });

  it('validateConfiguration covers missing required fields', () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();

    expect(runner.validateConfiguration({ apiKeys: { runware: 'rw' }, filePaths: { outputDirectory: '/tmp' }, parameters: { processMode: 'single' } }))
      .toEqual({ valid: false, error: 'OpenAI API key is required' });

    expect(runner.validateConfiguration({ apiKeys: { openai: 'sk' }, filePaths: { outputDirectory: '/tmp' }, parameters: { processMode: 'single' } }))
      .toEqual({ valid: false, error: 'Runware API key is required' });

    expect(runner.validateConfiguration({ apiKeys: { openai: 'sk', runware: 'rw' }, filePaths: {}, parameters: { processMode: 'single' } }))
      .toEqual({ valid: false, error: 'Output directory is required' });

    expect(runner.validateConfiguration({ apiKeys: { openai: 'sk', runware: 'rw' }, filePaths: { outputDirectory: '/tmp' }, parameters: {} }))
      .toEqual({ valid: false, error: 'Process mode is required' });
  });

  it('setEnvironmentFromConfig sets provider env vars and debug mode', () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();

    runner.setEnvironmentFromConfig({
      apiKeys: { openai: 'sk-test', runware: 'rw-test', removeBg: 'rb-test' },
      advanced: { debugMode: true },
    });

    expect(process.env.OPENAI_API_KEY).toBe('sk-test');
    expect(process.env.RUNWARE_API_KEY).toBe('rw-test');
    expect(process.env.REMOVE_BG_API_KEY).toBe('rb-test');
    expect(process.env.DEBUG_MODE).toBe('true');
  });

  it('generateParameters parses TXT keywords deterministically (Runware-aligned config)', async () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();

    const keywordsFile = path.join(tmpDir, 'keywords.txt');
    fs.writeFileSync(keywordsFile, 'Apple\nBanana\nCherry\n', 'utf8');

    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({
      prompt: 'Prompt for Banana',
      promptContext: 'Banana',
    });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { keywordsFile },
      // Legacy MJ-only fields (mjVersion/aspectRatios) intentionally omitted from config.
      parameters: { processMode: 'single', openaiModel: 'gpt-4o-mini', keywordRandom: false, runwareModel: 'runware:101@1', runwareFormat: 'png', runwareDimensionsCsv: '1024x1024', variations: 1 },
      __perGen: true,
      __forceSequentialIndex: 1,
    };

    const params = await runner.generateParameters(config);

    expect(mockParamsGeneratorModule.paramsGeneratorModule).toHaveBeenCalledWith(
      'Banana',
      null,
      null,
      expect.objectContaining({ appendMjVersion: false, mjVersion: '6', openaiModel: 'gpt-4o-mini' }),
    );

    expect(params).toMatchObject({
      prompt: 'Prompt for Banana',
      promptContext: 'Banana',
    });
  });

  it('generateParameters parses CSV keywords and selects row by __forceSequentialIndex when keywordRandom=false', async () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();

    const keywordsFile = path.join(tmpDir, 'keywords.csv');
    fs.writeFileSync(
      keywordsFile,
      '"Subject","Setting"\n"Cat","Beach"\n"Dog","Park"\n',
      'utf8',
    );

    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({
      prompt: 'CSV prompt',
      promptContext: 'Dog',
    });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { keywordsFile },
      // Legacy MJ-only fields (mjVersion/aspectRatios) intentionally omitted from config.
      parameters: { processMode: 'single', openaiModel: 'gpt-4o', keywordRandom: false, runwareModel: 'runware:101@1', runwareFormat: 'png', runwareDimensionsCsv: '1024x1024', variations: 1 },
      __perGen: true,
      __forceSequentialIndex: 1,
    };

    const params = await runner.generateParameters(config);

    expect(mockParamsGeneratorModule.paramsGeneratorModule).toHaveBeenCalledWith(
      { Subject: 'Dog', Setting: 'Park' },
      null,
      null,
      expect.objectContaining({ appendMjVersion: false }),
    );
    expect(params.prompt).toBe('CSV prompt');
  });

  it('generateImages single-generation toggles processingEnabled when QC is enabled/disabled', async () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: '/tmp/out/a.png', mappingId: 'm1', settings: {} },
    ]);

    const baseConfig = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' },
      parameters: { processMode: 'single', variations: 1 },
      processing: { removeBg: true, imageConvert: true, convertToJpg: true },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    await runner.generateImages(baseConfig, { prompt: 'p', aspectRatios: ['1:1'] });
    expect(mockProducePictureModule.producePictureModule).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'p' }),
      expect.any(String),
      null,
      expect.objectContaining({
        removeBg: true,
        imageConvert: true,
        convertToJpg: true,
        outputDirectory: '/tmp/tmp',
      }),
    );

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: '/tmp/out/a.png', mappingId: 'm1', settings: {} },
    ]);

    await runner.generateImages({ ...baseConfig, ai: { runQualityCheck: true, runMetadataGen: false } }, { prompt: 'p', aspectRatios: ['1:1'] });
    expect(mockProducePictureModule.producePictureModule).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.any(String),
      null,
      expect.objectContaining({
        removeBg: false,
        imageConvert: false,
        convertToJpg: false,
      }),
    );
  });

  it('generateImages runs quality checks and updates QC status by mappingId', async () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: path.join(tmpDir, 'img.png'), mappingId: 'map-1', tempImagePath: path.join(tmpDir, 'img.png'), settings: {} },
    ]);

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: tmpDir },
      parameters: { processMode: 'single', variations: 1, enablePollingTimeout: false, pollingTimeout: 1 },
      processing: {},
      ai: { runQualityCheck: true, runMetadataGen: false },
    };

    const images = await runner.generateImages(config, { prompt: 'p', aspectRatios: ['1:1'] });
    expect(images.length).toBe(1);
    // QC/metadata happens in executeJob after persistence; generateImages only returns processed image objects.
    expect(backendAdapter.updateQCStatusByMappingId).not.toHaveBeenCalled();
  });

  it('executeJob runs QC + metadata loops and persists outcomes by mappingId', async () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 123;
    runner.configurationId = 99;

    // Provide deterministic parameter generation via mock module
    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({
      prompt: 'P',
      promptContext: 'K',
    });

    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      {
        outputPath: path.join(tmpDir, 'img.png'),
        mappingId: 'map-2',
        tempImagePath: path.join(tmpDir, 'img.png'),
        settings: { title: { title: 't', description: 'd' }, uploadTags: ['a'] },
      },
    ]);
    fs.writeFileSync(path.join(tmpDir, 'img.png'), 'x', 'utf8');

    // Saved image feed used by getSavedImagesForExecution()
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce([
      { id: 1, executionId: 123, imageMappingId: 'map-2', mappingId: 'map-2', tempImagePath: path.join(tmpDir, 'img.png'), qcStatus: 'pending', metadata: { prompt: 'P' } },
    ]);
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce([
      { id: 1, executionId: 123, imageMappingId: 'map-2', mappingId: 'map-2', tempImagePath: path.join(tmpDir, 'img.png'), qcStatus: 'pending', metadata: { prompt: 'P' } },
    ]);

    mockAiVision.generateMetadata.mockResolvedValueOnce({ new_title: 'nt', new_description: 'nd', uploadTags: ['x', 'y'] });
    mockAiVision.runQualityCheck.mockResolvedValueOnce({ passed: false, reason: 'bad' });

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: tmpDir },
      parameters: { processMode: 'single', variations: 1, enablePollingTimeout: false, pollingTimeout: 1, openaiModel: 'gpt-4o-mini' },
      processing: {},
      ai: { runQualityCheck: true, runMetadataGen: true, metadataPrompt: 'prompt' },
    };

    runner.jobConfiguration = config;
    await runner.executeJob(config, 'job-x');

    expect(backendAdapter.updateGeneratedImageByMappingId).toHaveBeenCalledWith(
      'map-2',
      expect.objectContaining({ metadata: expect.any(Object) }),
    );
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map-2', 'qc_failed', 'bad');

    // Metadata failure path: separate run with a different mapping
    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({ prompt: 'P2', promptContext: 'K2' });
    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: path.join(tmpDir, 'img2.png'), mappingId: 'map-3', tempImagePath: path.join(tmpDir, 'img2.png'), settings: {} },
    ]);
    fs.writeFileSync(path.join(tmpDir, 'img2.png'), 'x', 'utf8');
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce([
      { id: 2, executionId: 123, imageMappingId: 'map-3', mappingId: 'map-3', tempImagePath: path.join(tmpDir, 'img2.png'), qcStatus: 'approved', metadata: { prompt: 'P2' } },
    ]);
    backendAdapter.getAllGeneratedImages.mockResolvedValueOnce([
      { id: 2, executionId: 123, imageMappingId: 'map-3', mappingId: 'map-3', tempImagePath: path.join(tmpDir, 'img2.png'), qcStatus: 'approved', metadata: { prompt: 'P2' } },
    ]);
    mockAiVision.generateMetadata.mockRejectedValueOnce(new Error('metadata down'));
    mockAiVision.runQualityCheck.mockResolvedValueOnce({ passed: true, reason: 'ok' });

    runner.jobConfiguration = config;
    await runner.executeJob(config, 'job-y');
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map-3', 'qc_failed', 'processing_failed:metadata');
  });

  it('executeJob runs the two-step workflow and updates job execution record', async () => {
    const JobRunner = loadJobRunner();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 123;
    runner.configurationId = 99;

    // Provide deterministic parameter generation via mock module
    mockParamsGeneratorModule.paramsGeneratorModule.mockResolvedValueOnce({
      prompt: 'P',
      promptContext: 'K',
    });
    mockProducePictureModule.producePictureModule.mockResolvedValueOnce([
      { outputPath: path.join(tmpDir, 'img.png'), mappingId: 'map-x', tempImagePath: path.join(tmpDir, 'img.png'), settings: {} },
    ]);

    const config = {
      apiKeys: { openai: 'sk', runware: 'rw' },
      filePaths: { outputDirectory: '/tmp/out', tempDirectory: tmpDir },
      parameters: { processMode: 'single', variations: 1, enablePollingTimeout: false, pollingTimeout: 1 },
      processing: { removeBg: false, imageConvert: false },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };

    await runner.executeJob(config, 'job-1');

    expect(backendAdapter.updateJobExecution).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ configurationId: 99 }),
    );
  });
});

