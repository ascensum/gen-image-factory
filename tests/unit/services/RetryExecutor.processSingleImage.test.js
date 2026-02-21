import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('RetryExecutor.processSingleImage (unit)', () => {
  let tmpRoot;
  let imgPath;
  let generatedImage;
  let RetryExecutor;
  let prevRemoveBg;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-psi-'));
    imgPath = path.join(tmpRoot, 'img.png');
    fs.writeFileSync(imgPath, 'x', 'utf8');

    prevRemoveBg = process.env.REMOVE_BG_API_KEY;

    RetryExecutor = require('../../../src/services/retryExecutor.js');

    generatedImage = {
      getGeneratedImage: vi.fn(),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    process.env.REMOVE_BG_API_KEY = prevRemoveBg;
  });

  it('uses tempImagePath and marks approved on success', async () => {
    const exec = new RetryExecutor({ generatedImage });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 1, executionId: 10, tempImagePath: imgPath, finalImagePath: '/nope' },
    });

    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValueOnce({ settings: { apiKeys: { removeBg: 'rb' } } });
    vi.spyOn(exec, 'getOriginalProcessingSettings').mockResolvedValueOnce({ removeBg: false });
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValueOnce({ success: true, message: 'ok' });

    const res = await exec.processSingleImage({
      id: 'j1',
      imageId: 1,
      useOriginalSettings: true,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(true);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'processing', '');
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'approved', 'Retry processing successful');
    expect(process.env.REMOVE_BG_API_KEY).toBe('rb');
  });

  it('marks retry_failed with qcReason when processingResult provides one', async () => {
    const exec = new RetryExecutor({ generatedImage });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 2, executionId: 10, tempImagePath: imgPath },
    });
    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValueOnce({ settings: { apiKeys: {} } });
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValueOnce({ success: false, error: 'no', qcReason: 'processing_failed:trim' });

    const res = await exec.processSingleImage({
      id: 'j2',
      imageId: 2,
      useOriginalSettings: false,
      modifiedSettings: { trimTransparentBackground: true },
      includeMetadata: true,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(2, 'retry_failed', 'processing_failed:trim');
  });

  it('maps thrown error.stage to a structured qcReason', async () => {
    const exec = new RetryExecutor({ generatedImage });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 3, executionId: 10, tempImagePath: imgPath },
    });
    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValueOnce({ settings: { apiKeys: {} } });
    vi.spyOn(exec, 'runPostProcessing').mockRejectedValueOnce(Object.assign(new Error('boom'), { stage: 'remove_bg' }));

    const res = await exec.processSingleImage({
      id: 'j3',
      imageId: 3,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(3, 'retry_failed', 'processing_failed:remove_bg');
  });

  it('fails when no image path exists', async () => {
    const exec = new RetryExecutor({ generatedImage });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 4, executionId: 10, tempImagePath: '', finalImagePath: '' },
    });
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValueOnce({ success: true });

    const res = await exec.processSingleImage({
      id: 'j4',
      imageId: 4,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(4, 'retry_failed', 'processing_failed:qc');
  });

  it('falls back to finalImagePath when tempImagePath is missing', async () => {
    const exec = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' } }) } });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 5, executionId: 10, tempImagePath: '', finalImagePath: imgPath },
    });

    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValueOnce({ settings: { apiKeys: {} } });
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValueOnce({ success: true, message: 'ok' });

    const res = await exec.processSingleImage({
      id: 'j5',
      imageId: 5,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(true);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(5, 'approved', 'Retry processing successful');
  });

  it('returns error and marks retry_failed when getGeneratedImage fails', async () => {
    const exec = new RetryExecutor({ generatedImage });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({ success: false, error: 'nope' });

    const res = await exec.processSingleImage({
      id: 'j6',
      imageId: 6,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(false);
    // catch path uses generic qcReason when no stage is present
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(6, 'retry_failed', 'processing_failed:qc');
  });

  it('uses fallback configuration when getOriginalJobConfiguration throws (and still seeds remove.bg key)', async () => {
    const jobConfig = {
      getDefaultSettings: () => ({ apiKeys: { removeBg: 'rb_fallback' }, filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' } }),
    };
    const exec = new RetryExecutor({ generatedImage, jobConfig });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 7, executionId: 10, tempImagePath: imgPath },
    });

    vi.spyOn(exec, 'getOriginalJobConfiguration').mockRejectedValueOnce(new Error('cfg fail'));
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValueOnce({ success: true, message: 'ok' });

    const res = await exec.processSingleImage({
      id: 'j7',
      imageId: 7,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(true);
    expect(process.env.REMOVE_BG_API_KEY).toBe('rb_fallback');
  });

  it('if updateImageStatus throws, still attempts to mark retry_failed in catch', async () => {
    const exec = new RetryExecutor({ generatedImage });
    generatedImage.getGeneratedImage.mockResolvedValueOnce({
      success: true,
      image: { id: 8, executionId: 10, tempImagePath: imgPath },
    });
    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValueOnce({ settings: { apiKeys: {} } });
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValueOnce({ success: true, message: 'ok' });

    const uis = vi.spyOn(exec, 'updateImageStatus')
      .mockRejectedValueOnce(new Error('status down')) // first call (processing)
      .mockResolvedValueOnce(undefined); // catch call (retry_failed)

    const res = await exec.processSingleImage({
      id: 'j8',
      imageId: 8,
      useOriginalSettings: false,
      modifiedSettings: {},
      includeMetadata: false,
      failOptions: { enabled: false, steps: [] },
    });

    expect(res.success).toBe(false);
    expect(uis).toHaveBeenCalledWith(8, 'processing');
    expect(uis).toHaveBeenCalledWith(8, 'retry_failed', 'processing_failed:qc');
  });
});

