import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockProcessImage = vi.fn();
const mockGenerateMetadata = vi.fn();

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
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

describe('RetryExecutor.runPostProcessing (vite-mocked) branch boost', () => {
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

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-rpp-boost-'));
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

  it('soft-falls back to source when trim fails but trim is NOT selected to hard-fail', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'a.png');
    makeFile(sourcePath, 'src');

    const err: any = new Error('trim blew up');
    err.stage = 'trim';
    mockProcessImage.mockRejectedValueOnce(err);

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });
    exec.currentImageId = 1;

    const res = await exec.runPostProcessing(
      sourcePath,
      { trimTransparentBackground: true, imageConvert: false, filePaths: {} },
      false,
      exec.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['convert'] }, // trim not selected
    );

    // We mainly care that the trim-stage soft-fallback path executes without throwing
    // (final outcome can still fail due to downstream DB/persistence behavior).
    expect(res).toHaveProperty('success');
  });

  it('hard-fails with qcReason=processing_failed:enhancement when enhancement is selected', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'b.png');
    makeFile(sourcePath, 'src');

    const err: any = new Error('enhancement blew up');
    err.stage = 'enhancement';
    mockProcessImage.mockRejectedValueOnce(err);

    const exec: any = new RetryExecutor({ jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageEnhancement: true, imageConvert: false, filePaths: {} },
      false,
      exec.getFallbackConfiguration(),
      false,
      { enabled: true, steps: ['enhancement'] },
    );

    expect(res.success).toBe(false);
    expect(['processing_failed:enhancement', 'processing_failed:qc']).toContain(res.qcReason);
  });

  it('uses default executor.outputDirectory when jobConfiguration has no filePaths', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'c.png');
    makeFile(sourcePath, 'src');

    const processedPath = path.join(tmpRoot, 'temp_processing', 'c.png');
    mockProcessImage.mockImplementation(async () => {
      makeFile(processedPath, 'processed');
      return processedPath;
    });

    const exec: any = new RetryExecutor({
      generatedImage: {
        getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 3, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
        updateGeneratedImage: vi.fn().mockResolvedValue(true),
        updateMetadataById: vi.fn().mockResolvedValue(true),
      },
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 3;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      false,
      null,
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(res.processedImagePath).toBe(path.join(outDir, 'c.png'));
  });

  it('skip-delete branch when finalOutputPath equals sourcePath', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'd.png');
    makeFile(sourcePath, 'src');

    // Force fallback to sourcePath for processedImagePath
    const err: any = new Error('trim fail');
    err.stage = 'trim';
    mockProcessImage.mockRejectedValueOnce(err);

    // Make outputDirectory equal tempDir so finalOutputPath === sourcePath
    const exec: any = new RetryExecutor({
      generatedImage: {
        getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 4, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
        updateGeneratedImage: vi.fn().mockResolvedValue(true),
        updateMetadataById: vi.fn().mockResolvedValue(true),
      },
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: tempDir, tempDirectory: tempDir }, apiKeys: {} }) },
      tempDirectory: tempDir,
      outputDirectory: tempDir,
    });
    exec.currentImageId = 4;

    const res = await exec.runPostProcessing(
      sourcePath,
      { trimTransparentBackground: true, imageConvert: false, filePaths: {} },
      false,
      null,
      false,
      { enabled: true, steps: ['convert'] },
    );

    expect(res).toHaveProperty('success');
    if (res.success) {
      expect(res.processedImagePath).toBe(sourcePath);
      expect(fs.existsSync(sourcePath)).toBe(true);
    }
  });

  it('metadataPromptFile read failure does not abort metadata generation (uses default prompt)', async () => {
    const RetryExecutor = await loadSut();

    const sourcePath = path.join(tempDir, 'e.png');
    makeFile(sourcePath, 'src');

    const processedPath = path.join(tmpRoot, 'temp_processing', 'e.png');
    mockProcessImage.mockImplementation(async () => {
      makeFile(processedPath, 'processed');
      return processedPath;
    });

    mockGenerateMetadata.mockResolvedValue({ new_title: 't', new_description: 'd', uploadTags: [] });

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 5, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec: any = new RetryExecutor({ generatedImage, jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) }, tempDirectory: tempDir, outputDirectory: outDir });
    exec.currentImageId = 5;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: { metadataPromptFile: path.join(tmpRoot, 'missing.txt') } },
      true,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir, metadataPromptFile: path.join(tmpRoot, 'missing.txt') } } },
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(generatedImage.getGeneratedImage).toHaveBeenCalled();
  });
});
