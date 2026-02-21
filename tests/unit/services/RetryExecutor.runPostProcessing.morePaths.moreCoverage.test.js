import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('RetryExecutor.runPostProcessing additional paths (more coverage)', () => {
  let prevCache = {};
  let tmpRoot;
  let desktopPath;
  let tempDir;
  let outDir;

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const set = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };
  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/retryExecutor.js');
    remember(sutId);
    delete req.cache[sutId];
    return req(sutId);
  };

  const mockProcessImage = vi.fn();
  const mockGenerateMetadata = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-rpp2-'));
    desktopPath = path.join(tmpRoot, 'desktop');
    tempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'generated');
    outDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    set(req.resolve('electron'), { app: { getPath: () => desktopPath } });
    set(req.resolve('../../../src/producePictureModule.js'), { processImage: mockProcessImage });
    set(req.resolve('../../../src/aiVision.js'), { generateMetadata: mockGenerateMetadata });
    // Avoid requiring real DB model in constructor
    set(req.resolve('../../../src/database/models/JobConfiguration.js'), { JobConfiguration: function () { return {}; } });
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('reads metadataPromptFile successfully and passes it to aiVision.generateMetadata', async () => {
    const RetryExecutor = loadSut();

    const metaPromptFile = path.join(tmpRoot, 'metadata_prompt.txt');
    fs.writeFileSync(metaPromptFile, 'MY_META_PROMPT', 'utf8');

    const sourcePath = path.join(tempDir, 'source.png');
    fs.writeFileSync(sourcePath, 'src', 'utf8');

    const processedTempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing');
    fs.mkdirSync(processedTempDir, { recursive: true });
    const processedPath = path.join(processedTempDir, 'source.png');
    fs.writeFileSync(processedPath, 'processed', 'utf8');

    mockProcessImage.mockResolvedValueOnce(processedPath);
    mockGenerateMetadata.mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: ['x'] });

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, generationPrompt: 'ORIG_PROMPT', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 1;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: { metadataPromptFile: metaPromptFile } },
      true,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir, metadataPromptFile: metaPromptFile } } },
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
    expect(mockGenerateMetadata).toHaveBeenCalledWith(
      processedPath,
      'ORIG_PROMPT',
      'MY_META_PROMPT',
      expect.any(String),
    );
    // Source was inside temp dir and final differs -> should be deleted
    expect(fs.existsSync(sourcePath)).toBe(false);
  });

  it('continues without metadata when aiVision.generateMetadata fails and metadata is NOT selected to hard-fail', async () => {
    const RetryExecutor = loadSut();

    const sourcePath = path.join(tempDir, 'source2.png');
    fs.writeFileSync(sourcePath, 'src2', 'utf8');

    const processedTempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing');
    fs.mkdirSync(processedTempDir, { recursive: true });
    const processedPath = path.join(processedTempDir, 'source2.png');
    fs.writeFileSync(processedPath, 'processed2', 'utf8');

    mockProcessImage.mockResolvedValueOnce(processedPath);
    mockGenerateMetadata.mockRejectedValueOnce(new Error('meta down'));

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 2, generationPrompt: 'P', executionId: 10, seed: 1, metadata: { title: 'old' }, processingSettings: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 2;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      true,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: true, steps: ['convert'] }, // metadata NOT selected
    );

    expect(res.success).toBe(true);
    expect(mockGenerateMetadata).toHaveBeenCalled();
    // Should not crash; metadataResult stays null so updateMetadataById should not be required
    expect(generatedImage.updateGeneratedImage).toHaveBeenCalled();
  });

  it('swallows processed-temp cleanup errors (unlink) and still succeeds', async () => {
    const RetryExecutor = loadSut();

    const sourcePath = path.join(tempDir, 'source3.png');
    fs.writeFileSync(sourcePath, 'src3', 'utf8');

    const processedTempDir = path.join(desktopPath, 'gen-image-factory', 'pictures', 'temp_processing');
    fs.mkdirSync(processedTempDir, { recursive: true });
    const processedPath = path.join(processedTempDir, 'source3.png');
    fs.writeFileSync(processedPath, 'processed3', 'utf8');

    mockProcessImage.mockResolvedValueOnce(processedPath);
    mockGenerateMetadata.mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: [] });

    const fsProm = require('fs').promises;
    vi.spyOn(fsProm, 'unlink').mockRejectedValueOnce(new Error('cannot delete temp processed'));

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 3, generationPrompt: 'P', executionId: 10, seed: 1, metadata: null } }),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: {} }) },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });
    exec.currentImageId = 3;

    const res = await exec.runPostProcessing(
      sourcePath,
      { imageConvert: false, filePaths: {} },
      true,
      { settings: { filePaths: { outputDirectory: outDir, tempDirectory: tempDir } } },
      false,
      { enabled: false, steps: [] },
    );

    expect(res.success).toBe(true);
  });
});
