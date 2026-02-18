/**
 * Unit tests for RetryProcessorService (Story 3.5 Phase 2).
 * Coverage target: ≥70%. Mock getImage, updateImageStatus, config/settings getters, runPostProcessing, emit.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const { RetryProcessorService } = await import('../../../src/services/RetryProcessorService.js');

describe('RetryProcessorService', () => {
  let getImage;
  let updateImageStatus;
  let getOriginalJobConfiguration;
  let getFallbackConfiguration;
  let getOriginalProcessingSettings;
  let runPostProcessing;
  let emit;
  let setCurrentImageId;
  let service;
  /** @type {string} temp file path that exists for processImage flow */
  let tempFilePath;
  /** @type {string} second temp file for finalImagePath-only tests */
  let tempFilePath2;

  beforeEach(async () => {
    const dir = path.join(os.tmpdir(), `retry-processor-test-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    tempFilePath = path.join(dir, 'img1.png');
    tempFilePath2 = path.join(dir, 'img2.png');
    await fs.writeFile(tempFilePath, 'fake-png');
    await fs.writeFile(tempFilePath2, 'fake-png');
    getImage = vi.fn().mockResolvedValue({
      success: true,
      image: {
        id: 'img-1',
        tempImagePath: tempFilePath,
        finalImagePath: null,
        executionId: 'exec-1'
      }
    });
    updateImageStatus = vi.fn().mockResolvedValue(undefined);
    getOriginalJobConfiguration = vi.fn().mockResolvedValue({ id: 'config-1', settings: {} });
    getFallbackConfiguration = vi.fn().mockReturnValue({ settings: {} });
    getOriginalProcessingSettings = vi.fn().mockResolvedValue({});
    runPostProcessing = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
    emit = vi.fn();
    setCurrentImageId = vi.fn();
    service = new RetryProcessorService({
      getImage,
      updateImageStatus,
      getOriginalJobConfiguration,
      getFallbackConfiguration,
      getOriginalProcessingSettings,
      runPostProcessing,
      emit,
      setCurrentImageId
    });
  });

  describe('constructor', () => {
    it('should accept all deps and use them', async () => {
      const job = { imageId: 'x', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      expect(getImage).toHaveBeenCalledWith('x');
      expect(updateImageStatus).toHaveBeenCalled();
      expect(setCurrentImageId).toHaveBeenCalledWith('x');
    });

    it('should work with minimal deps (no-op defaults)', async () => {
      const s = new RetryProcessorService({});
      const result = await s.processImage({ imageId: 'id', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false });
      expect(result.success).toBe(false);
    });
  });

  describe('processImage', () => {
    it('should resolve source from tempImagePath then finalImagePath', async () => {
      getImage.mockResolvedValue({
        success: true,
        image: { id: 'i', tempImagePath: tempFilePath, finalImagePath: tempFilePath2 }
      });
      const job = { imageId: 'i', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      expect(runPostProcessing).toHaveBeenCalled();
      const [sourcePath] = runPostProcessing.mock.calls[0];
      expect(path.normalize(sourcePath)).toBe(path.normalize(tempFilePath));
    });

    it('should use finalImagePath when tempImagePath is missing', async () => {
      getImage.mockResolvedValue({
        success: true,
        image: { id: 'i', tempImagePath: null, finalImagePath: tempFilePath2 }
      });
      const job = { imageId: 'i', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      const [sourcePath] = runPostProcessing.mock.calls[0];
      expect(path.normalize(sourcePath)).toBe(path.normalize(tempFilePath2));
    });

    it('should call updateImageStatus(processing) then (approved) on success', async () => {
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      expect(updateImageStatus).toHaveBeenCalledWith('img-1', 'processing');
      expect(updateImageStatus).toHaveBeenCalledWith('img-1', 'approved', 'Retry processing successful');
    });

    it('should use getOriginalProcessingSettings when useOriginalSettings is true', async () => {
      getOriginalProcessingSettings.mockResolvedValue({ foo: 'bar' });
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      expect(getOriginalProcessingSettings).toHaveBeenCalled();
      const [, settings] = runPostProcessing.mock.calls[0];
      expect(settings).toEqual({ foo: 'bar' });
    });

    it('should use modifiedSettings when useOriginalSettings is false', async () => {
      const job = { imageId: 'img-1', useOriginalSettings: false, modifiedSettings: { a: 1 }, includeMetadata: false };
      await service.processImage(job);
      expect(getOriginalProcessingSettings).not.toHaveBeenCalled();
      const [, settings] = runPostProcessing.mock.calls[0];
      expect(settings).toEqual({ a: 1 });
    });

    it('should call updateImageStatus(retry_failed) and return result when runPostProcessing fails', async () => {
      runPostProcessing.mockResolvedValue({ success: false, qcReason: 'processing_failed:trim' });
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      const result = await service.processImage(job);
      expect(result.success).toBe(false);
      expect(updateImageStatus).toHaveBeenCalledWith('img-1', 'retry_failed', 'processing_failed:trim');
    });

    it('should map error.stage to qcReason when process throws', async () => {
      getImage.mockRejectedValue(Object.assign(new Error('fail'), { stage: 'remove_bg' }));
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      const result = await service.processImage(job);
      expect(result.success).toBe(false);
      expect(updateImageStatus).toHaveBeenCalledWith('img-1', 'retry_failed', 'processing_failed:remove_bg');
    });

    it('should use getFallbackConfiguration when getOriginalJobConfiguration throws', async () => {
      getOriginalJobConfiguration.mockRejectedValue(new Error('no config'));
      getFallbackConfiguration.mockReturnValue({ id: 'fallback', settings: {} });
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      expect(getFallbackConfiguration).toHaveBeenCalled();
      const [, , , jobConfig] = runPostProcessing.mock.calls[0];
      expect(jobConfig).toEqual({ id: 'fallback', settings: {} });
    });

    it('should pass failOptions to runPostProcessing', async () => {
      const failOptions = { enabled: true, steps: ['trim'] };
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: true, failOptions };
      await service.processImage(job);
      const args = runPostProcessing.mock.calls[0];
      expect(args[5]).toEqual(failOptions);
    });

    it('should clear currentImageId in finally', async () => {
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      await service.processImage(job);
      expect(setCurrentImageId).toHaveBeenCalledWith('img-1');
      expect(setCurrentImageId).toHaveBeenLastCalledWith(null);
    });

    it('should return success: false when getImage returns success: false', async () => {
      getImage.mockResolvedValue({ success: false });
      const job = { imageId: 'img-1', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      const result = await service.processImage(job);
      expect(result.success).toBe(false);
      expect(runPostProcessing).not.toHaveBeenCalled();
    });

    it('should throw when no image path (tempImagePath and finalImagePath missing)', async () => {
      getImage.mockResolvedValue({
        success: true,
        image: { id: 'i', tempImagePath: null, finalImagePath: null }
      });
      const job = { imageId: 'i', useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false };
      const result = await service.processImage(job);
      expect(result.success).toBe(false);
      expect(updateImageStatus).toHaveBeenCalledWith('i', 'retry_failed', expect.any(String));
    });
  });

  describe('retryImage', () => {
    it('should build job and call processImage', async () => {
      const result = await service.retryImage('img-2', {
        useOriginalSettings: false,
        modifiedSettings: { x: 1 },
        includeMetadata: true,
        failOptions: { enabled: false, steps: [] }
      });
      expect(getImage).toHaveBeenCalledWith('img-2');
      expect(runPostProcessing).toHaveBeenCalledWith(
        expect.any(String),
        { x: 1 },
        true,
        expect.any(Object),
        false,
        { enabled: false, steps: [] }
      );
      expect(result.success).toBe(true);
    });

    it('should default useOriginalSettings to true when omitted', async () => {
      await service.retryImage('img-3', {});
      expect(getOriginalProcessingSettings).toHaveBeenCalled();
    });
  });
});
