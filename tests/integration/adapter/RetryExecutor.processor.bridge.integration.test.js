/**
 * Bridge Integration Tests: RetryExecutor <-> RetryProcessorService (Story 3.5 Phase 2).
 * Coverage: FEATURE_MODULAR_RETRY_PROCESSOR = 'true' (service path), 'false' (legacy path), fallback when service fails.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp') },
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: vi.fn().mockResolvedValue('/tmp/processed.png'),
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: vi.fn().mockResolvedValue({ new_title: 'Test', uploadTags: [] }),
}));

const RetryExecutor = require('../../../src/services/retryExecutor');

describe('RetryExecutor RetryProcessorService Bridge Integration', () => {
  const jobConfigStub = {
    getDefaultSettings: () => ({
      filePaths: { outputDirectory: path.join('/tmp', 'out'), tempDirectory: path.join('/tmp', 'tmp') },
    }),
    init: vi.fn().mockResolvedValue(undefined),
  };

  let tempFilePath;
  let generatedImageStub;
  let originalQueueEnv;
  let originalProcessorEnv;

  beforeEach(async () => {
    const dir = path.join(os.tmpdir(), `retry-processor-bridge-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    tempFilePath = path.join(dir, 'img.png');
    await fs.writeFile(tempFilePath, 'fake');
    generatedImageStub = {
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: {
          id: 'img-1',
          tempImagePath: tempFilePath,
          finalImagePath: null,
          executionId: 'exec-1',
        },
      }),
      updateGeneratedImage: vi.fn().mockResolvedValue(undefined),
      updateMetadataById: vi.fn().mockResolvedValue(undefined),
    };
    originalQueueEnv = process.env.FEATURE_MODULAR_RETRY_QUEUE;
    originalProcessorEnv = process.env.FEATURE_MODULAR_RETRY_PROCESSOR;
  });

  afterEach(() => {
    process.env.FEATURE_MODULAR_RETRY_QUEUE = originalQueueEnv;
    process.env.FEATURE_MODULAR_RETRY_PROCESSOR = originalProcessorEnv;
    vi.clearAllMocks();
  });

  describe('Feature flag disabled (legacy path)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_RETRY_PROCESSOR = 'false';
    });

    it('should use legacy processSingleImage and call getGeneratedImage', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      const job = {
        imageId: 'img-1',
        useOriginalSettings: true,
        modifiedSettings: {},
        includeMetadata: false,
        failOptions: { enabled: false, steps: [] },
      };
      const result = await executor.processSingleImage(job);
      expect(generatedImageStub.getGeneratedImage).toHaveBeenCalledWith('img-1');
      expect(result.success).toBe(true);
    });
  });

  describe('Feature flag enabled (RetryProcessorService path)', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_RETRY_PROCESSOR = 'true';
    });

    it('should use RetryProcessorService.processImage when flag is on', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      const job = {
        imageId: 'img-1',
        useOriginalSettings: true,
        modifiedSettings: {},
        includeMetadata: false,
        failOptions: { enabled: false, steps: [] },
      };
      const result = await executor.processSingleImage(job);
      expect(generatedImageStub.getGeneratedImage).toHaveBeenCalledWith('img-1');
      expect(result.success).toBe(true);
      expect(executor.retryProcessorService).toBeDefined();
    });
  });

  describe('Fallback when RetryProcessorService fails', () => {
    beforeEach(() => {
      process.env.FEATURE_MODULAR_RETRY_PROCESSOR = 'true';
    });

    it('should fall back to legacy processSingleImage when retryProcessorService.processImage throws', async () => {
      const executor = new RetryExecutor({ jobConfig: jobConfigStub, generatedImage: generatedImageStub });
      executor.retryProcessorService.processImage = vi.fn().mockRejectedValue(new Error('Processor error'));
      const job = {
        imageId: 'img-1',
        useOriginalSettings: true,
        modifiedSettings: {},
        includeMetadata: false,
        failOptions: { enabled: false, steps: [] },
      };
      const result = await executor.processSingleImage(job);
      expect(result.success).toBe(true);
      expect(generatedImageStub.getGeneratedImage).toHaveBeenCalledWith('img-1');
    });
  });
});
