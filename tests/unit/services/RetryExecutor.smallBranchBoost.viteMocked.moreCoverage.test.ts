import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockProcessImage = vi.fn();

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }));
vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    getDefaultSettings: vi.fn(() => ({ filePaths: { outputDirectory: '/tmp/out', tempDirectory: '/tmp/tmp' }, apiKeys: {} })),
  })),
}));
vi.mock('../../../src/producePictureModule', () => ({ processImage: mockProcessImage }));
vi.mock('../../../src/aiVision', () => ({ generateMetadata: vi.fn() }));

describe('RetryExecutor (vite-mocked) small branch boosts', () => {
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

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-small-'));
    tempDir = path.join(tmpRoot, 'generated');
    outDir = path.join(tmpRoot, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    mockProcessImage.mockReset();
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('runPostProcessing success path covers convertToJpg branch', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'img.png');
    makeFile(sourcePath, 'src');

    const processedPath = path.join(tmpRoot, 'temp_processing', 'img.png');
    mockProcessImage.mockImplementation(async () => {
      makeFile(processedPath, 'processed');
      return processedPath;
    });

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null, processingSettings: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });
    exec.currentImageId = 1;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: true, convertToJpg: true, filePaths: {} },
      false,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'img.jpg'));
    expect(fs.existsSync(path.join(outDir, 'img.jpg'))).toBe(true);
  });

  it('processSingleImage uses processingResult.qcReason when present (no throw)', async () => {
    const RetryExecutor = await loadSut();

    const imgPath = path.join(tempDir, 'x.png');
    makeFile(imgPath, 'x');

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 2, executionId: 10, tempImagePath: imgPath } }),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) } });

    vi.spyOn(exec, 'getOriginalJobConfiguration').mockResolvedValue({ settings: { apiKeys: {} } });
    vi.spyOn(exec, 'getOriginalProcessingSettings').mockResolvedValue({});
    vi.spyOn(exec, 'runPostProcessing').mockResolvedValue({ success: false, error: 'x', qcReason: 'processing_failed:trim' });

    const res = await exec.processSingleImage({ id: 'j2', imageId: 2, useOriginalSettings: true, modifiedSettings: {}, includeMetadata: false, failOptions: { enabled: false, steps: [] } });

    expect(res.success).toBe(false);
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(2, 'retry_failed', 'processing_failed:trim');
  });
});
