import { describe, it, expect, beforeEach, vi } from 'vitest';
import ImagePipelineService from '../../../src/services/ImagePipelineService.js';

const imageBuf = Buffer.from('89504e470d0a1a0a0000000d49484452000100000100000802000000', 'hex');

function makeGeneratorSuccessfulItem(overrides = {}) {
  return {
    inputImagePath: '/tmp/downloaded.png',
    mappingId: 'map-1',
    imageSuffix: '_0',
    ...overrides,
  };
}

describe('ImagePipelineService', () => {
  let generator;
  let processor;
  let remover;

  beforeEach(() => {
    generator = { generateImages: vi.fn() };
    processor = { process: vi.fn() };
    remover = { retryRemoveBackground: vi.fn() };
  });

  it('throws when imageGeneratorService is missing', () => {
    expect(
      () => new ImagePipelineService({ imageProcessorService: processor }),
    ).toThrow(/requires imageGeneratorService/);
  });

  it('throws when imageProcessorService is missing', () => {
    expect(
      () => new ImagePipelineService({ imageGeneratorService: generator }),
    ).toThrow(/requires imageProcessorService/);
  });

  it('allows null imageRemoverService', () => {
    const svc = new ImagePipelineService({
      imageGeneratorService: generator,
      imageProcessorService: processor,
    });
    expect(svc.remover).toBeNull();
  });

  describe('producePictures', () => {
    it('runs processImage for each successful download and returns output paths', async () => {
      const item = makeGeneratorSuccessfulItem();
      generator.generateImages.mockResolvedValue({
        successfulDownloads: [item],
        failedItems: [],
      });
      const mockFs = {
        readFile: vi.fn().mockResolvedValue(imageBuf),
      };
      processor.process.mockResolvedValue('/final/out.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });
      const config = { fs: mockFs, _softFailures: [] };
      const result = await svc.producePictures({ prompt: 'cat' }, 'jobBase', null, config);

      expect(generator.generateImages).toHaveBeenCalledWith(
        { prompt: 'cat' },
        'jobBase',
        config,
      );
      expect(mockFs.readFile).toHaveBeenCalledWith(item.inputImagePath);
      expect(processor.process).toHaveBeenCalled();
      expect(result.processedImages).toHaveLength(1);
      expect(result.processedImages[0]).toMatchObject({
        outputPath: '/final/out.png',
        mappingId: 'map-1',
      });
      expect(result.failedItems).toHaveLength(0);
    });

    it('skips local processing when skipLocalImageProcessing is true', async () => {
      const item = makeGeneratorSuccessfulItem();
      generator.generateImages.mockResolvedValue({
        successfulDownloads: [item],
        failedItems: [],
      });

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });
      const config = { skipLocalImageProcessing: true };
      const result = await svc.producePictures({ prompt: 'x' }, 'base', null, config);

      expect(processor.process).not.toHaveBeenCalled();
      expect(result.processedImages).toHaveLength(1);
      expect(result.processedImages[0]).toMatchObject({
        outputPath: item.inputImagePath,
        mappingId: item.mappingId,
      });
    });

    it('records failedItems when processImage throws', async () => {
      const item = makeGeneratorSuccessfulItem();
      generator.generateImages.mockResolvedValue({
        successfulDownloads: [item],
        failedItems: [],
      });
      const mockFs = { readFile: vi.fn().mockResolvedValue(imageBuf) };
      const err = new Error('sharp exploded');
      err.stage = 'processor';
      processor.process.mockRejectedValue(err);

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });
      const result = await svc.producePictures({ prompt: 'x' }, 'base', null, {
        fs: mockFs,
        _softFailures: [],
      });

      expect(result.processedImages).toHaveLength(0);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0]).toMatchObject({
        mappingId: 'map-1',
        stage: 'processor',
        vendor: 'local',
        inputImagePath: item.inputImagePath,
      });
    });

    it('throws when there are no processed images and no failures', async () => {
      generator.generateImages.mockResolvedValue({
        successfulDownloads: [],
        failedItems: [],
      });

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });

      await expect(
        svc.producePictures({ prompt: 'x' }, 'base', null, {}),
      ).rejects.toThrow(/No images were successfully generated/);
    });

    it('returns when only generator failedItems are present', async () => {
      generator.generateImages.mockResolvedValue({
        successfulDownloads: [],
        failedItems: [{ mappingId: 'x', message: 'api' }],
      });

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });
      const result = await svc.producePictures({ prompt: 'x' }, 'base', null, {});

      expect(result.processedImages).toHaveLength(0);
      expect(result.failedItems).toHaveLength(1);
    });

    it('includes softFailures on processed image after remove.bg soft-fail in pipeline', async () => {
      const item = makeGeneratorSuccessfulItem();
      generator.generateImages.mockResolvedValue({
        successfulDownloads: [item],
        failedItems: [],
      });
      const mockFs = {
        readFile: vi
          .fn()
          .mockResolvedValueOnce(imageBuf)
          .mockResolvedValueOnce(imageBuf),
      };
      remover.retryRemoveBackground.mockRejectedValue(new Error('remove.bg down'));
      processor.process.mockResolvedValue('/out.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
        imageRemoverService: remover,
      });
      const result = await svc.producePictures({ prompt: 'x' }, 'base', null, {
        fs: mockFs,
        removeBg: true,
        removeBgFailureMode: 'approve',
        failRetryEnabled: false,
      });

      expect(result.processedImages).toHaveLength(1);
      expect(result.processedImages[0].softFailures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stage: 'remove_bg', vendor: 'remove.bg' }),
        ]),
      );
    });
  });

  describe('processImage', () => {
    it('uses config.fs when provided', async () => {
      const mockFs = {
        readFile: vi.fn().mockResolvedValue(imageBuf),
      };
      processor.process.mockResolvedValue('/done.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });
      const out = await svc.processImage('/in.png', 'name', {
        fs: mockFs,
        removeBg: false,
      });

      expect(mockFs.readFile).toHaveBeenCalledWith('/in.png');
      expect(processor.process).toHaveBeenCalledWith(
        imageBuf,
        'name',
        expect.objectContaining({ inputImagePath: '/in.png' }),
      );
      expect(out).toBe('/done.png');
    });

    it('skips remove.bg when removeBg is false', async () => {
      const mockFs = { readFile: vi.fn().mockResolvedValue(imageBuf) };
      processor.process.mockResolvedValue('/out.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
        imageRemoverService: remover,
      });
      await svc.processImage('/p.png', 'n', { fs: mockFs, removeBg: false });

      expect(remover.retryRemoveBackground).not.toHaveBeenCalled();
    });

    it('calls remover when removeBg is true', async () => {
      const mockFs = { readFile: vi.fn().mockResolvedValue(imageBuf) };
      const cutout = Buffer.from('010203', 'hex');
      remover.retryRemoveBackground.mockResolvedValue(cutout);
      processor.process.mockResolvedValue('/final.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
        imageRemoverService: remover,
      });
      await svc.processImage('/p.png', 'n', {
        fs: mockFs,
        removeBg: true,
        pollingTimeout: 1,
        removeBgSize: 'preview',
      });

      expect(remover.retryRemoveBackground).toHaveBeenCalledWith(
        '/p.png',
        expect.objectContaining({
          removeBgSize: 'preview',
          timeoutMs: expect.any(Number),
        }),
      );
      expect(processor.process).toHaveBeenCalledWith(
        cutout,
        'n',
        expect.any(Object),
      );
    });

    it('soft-fails remove.bg and re-reads original file', async () => {
      const mockFs = {
        readFile: vi
          .fn()
          .mockResolvedValueOnce(imageBuf)
          .mockResolvedValueOnce(imageBuf),
      };
      remover.retryRemoveBackground.mockRejectedValue(new Error('remove.bg down'));
      processor.process.mockResolvedValue('/out.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
        imageRemoverService: remover,
      });
      const config = {
        fs: mockFs,
        removeBg: true,
        removeBgFailureMode: 'approve',
        failRetryEnabled: false,
        _softFailures: [],
      };

      await svc.processImage('/orig.png', 'n', config);

      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
      expect(config._softFailures.length).toBeGreaterThanOrEqual(1);
      expect(processor.process).toHaveBeenCalledWith(
        imageBuf,
        'n',
        expect.any(Object),
      );
    });

    it('hard-fails remove.bg when removeBgFailureMode is mark_failed', async () => {
      const mockFs = { readFile: vi.fn().mockResolvedValue(imageBuf) };
      remover.retryRemoveBackground.mockRejectedValue(new Error('fail'));

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
        imageRemoverService: remover,
      });

      await expect(
        svc.processImage('/orig.png', 'n', {
          fs: mockFs,
          removeBg: true,
          removeBgFailureMode: 'mark_failed',
          _softFailures: [],
        }),
      ).rejects.toMatchObject({ message: 'processing_failed:remove_bg' });
    });

    it('hard-fails remove.bg when failRetryEnabled and failOnSteps includes remove_bg', async () => {
      const mockFs = { readFile: vi.fn().mockResolvedValue(imageBuf) };
      remover.retryRemoveBackground.mockRejectedValue(new Error('fail'));

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
        imageRemoverService: remover,
      });

      await expect(
        svc.processImage('/orig.png', 'n', {
          fs: mockFs,
          removeBg: true,
          removeBgFailureMode: 'approve',
          failRetryEnabled: true,
          failOnSteps: ['remove_bg'],
          _softFailures: [],
        }),
      ).rejects.toMatchObject({ message: 'processing_failed:remove_bg' });
    });

    it('passes through buffer when removeBg is true but no remover', async () => {
      const mockFs = { readFile: vi.fn().mockResolvedValue(imageBuf) };
      processor.process.mockResolvedValue('/out.png');

      const svc = new ImagePipelineService({
        imageGeneratorService: generator,
        imageProcessorService: processor,
      });
      await svc.processImage('/p.png', 'n', {
        fs: mockFs,
        removeBg: true,
      });

      expect(processor.process).toHaveBeenCalledWith(
        imageBuf,
        'n',
        expect.any(Object),
      );
    });
  });
});
