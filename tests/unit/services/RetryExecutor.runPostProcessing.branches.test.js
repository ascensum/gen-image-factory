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
  processImage: vi.fn(),
};
const mockAiVision = {
  generateMetadata: vi.fn(),
};

const installCjsMocks = (desktopPath) => {
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: mockProducePictureModule };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = { id: aiVisionId, filename: aiVisionId, loaded: true, exports: mockAiVision };

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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/services/retryExecutor.js');
};

describe('RetryExecutor.runPostProcessing (branches)', () => {
  let tmpRoot;
  let desktopPath;
  let tempDir;
  let outDir;
  let sourcePath;
  let generatedImage;
  let RetryExecutor;
  let prevRemoveBg;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProducePictureModule.processImage.mockReset();
    mockAiVision.generateMetadata.mockReset();

    prevRemoveBg = process.env.REMOVE_BG_API_KEY;

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-rpp-'));
    desktopPath = path.join(tmpRoot, 'desktop');
    tempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'generated');
    outDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    sourcePath = path.join(tempDir, 'img.png');
    fs.writeFileSync(sourcePath, 'src', 'utf8');

    RetryExecutor = loadSut(desktopPath);

    generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, generationPrompt: 'PROMPT', executionId: 10, execution_id: 10 } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(undefined),
      updateMetadataById: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    process.env.REMOVE_BG_API_KEY = prevRemoveBg;
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    restoreCache();
  });

  it('success path: copies to output, deletes source inside temp, persists metadata', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const processedTemp = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing', 'img.png');
    fs.mkdirSync(path.dirname(processedTemp), { recursive: true });
    fs.writeFileSync(processedTemp, 'processed', 'utf8');

    mockProducePictureModule.processImage.mockResolvedValueOnce(processedTemp);
    mockAiVision.generateMetadata.mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: ['x'] });

    const jobConfiguration = { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir, metadataPromptFile: '' } } };
    const settings = { imageConvert: false, removeBg: false, filePaths: {} };

    const res = await exec.runPostProcessing(sourcePath, settings, true, jobConfiguration, false, { enabled: false, steps: [] });

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'img.png'));
    expect(fs.existsSync(path.join(outDir, 'img.png'))).toBe(true);
    expect(fs.existsSync(sourcePath)).toBe(false); // deleted since inside temp dir
    expect(generatedImage.updateGeneratedImage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        qcStatus: 'approved',
        finalImagePath: path.join(outDir, 'img.png'),
        metadata: expect.objectContaining({ title: 't', description: 'd', tags: ['x'] }),
      }),
    );
    expect(generatedImage.updateMetadataById).toHaveBeenCalled();
  });

  it('metadata hard-fail when failOptions includes metadata', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    mockProducePictureModule.processImage.mockResolvedValueOnce(sourcePath);
    mockAiVision.generateMetadata.mockRejectedValueOnce(new Error('meta down'));

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      true,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['metadata'] },
    );

    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:metadata');
  });

  it('convert stage hard-fails when failOptions includes convert', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    mockProducePictureModule.processImage.mockRejectedValueOnce(Object.assign(new Error('convert fail'), { stage: 'convert' }));

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToJpg: true, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['convert'] },
    );

    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:convert');
  });

  it('save_final hard-fails when copy to output fails and convert selected', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const processedTemp = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing', 'img.png');
    fs.mkdirSync(path.dirname(processedTemp), { recursive: true });
    fs.writeFileSync(processedTemp, 'processed', 'utf8');
    mockProducePictureModule.processImage.mockResolvedValueOnce(processedTemp);

    const fsProm = require('fs').promises;
    const copySpy = vi.spyOn(fsProm, 'copyFile').mockRejectedValueOnce(new Error('disk full'));

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['convert'] },
    );

    expect(copySpy).toHaveBeenCalled();
    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:save_final');
  });

  it('convert stage soft-fails (falls back to source) when convert is NOT selected', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    mockProducePictureModule.processImage.mockRejectedValueOnce(Object.assign(new Error('convert fail'), { stage: 'convert' }));
    // With soft-fail, it copies sourcePath to finalOutputPath, and then tries to delete the source
    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToJpg: true, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: [] }, // enabled but convert not selected
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'img.jpg'));
    expect(fs.existsSync(path.join(outDir, 'img.jpg'))).toBe(true);
  });

  it('save_final soft-fails (no move) when copy fails and convert is NOT selected', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const processedTemp = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing', 'img.png');
    fs.mkdirSync(path.dirname(processedTemp), { recursive: true });
    fs.writeFileSync(processedTemp, 'processed', 'utf8');
    mockProducePictureModule.processImage.mockResolvedValueOnce(processedTemp);

    const fsProm = require('fs').promises;
    vi.spyOn(fsProm, 'copyFile').mockRejectedValueOnce(new Error('perm denied'));

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: [] }, // convert not selected => soft-fail
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(sourcePath);
    expect(fs.existsSync(sourcePath)).toBe(true); // should not delete (source==final)
  });

  it('returns processing_failed:qc when database update fails (no stage)', async () => {
    const exec = new RetryExecutor({
      generatedImage: {
        ...generatedImage,
        updateGeneratedImage: vi.fn().mockRejectedValue(new Error('db write fail')),
      },
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const processedTemp = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing', 'img.png');
    fs.mkdirSync(path.dirname(processedTemp), { recursive: true });
    fs.writeFileSync(processedTemp, 'processed', 'utf8');
    mockProducePictureModule.processImage.mockResolvedValueOnce(processedTemp);

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:qc');
  });

  it('trim stage hard-fails when failOptions includes trim', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    mockProducePictureModule.processImage.mockRejectedValueOnce(Object.assign(new Error('trim fail'), { stage: 'trim' }));

    const res = await exec.runPostProcessing(
      sourcePath,
      { trimTransparentBackground: true, imageConvert: false, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['trim'] },
    );

    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:trim');
  });

  it('trim stage soft-fails (falls back to source) when trim is NOT selected', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    mockProducePictureModule.processImage.mockRejectedValueOnce(Object.assign(new Error('trim fail'), { stage: 'trim' }));

    const res = await exec.runPostProcessing(
      sourcePath,
      { trimTransparentBackground: true, imageConvert: false, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'img.png'));
    expect(fs.existsSync(path.join(outDir, 'img.png'))).toBe(true);
  });

  it('enhancement stage hard-fails when failOptions includes enhancement', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    mockProducePictureModule.processImage.mockRejectedValueOnce(Object.assign(new Error('enh fail'), { stage: 'enhancement' }));

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageEnhancement: true, imageConvert: false, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['enhancement'] },
    );

    expect(res.success).toBe(false);
    expect(res.qcReason).toBe('processing_failed:enhancement');
  });

  it('reads metadataPromptFile when includeMetadata=true and file exists', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const processedTemp = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing', 'img.png');
    fs.mkdirSync(path.dirname(processedTemp), { recursive: true });
    fs.writeFileSync(processedTemp, 'processed', 'utf8');
    mockProducePictureModule.processImage.mockResolvedValueOnce(processedTemp);

    const promptFile = path.join(tmpRoot, 'meta-prompt.txt');
    fs.writeFileSync(promptFile, 'CUSTOM META PROMPT', 'utf8');

    mockAiVision.generateMetadata.mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: [] });

    const jobConfiguration = { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir, metadataPromptFile: promptFile } } };
    const res = await exec.runPostProcessing(sourcePath, { imageConvert: false, filePaths: {} }, true, jobConfiguration, false, { enabled: false, steps: [] });

    expect(res.success).toBe(true);
    expect(mockAiVision.generateMetadata).toHaveBeenCalledWith(
      expect.any(String),
      'PROMPT',
      'CUSTOM META PROMPT',
      expect.any(String),
    );
  });

  it('chooses .webp final output when imageConvert + convertToWebp enabled', async () => {
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir } }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const processedTemp = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing', 'img.png');
    fs.mkdirSync(path.dirname(processedTemp), { recursive: true });
    fs.writeFileSync(processedTemp, 'processed', 'utf8');
    mockProducePictureModule.processImage.mockResolvedValueOnce(processedTemp);

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToWebp: true, filePaths: {} },
      false,
      null, // forces fallback to this.outputDirectory
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'img.webp'));
    expect(fs.existsSync(path.join(outDir, 'img.webp'))).toBe(true);
  });
});

