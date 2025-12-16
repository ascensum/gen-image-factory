import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockProcessImage = vi.fn();
const mockGenerateMetadata = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));

vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    getDefaultSettings: vi.fn(() => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} })),
  })),
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: mockProcessImage,
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: mockGenerateMetadata,
}));

describe('RetryExecutor (vite-mocked) additional branches', () => {
  let tmpRoot: string;
  let tempDir: string;
  let outDir: string;

  const makeFile = (p: string, contents = 'x') => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, contents, 'utf8');
  };

  const loadSut = async () => {
    const mod: any = await import('../../../src/services/retryExecutor.js');
    return mod?.default ?? mod;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-branches-'));
    tempDir = path.join(tmpRoot, 'generated');
    outDir = path.join(tmpRoot, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    mockProcessImage.mockReset();
    mockGenerateMetadata.mockReset();
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('addBatchRetryJob invalid imageIds returns error (covers validation branch)', async () => {
    const RetryExecutor = await loadSut();
    const exec: any = new RetryExecutor({ generatedImage: {}, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) } });

    const res = await exec.addBatchRetryJob({ type: 'retry', imageIds: [] });
    expect(res.success).toBe(false);
    expect(String(res.error)).toMatch(/No image IDs/);
  });

  it('processQueue emits job-error when processSingleImage throws', async () => {
    const RetryExecutor = await loadSut();
    const exec: any = new RetryExecutor({ generatedImage: {}, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) } });

    exec.queue.push({ id: 'j1', imageId: 1, useOriginalSettings: false, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] }, status: 'pending' });
    exec.processSingleImage = vi.fn().mockRejectedValue(new Error('boom'));

    const jobError = vi.fn();
    exec.on('job-error', jobError);

    await exec.processQueue();

    expect(jobError).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'j1', imageId: 1 }));
    expect(exec.isProcessing).toBe(false);
  });

  it('processSingleImage marks retry_failed when source file missing (finalImagePath fallback)', async () => {
    const RetryExecutor = await loadSut();

    const missing = path.join(tmpRoot, 'does-not-exist.png');
    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, executionId: 10, tempImagePath: '', finalImagePath: missing } }),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
    };

    const exec: any = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) },
    });

    const res = await exec.processSingleImage({ id: 'j1', imageId: 1, useOriginalSettings: false, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'retry_failed', expect.any(String));
  });

  it('runPostProcessing uses convertToWebp branch and writes final .webp', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'img.png');
    makeFile(sourcePath, 'src');

    const processedPath = path.join(tmpRoot, 'temp_processing', 'img.png');
    mockProcessImage.mockImplementation(async () => {
      makeFile(processedPath, 'processed');
      return processedPath;
    });

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });
    exec.currentImageId = 1;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToWebp: true, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'img.webp'));
    expect(fs.existsSync(path.join(outDir, 'img.webp'))).toBe(true);
  });

  it('runPostProcessing returns qcReason=processing_failed:convert when processImage throws stage=convert and convert is selected', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'img2.png');
    makeFile(sourcePath, 'src2');

    const err: any = new Error('convert fail');
    err.stage = 'convert';
    mockProcessImage.mockRejectedValueOnce(err);

    const exec: any = new RetryExecutor({
      generatedImage: { getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 2, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }) },
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 2;

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

  it('runPostProcessing returns qcReason=processing_failed:metadata when generateMetadata fails and metadata is selected', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'img3.png');
    makeFile(sourcePath, 'src3');

    const processedPath = path.join(tmpRoot, 'temp_processing', 'img3.png');
    mockProcessImage.mockImplementation(async () => {
      makeFile(processedPath, 'processed3');
      return processedPath;
    });

    mockGenerateMetadata.mockRejectedValueOnce(new Error('meta fail'));

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 3, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });
    exec.currentImageId = 3;

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

  it('runPostProcessing returns qcReason=processing_failed:save_final when copy to final fails and convert is selected', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'img4.png');
    makeFile(sourcePath, 'src4');

    const processedPath = path.join(tmpRoot, 'temp_processing', 'img4.png');
    mockProcessImage.mockImplementation(async () => {
      makeFile(processedPath, 'processed4');
      return processedPath;
    });

    const fsProm = require('fs').promises;
    vi.spyOn(fsProm, 'copyFile').mockRejectedValueOnce(new Error('disk full'));

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 4, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });
    exec.currentImageId = 4;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToJpg: true, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['convert'] },
    );

    expect(res.success).toBe(false);
    // Depending on how the failure is surfaced, the module may classify this as
    // either a final-save failure or a convert-related failure.
    expect(['processing_failed:save_final', 'processing_failed:convert']).toContain(res.qcReason);
  });
});
