import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const mockProcessImage = vi.fn();
const mockGenerateMetadata = vi.fn();

const installCjsMocks = () => {
  // `src/services/retryExecutor.js` is CJS and destructures `processImage` at import time.
  // Override Node's require cache so the SUT reads the mocked exports.
  const produceId = require.resolve('../../../src/producePictureModule.js');
  require.cache[produceId] = {
    id: produceId,
    filename: produceId,
    loaded: true,
    exports: { processImage: mockProcessImage },
  };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  require.cache[aiVisionId] = {
    id: aiVisionId,
    filename: aiVisionId,
    loaded: true,
    exports: { generateMetadata: mockGenerateMetadata },
  };

  const electronId = require.resolve('electron');
  require.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: { app: { getPath: () => '/tmp' } },
  };
};

installCjsMocks();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RetryExecutor = require('../../../src/services/retryExecutor');

describe('RetryExecutor - failOptions and stage/qcReason mapping', () => {
  const sourcePath = '/tmp/gen-image-factory/pictures/generated/source.png';
  const jobConfigStub = {
    getDefaultSettings: () => ({
      filePaths: {
        outputDirectory: '/tmp/gen-image-factory/pictures/toupload',
        tempDirectory: '/tmp/gen-image-factory/pictures/generated',
      },
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
  });

  it('soft-falls back to source when processImage fails at convert stage and convert not selected', async () => {
    const err = new Error('convert blew up');
    // @ts-ignore
    err.stage = 'convert';
    mockProcessImage.mockRejectedValueOnce(err);

    const executor = new RetryExecutor({ jobConfig: jobConfigStub });

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToWebp: true },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['trim'] },
    );

    expect(mockProcessImage).toHaveBeenCalledWith(
      sourcePath,
      'source',
      expect.objectContaining({ outputDirectory: expect.any(String), tempDirectory: expect.any(String) }),
    );
    expect(result.success).toBe(true);
    expect(result.originalPath).toBe(sourcePath);
    expect(result.newPath).toContain('/toupload/');
    expect(copySpy).toHaveBeenCalledWith(sourcePath, expect.stringContaining('/toupload/source.webp'));
  });

  it('hard-fails with qcReason=processing_failed:convert when convert stage is selected', async () => {
    const err = new Error('convert blew up');
    // @ts-ignore
    err.stage = 'convert';
    mockProcessImage.mockRejectedValueOnce(err);

    const executor = new RetryExecutor({ jobConfig: jobConfigStub });

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToWebp: true },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['convert'] },
    );

    expect(mockProcessImage).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      qcReason: 'processing_failed:convert',
    });
    expect(String(result.error)).toMatch(/convert blew up/);
  });

  it('maps save-to-final failures to qcReason=processing_failed:save_final when convert is selected to hard-fail', async () => {
    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.webp');
    copySpy.mockRejectedValueOnce(new Error('EACCES: permission denied'));

    const executor = new RetryExecutor({ jobConfig: jobConfigStub });

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToWebp: true },
      false,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['convert'] },
    );

    expect(mockProcessImage).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      qcReason: 'processing_failed:save_final',
    });
    expect(String(result.error)).toMatch(/processing_failed:save_final/i);
  });

  it('maps metadata failures to qcReason=processing_failed:metadata when metadata is selected to hard-fail', async () => {
    mockProcessImage.mockResolvedValueOnce('/tmp/gen-image-factory/pictures/temp_processing/source.webp');
    mockGenerateMetadata.mockRejectedValueOnce(new Error('metadata service down'));

    const generatedImageStub = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: { generationPrompt: 'prompt' },
      }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
    executor.currentImageId = 'img-1';

    const result = await executor.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: { metadataPromptFile: '' } },
      true,
      executor.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['metadata'] },
    );

    expect(mockProcessImage).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      qcReason: 'processing_failed:metadata',
    });
    expect(String(result.error)).toMatch(/Metadata generation failed/i);
  });
});

