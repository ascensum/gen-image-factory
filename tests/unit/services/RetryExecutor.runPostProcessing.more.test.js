import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const mockProcessImage = vi.fn();
const mockGenerateMetadata = vi.fn();

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

const installCjsMocks = (desktopPath) => {
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = {
    id: produceId,
    filename: produceId,
    loaded: true,
    exports: { processImage: mockProcessImage },
  };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = {
    id: aiVisionId,
    filename: aiVisionId,
    loaded: true,
    exports: { generateMetadata: mockGenerateMetadata },
  };

  const electronId = require.resolve('electron');
  rememberCache(electronId);
  require.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: { app: { getPath: () => desktopPath } },
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

describe('RetryExecutor.runPostProcessing (unit)', () => {
  let tmpDir;
  let desktopDir;
  let generatedDir;
  let toUploadDir;
  let sourcePath;
  let generatedImageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessImage.mockReset();
    mockGenerateMetadata.mockReset();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-'));
    desktopDir = path.join(tmpDir, 'desktop');
    generatedDir = path.join(desktopDir, 'gen-image-factory', 'pictures', 'generated');
    toUploadDir = path.join(desktopDir, 'gen-image-factory', 'pictures', 'toupload');
    fs.mkdirSync(generatedDir, { recursive: true });
    fs.mkdirSync(toUploadDir, { recursive: true });

    sourcePath = path.join(generatedDir, 'img1.png');
    fs.writeFileSync(sourcePath, 'img', 'utf8');

    generatedImageModel = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: {
          id: 1,
          executionId: 10,
          generationPrompt: 'Prompt',
          seed: 123,
          metadata: { prompt: 'Prompt', title: 't', description: 'd', tags: ['a'] },
          processingSettings: { removeBgFailureMode: 'approve' },
        },
      }),
      updateGeneratedImage: vi.fn().mockResolvedValue({ success: true }),
      updateMetadataById: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    restoreCache();
  });

  it('processes and moves image to final output; deletes original when inside temp dir; updates DB', async () => {
    const RetryExecutor = loadSut(desktopDir);
    const executor = new RetryExecutor({
      generatedImage: generatedImageModel,
      tempDirectory: generatedDir,
      outputDirectory: toUploadDir,
    });

    executor.currentImageId = '1';

    mockProcessImage.mockImplementation(async (_src, baseName, cfg) => {
      const outPath = path.join(cfg.outputDirectory, `${baseName}.png`);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, 'processed', 'utf8');
      return outPath;
    });

    const jobConfiguration = {
      settings: {
        filePaths: { tempDirectory: generatedDir, outputDirectory: toUploadDir, metadataPromptFile: '' },
      },
    };

    const settings = { imageConvert: false, convertToJpg: false, removeBg: false, filePaths: {} };
    const res = await executor.runPostProcessing(sourcePath, settings, false, jobConfiguration, false, { enabled: false, steps: [] });

    expect(res.success).toBe(true);
    expect(fs.existsSync(res.processedImagePath)).toBe(true);
    expect(fs.existsSync(sourcePath)).toBe(false); // deleted from generated folder
    expect(generatedImageModel.updateGeneratedImage).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ qcStatus: 'approved', finalImagePath: res.processedImagePath }),
    );
  });

  it('regenerates metadata and persists via updateMetadataById (soft-fail when not selected)', async () => {
    const RetryExecutor = loadSut(desktopDir);
    const executor = new RetryExecutor({
      generatedImage: generatedImageModel,
      tempDirectory: generatedDir,
      outputDirectory: toUploadDir,
    });
    executor.currentImageId = '1';

    mockProcessImage.mockImplementation(async (_src, baseName, cfg) => {
      const outPath = path.join(cfg.outputDirectory, `${baseName}.png`);
      await fs.promises.writeFile(outPath, 'processed', 'utf8');
      return outPath;
    });

    mockGenerateMetadata.mockResolvedValueOnce({ new_title: 'nt', new_description: 'nd', uploadTags: ['x'] });

    const jobConfiguration = { settings: { filePaths: { tempDirectory: generatedDir, outputDirectory: toUploadDir } } };
    const settings = { imageConvert: false, convertToJpg: false, removeBg: false, filePaths: {} };

    const res = await executor.runPostProcessing(sourcePath, settings, true, jobConfiguration, false, { enabled: false, steps: [] });
    expect(res.success).toBe(true);
    expect(mockGenerateMetadata).toHaveBeenCalled();
    expect(generatedImageModel.updateMetadataById).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ title: 'nt', description: 'nd' }),
    );
  });

  it('fails with qcReason=processing_failed:metadata when metadata is selected to hard-fail', async () => {
    const RetryExecutor = loadSut(desktopDir);
    const executor = new RetryExecutor({
      generatedImage: generatedImageModel,
      tempDirectory: generatedDir,
      outputDirectory: toUploadDir,
    });
    executor.currentImageId = '1';

    mockProcessImage.mockImplementation(async (_src, baseName, cfg) => {
      const outPath = path.join(cfg.outputDirectory, `${baseName}.png`);
      await fs.promises.writeFile(outPath, 'processed', 'utf8');
      return outPath;
    });

    mockGenerateMetadata.mockRejectedValueOnce(new Error('meta down'));

    const jobConfiguration = { settings: { filePaths: { tempDirectory: generatedDir, outputDirectory: toUploadDir } } };
    const settings = { imageConvert: false, convertToJpg: false, removeBg: false, filePaths: {} };

    const res = await executor.runPostProcessing(sourcePath, settings, true, jobConfiguration, false, { enabled: true, steps: ['metadata'] });
    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:metadata');
  });

  it('returns qcReason=processing_failed:save_final when final copy fails and convert is selected to hard-fail', async () => {
    const RetryExecutor = loadSut(desktopDir);
    const executor = new RetryExecutor({
      generatedImage: generatedImageModel,
      tempDirectory: generatedDir,
      outputDirectory: toUploadDir,
    });
    executor.currentImageId = '1';

    mockProcessImage.mockImplementation(async (_src, baseName, cfg) => {
      const outPath = path.join(cfg.outputDirectory, `${baseName}.png`);
      await fs.promises.writeFile(outPath, 'processed', 'utf8');
      return outPath;
    });

    const copySpy = vi.spyOn(fs.promises, 'copyFile').mockRejectedValueOnce(new Error('no perms'));

    const jobConfiguration = { settings: { filePaths: { tempDirectory: generatedDir, outputDirectory: toUploadDir } } };
    const settings = { imageConvert: true, convertToJpg: true, removeBg: false, filePaths: {} };

    const res = await executor.runPostProcessing(sourcePath, settings, false, jobConfiguration, false, { enabled: true, steps: ['convert'] });
    expect(copySpy).toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:save_final');
    copySpy.mockRestore();
  });
});

