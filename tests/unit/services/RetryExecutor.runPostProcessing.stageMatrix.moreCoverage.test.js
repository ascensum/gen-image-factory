import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
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

const mockProcessImage = vi.fn();
const mockGenerateMetadata = vi.fn();

const installCjsMocks = () => {
  // retryExecutor.js is CJS and destructures `processImage` at import time
  const produceId = req.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  req.cache[produceId] = {
    id: produceId,
    filename: produceId,
    loaded: true,
    exports: { processImage: mockProcessImage },
  };

  const aiVisionId = req.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  req.cache[aiVisionId] = {
    id: aiVisionId,
    filename: aiVisionId,
    loaded: true,
    exports: { generateMetadata: mockGenerateMetadata },
  };

  const electronId = req.resolve('electron');
  rememberCache(electronId);
  req.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: { app: { getPath: () => '/tmp' } },
  };

  const sutId = req.resolve('../../../src/services/retryExecutor.js');
  rememberCache(sutId);
  delete req.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return req('../../../src/services/retryExecutor.js');
};

describe('RetryExecutor.runPostProcessing - stage matrix + DB failure paths', () => {
  const sourcePath = '/tmp/gen-image-factory/pictures/generated/source.png';

  const jobConfigStub = {
    getDefaultSettings: () => ({
      filePaths: {
        outputDirectory: '/tmp/gen-image-factory/pictures/toupload',
        tempDirectory: '/tmp/gen-image-factory/pictures/generated',
      },
      apiKeys: {},
    }),
  };

  let accessSpy;
  let mkdirSpy;
  let copySpy;
  let unlinkSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessImage.mockReset();
    mockGenerateMetadata.mockReset();

    accessSpy = vi.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    copySpy = vi.spyOn(fs.promises, 'copyFile').mockResolvedValue(undefined);
    unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
  });

  afterEach(() => {
    accessSpy.mockRestore();
    mkdirSpy.mockRestore();
    copySpy.mockRestore();
    unlinkSpy.mockRestore();
    vi.resetModules();
    restoreCache();
  });

  it('soft-falls back to source when processImage fails at trim stage and trim not selected', async () => {
    const RetryExecutor = loadSut();
    const executor = new RetryExecutor({ jobConfig: jobConfigStub });

    const err = new Error('trim blew up');
    // @ts-ignore
    err.stage = 'trim';
    mockProcessImage.mockRejectedValueOnce(err);

    const result = await executor.runPostProcessing(
      sourcePath,
      { trimTransparentBackground: true, imageConvert: false },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['convert'] }, // trim not selected
    );

    expect(result.success).toBe(true);
    expect(result.originalPath).toBe(sourcePath);
    expect(result.newPath).toContain('/toupload/');
    expect(copySpy).toHaveBeenCalledWith(sourcePath, expect.stringContaining('/toupload/source.png'));
  });

  it('hard-fails with qcReason=processing_failed:enhancement when enhancement is selected', async () => {
    const RetryExecutor = loadSut();
    const executor = new RetryExecutor({ jobConfig: jobConfigStub });

    const err = new Error('enhancement blew up');
    // @ts-ignore
    err.stage = 'enhancement';
    mockProcessImage.mockRejectedValueOnce(err);

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageEnhancement: true, imageConvert: false },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['enhancement'] },
    );

    expect(result).toMatchObject({
      success: false,
      qcReason: 'processing_failed:enhancement',
    });
    expect(String(result.error)).toMatch(/enhancement blew up/);
  });

  it('maps remove_bg stage failures to qcReason=processing_failed:remove_bg', async () => {
    const RetryExecutor = loadSut();
    const executor = new RetryExecutor({ jobConfig: jobConfigStub });

    const err = new Error('remove.bg failed');
    // @ts-ignore
    err.stage = 'remove_bg';
    mockProcessImage.mockRejectedValueOnce(err);

    const result = await executor.runPostProcessing(
      sourcePath,
      { removeBg: true, imageConvert: false },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: false, steps: [] },
    );

    expect(result).toMatchObject({
      success: false,
      qcReason: 'processing_failed:remove_bg',
    });
    expect(String(result.error)).toMatch(/remove\.bg failed/);
  });

  it('soft-falls back to source when move-to-final fails and convert is not selected', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: { title: 't' },
      processingSettings: null,
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.png');
    copySpy.mockRejectedValueOnce(new Error('EACCES: permission denied'));

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: false },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['metadata'] }, // convert not selected => move failure is soft
    );

    expect(result.success).toBe(true);
    expect(result.newPath).toBe(sourcePath);
    expect(generatedImageStub.updateGeneratedImage).toHaveBeenCalled();
    // When finalOutputPath is the source, delete guard should skip
    expect(unlinkSpy).not.toHaveBeenCalledWith(path.resolve(sourcePath));
  });

  it('when useOriginalSettings=true, preserves existingImage.processingSettings (does not overwrite with snapshot)', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: { title: 't' },
      // Simulate stored original processing settings (as object)
      processingSettings: { removeBg: true, convertToJpg: true, jpgQuality: 77 },
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.png');

    const result = await executor.runPostProcessing(
      sourcePath,
      // Pass retry settings that would otherwise generate a snapshot
      { imageEnhancement: true, sharpening: 5, saturation: 1.2, removeBg: true, imageConvert: true, convertToWebp: true },
      false,
      executor.getFallbackConfiguration(),
      true,
      { enabled: false, steps: [] },
    );

    expect(result.success).toBe(true);
    expect(generatedImageStub.updateGeneratedImage).toHaveBeenCalledWith('img-1', expect.objectContaining({
      processingSettings: existingImage.processingSettings,
    }));
  });

  it('returns failure when DB update throws (Database update failed)', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: null,
      processingSettings: null,
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockRejectedValue(new Error('SQLITE_BUSY')),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.png');

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: false },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: false, steps: [] },
    );

    expect(result.success).toBe(false);
    expect(String(result.error)).toMatch(/Database update failed/i);
    expect(result.qcReason).toBe('processing_failed:qc');
  });

  it('persists regenerated metadata on success (updateMetadataById) when includeMetadata=true', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: { title: 'old', description: 'old', tags: ['x'] },
      processingSettings: null,
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.png');
    mockGenerateMetadata.mockResolvedValueOnce({
      new_title: 'new t',
      new_description: 'new d',
      uploadTags: ['a', 'b'],
    });

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: { metadataPromptFile: '' } },
      true,
      executor.getFallbackConfiguration(),
      false,
      { enabled: false, steps: [] },
    );

    expect(result.success).toBe(true);
    expect(generatedImageStub.updateMetadataById).toHaveBeenCalledWith('img-1', {
      title: 'new t',
      description: 'new d',
      tags: ['a', 'b'],
    });
    expect(generatedImageStub.updateGeneratedImage).toHaveBeenCalledWith('img-1', expect.objectContaining({
      qcStatus: 'approved',
      qcReason: 'Retry processing successful',
      finalImagePath: expect.stringContaining('/toupload/source.png'),
      metadata: expect.objectContaining({ title: 'new t', description: 'new d', tags: ['a', 'b'] }),
    }));
  });

  it('soft-continues when metadata generation fails and metadata is not selected to hard-fail', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: { title: 'old' },
      processingSettings: null,
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.png');
    mockGenerateMetadata.mockRejectedValueOnce(new Error('metadata down'));

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: { metadataPromptFile: '' } },
      true,
      executor.getFallbackConfiguration(),
      false,
      // enabled but metadata NOT selected => soft-fail
      { enabled: true, steps: ['convert'] },
    );

    expect(result.success).toBe(true);
    expect(result.metadata).toBe(null);
    expect(generatedImageStub.updateMetadataById).not.toHaveBeenCalled();
    expect(generatedImageStub.updateGeneratedImage).toHaveBeenCalledWith('img-1', expect.objectContaining({
      qcStatus: 'approved',
      qcReason: 'Retry processing successful',
    }));
  });

  it('returns a detailed steps[] list when multiple processing options are enabled', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: null,
      processingSettings: null,
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.jpg');
    mockGenerateMetadata.mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: ['x'] });

    const result = await executor.runPostProcessing(
      sourcePath,
      {
        imageEnhancement: true,
        sharpening: 2,
        saturation: 1.1,
        imageConvert: true,
        convertToJpg: true,
        jpgQuality: 88,
        removeBg: true,
        filePaths: { metadataPromptFile: '' },
      },
      true,
      executor.getFallbackConfiguration(),
      false,
      { enabled: false, steps: [] },
    );

    expect(result.success).toBe(true);
    expect(result.steps).toEqual(expect.arrayContaining([
      'enhancement',
      'sharpening',
      'saturation',
      'conversion',
      'background_removal',
      'metadata_regeneration',
    ]));
  });

  it('deletes the original source file when source is inside tempDirectory and final path differs', async () => {
    const RetryExecutor = loadSut();
    const existingImage = {
      executionId: 1,
      generationPrompt: 'prompt',
      seed: 123,
      metadata: null,
      processingSettings: null,
    };
    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: existingImage }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };
    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    // processed file is different from source so we can detect cleanup of source
    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.png');

    const jobCfg = {
      ...executor.getFallbackConfiguration(),
      settings: {
        ...executor.getFallbackConfiguration().settings,
        filePaths: {
          outputDirectory: '/tmp/gen-image-factory/pictures/toupload',
          tempDirectory: '/tmp/gen-image-factory/pictures/generated',
        },
      },
    };

    await executor.runPostProcessing(
      sourcePath,
      { imageConvert: false },
      false,
      jobCfg,
      false,
      { enabled: false, steps: [] },
    );

    // unlink is used both for temp processed file and for source cleanup; ensure source cleanup path happened
    expect(unlinkSpy).toHaveBeenCalledWith(path.resolve(sourcePath));
  });
});

