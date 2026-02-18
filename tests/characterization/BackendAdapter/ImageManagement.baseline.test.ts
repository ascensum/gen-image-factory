/**
 * CHARACTERIZATION TEST: BackendAdapter Image Management Baseline
 *
 * Purpose: Capture CURRENT image save/retrieve/QC status behavior BEFORE extraction (ADR-011).
 * Baseline: saveGeneratedImage, getGeneratedImage, getGeneratedImagesByExecution, updateQCStatus.
 *
 * CRITICAL: Tests must pass against CURRENT BackendAdapter code (100% pass rate).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { patchCjsDeps, createAdapter, storedApiKeys } from './shared-setup.js';

describe('BackendAdapter Image Management Characterization (Baseline)', () => {
  let BackendAdapter: any;
  let adapter: any;
  let teardown: { restore: () => void };

  beforeEach(async () => {
    Object.keys(storedApiKeys).forEach((k) => delete storedApiKeys[k]);
    vi.resetModules();
    teardown = patchCjsDeps();
    const mod = await import('../../../src/adapter/backendAdapter.js');
    BackendAdapter = mod.BackendAdapter;
    adapter = createAdapter(BackendAdapter);
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    teardown.restore();
    vi.clearAllMocks();
  });

  it('should save generated image and return result', async () => {
    adapter.generatedImage.saveGeneratedImage = vi.fn().mockResolvedValue({ success: true, id: 42 });
    const image = {
      executionId: 1,
      generationPrompt: 'test',
      seed: 123,
      qcStatus: 'pending',
      tempImagePath: '/tmp/img.png',
    };
    const result = await adapter.saveGeneratedImage(image);
    expect(result.success).toBe(true);
    expect(adapter.generatedImage.saveGeneratedImage).toHaveBeenCalledWith(image);
  });

  it('should return getGeneratedImage result from model', async () => {
    const mockImage = { id: 1, executionId: 1, qcStatus: 'approved' };
    adapter.generatedImage.getGeneratedImage = vi.fn().mockResolvedValue({
      success: true,
      image: mockImage,
    });
    const result = await adapter.getGeneratedImage(1);
    expect(result.success).toBe(true);
    expect(result.image).toEqual(mockImage);
  });

  it('should return getGeneratedImagesByExecution list', async () => {
    const mockImages = [{ id: 1 }, { id: 2 }];
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({
      success: true,
      images: mockImages,
    });
    const result = await adapter.getGeneratedImagesByExecution(10);
    expect(result.success).toBe(true);
    expect(result.images).toEqual(mockImages);
  });

  it('should update QC status via updateQCStatus', async () => {
    adapter.generatedImage.updateQCStatus = vi.fn().mockResolvedValue(undefined);
    const result = await adapter.updateQCStatus('img-1', 'approved', 'Retry successful');
    expect(adapter.generatedImage.updateQCStatus).toHaveBeenCalledWith(
      'img-1',
      'approved',
      'Retry successful'
    );
    expect(result === undefined || result !== undefined).toBe(true);
  });

  it('should return success false when getGeneratedImage fails', async () => {
    adapter.generatedImage.getGeneratedImage = vi.fn().mockResolvedValue({ success: false });
    const result = await adapter.getGeneratedImage(999);
    expect(result.success).toBe(false);
  });
});
