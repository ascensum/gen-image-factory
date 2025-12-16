import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }));
vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    getDefaultSettings: vi.fn(() => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} })),
  })),
}));
vi.mock('../../../src/producePictureModule', () => ({ processImage: vi.fn() }));
vi.mock('../../../src/aiVision', () => ({ generateMetadata: vi.fn() }));

describe('RetryExecutor.processSingleImage qcReason mapping (vite-mocked)', () => {
  let tmpRoot: string;
  let imgPath: string;

  const loadSut = async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    return mod?.default ?? mod;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-psi-map-'));
    imgPath = path.join(tmpRoot, 'img.png');
    fs.writeFileSync(imgPath, 'x', 'utf8');
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const makeExecutor = async () => {
    const RetryExecutor = await loadSut();
    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, executionId: 10, tempImagePath: imgPath } }),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
    };

    const exec: any = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' }, apiKeys: {} }) },
    });

    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValue({ settings: { apiKeys: {} } });
    vi.spyOn(exec, 'getOriginalProcessingSettings').mockResolvedValue({});

    return { exec, generatedImage };
  };

  it('maps stage=remove_bg to processing_failed:remove_bg', async () => {
    const { exec, generatedImage } = await makeExecutor();

    vi.spyOn(exec, 'runPostProcessing').mockRejectedValueOnce(Object.assign(new Error('rb fail'), { stage: 'remove_bg' }));

    const res = await exec.processSingleImage({ id: 'j1', imageId: 1, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'retry_failed', 'processing_failed:remove_bg');
  });

  it('maps stage=trim to processing_failed:trim', async () => {
    const { exec, generatedImage } = await makeExecutor();

    vi.spyOn(exec, 'runPostProcessing').mockRejectedValueOnce(Object.assign(new Error('trim fail'), { stage: 'trim' }));

    const res = await exec.processSingleImage({ id: 'j1', imageId: 1, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'retry_failed', 'processing_failed:trim');
  });

  it('maps stage=enhancement to processing_failed:enhancement', async () => {
    const { exec, generatedImage } = await makeExecutor();

    vi.spyOn(exec, 'runPostProcessing').mockRejectedValueOnce(Object.assign(new Error('enh fail'), { stage: 'enhancement' }));

    const res = await exec.processSingleImage({ id: 'j1', imageId: 1, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'retry_failed', 'processing_failed:enhancement');
  });

  it('maps stage=save_final to processing_failed:save_final', async () => {
    const { exec, generatedImage } = await makeExecutor();

    vi.spyOn(exec, 'runPostProcessing').mockRejectedValueOnce(Object.assign(new Error('save fail'), { stage: 'save_final' }));

    const res = await exec.processSingleImage({ id: 'j1', imageId: 1, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'retry_failed', 'processing_failed:save_final');
  });

  it('maps stage=metadata to processing_failed:metadata', async () => {
    const { exec, generatedImage } = await makeExecutor();

    vi.spyOn(exec, 'runPostProcessing').mockRejectedValueOnce(Object.assign(new Error('meta fail'), { stage: 'metadata' }));

    const res = await exec.processSingleImage({ id: 'j1', imageId: 1, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: true, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'retry_failed', 'processing_failed:metadata');
  });
});
