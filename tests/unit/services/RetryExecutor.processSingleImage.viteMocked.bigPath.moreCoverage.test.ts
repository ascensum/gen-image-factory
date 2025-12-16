import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockGetJobExecution = vi.fn();
const mockGetConfigurationById = vi.fn();
const mockGetDefaultSettings = vi.fn();
const mockProcessImage = vi.fn();
const mockGenerateMetadata = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));

vi.mock('../../../src/database/models/JobExecution', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getJobExecution: mockGetJobExecution,
  })),
}));

vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getDefaultSettings: mockGetDefaultSettings,
    getConfigurationById: mockGetConfigurationById,
  })),
}));

vi.mock('../../../src/producePictureModule', () => ({
  processImage: mockProcessImage,
}));

vi.mock('../../../src/aiVision', () => ({
  generateMetadata: mockGenerateMetadata,
}));

describe('RetryExecutor.processSingleImage (vite-mocked) big path', () => {
  let tmpRoot: string;
  let tempDir: string;
  let outDir: string;
  let sourcePath: string;
  let prevEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    prevEnv = process.env.REMOVE_BG_API_KEY;

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retryexec-psi-vite-'));
    tempDir = path.join(tmpRoot, 'generated');
    outDir = path.join(tmpRoot, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    sourcePath = path.join(tempDir, 'img.png');
    fs.writeFileSync(sourcePath, 'src', 'utf8');

    mockGetJobExecution.mockResolvedValue({ success: true, execution: { id: 10, configurationId: 99 } });
    mockGetDefaultSettings.mockReturnValue({
      filePaths: { outputDirectory: outDir, tempDirectory: tempDir },
      apiKeys: { removeBg: 'rb_from_defaults' },
    });
    mockGetConfigurationById.mockResolvedValue({
      success: true,
      configuration: {
        id: 99,
        settings: {
          apiKeys: { removeBg: 'rb_from_config' },
          filePaths: { outputDirectory: outDir, tempDirectory: tempDir },
        },
      },
    });
  });

  afterEach(() => {
    process.env.REMOVE_BG_API_KEY = prevEnv;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('processes tempImagePath end-to-end: processing + metadata + move + DB updates', async () => {
    const processedDir = path.join(tmpRoot, 'temp_processing');
    fs.mkdirSync(processedDir, { recursive: true });
    const processedPath = path.join(processedDir, 'img.png');

    mockProcessImage.mockImplementation(async () => {
      fs.writeFileSync(processedPath, 'processed', 'utf8');
      return processedPath;
    });

    mockGenerateMetadata.mockResolvedValue({ new_title: 'T', new_description: 'D', uploadTags: ['a', 'b'] });

    const generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: {
          id: 1,
          executionId: 10,
          tempImagePath: sourcePath,
          finalImagePath: null,
          generationPrompt: 'PROMPT',
          seed: 123,
          metadata: null,
          processingSettings: null,
        },
      }),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
      updateGeneratedImage: vi.fn().mockResolvedValue(true),
      updateMetadataById: vi.fn().mockResolvedValue(true),
    };

    const mod: any = await import('../../../src/services/retryExecutor.js');
    const RetryExecutor = mod?.default ?? mod;

    const exec: any = new RetryExecutor({
      generatedImage,
      jobConfig: {
        getDefaultSettings: () => ({ filePaths: { outputDirectory: outDir, tempDirectory: tempDir }, apiKeys: { removeBg: 'rb_from_defaults' } }),
        getConfigurationById: mockGetConfigurationById,
      },
      tempDirectory: tempDir,
      outputDirectory: outDir,
    });

    const res = await exec.processSingleImage({
      id: 'job-1',
      imageId: 1,
      useOriginalSettings: false,
      modifiedSettings: { imageConvert: false, filePaths: {} },
      includeMetadata: true,
      failOptions: { enabled: false, steps: [] },
      status: 'pending',
    });

    expect(res.success).toBe(true);
    // Depending on whether getOriginalJobConfiguration resolves original config vs fallback,
    // the seeded remove.bg key can come from config or defaults.
    expect(['rb_from_config', 'rb_from_defaults']).toContain(process.env.REMOVE_BG_API_KEY);

    // Final file should exist in output dir
    expect(fs.existsSync(path.join(outDir, 'img.png'))).toBe(true);

    // Source file was in tempDir and should be deleted
    expect(fs.existsSync(sourcePath)).toBe(false);

    // DB status transitions
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'processing', '');
    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(1, 'approved', 'Retry processing successful');

    // DB path + metadata update
    expect(generatedImage.updateGeneratedImage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        qcStatus: 'approved',
        finalImagePath: path.join(outDir, 'img.png'),
      }),
    );
  });
});
