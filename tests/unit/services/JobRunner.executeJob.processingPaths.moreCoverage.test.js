import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({ runQualityCheck: vi.fn(), generateMetadata: vi.fn() }));

const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner.executeJob (processing paths, QC disabled) - extra coverage', () => {
  let runner;
  let prevGlobalRunner;
  let baseDir;
  let tempDir;
  let outDir;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;

    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrunner-execjob-'));
    tempDir = path.join(baseDir, 'generated');
    outDir = path.join(baseDir, 'toupload');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    runner = new JobRunner({ parameters: { count: 1 } });
    runner.configurationId = 456;
    runner.databaseExecutionId = 123;
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
    try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch {}
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('approves and moves images to final output when QC is disabled', async () => {
    const store = { images: [] };
    const adapter = {
      saveGeneratedImage: vi.fn(async (payload) => {
        const id = store.images.length + 1;
        store.images.push({
          id,
          executionId: payload.executionId,
          imageMappingId: payload.imageMappingId,
          qcStatus: payload.qcStatus,
          qcReason: payload.qcReason,
          tempImagePath: payload.tempImagePath,
          finalImagePath: payload.finalImagePath,
          metadata: payload.metadata,
        });
        return { success: true, id };
      }),
      getAllGeneratedImages: vi.fn(async () => ({ success: true, images: store.images })),
      getGeneratedImagesByExecution: vi.fn(async (executionId) => ({
        success: true,
        images: store.images.filter((i) => i.executionId === executionId),
      })),
      updateQCStatusByMappingId: vi.fn(async (mappingId, status, reason) => {
        const img = store.images.find((i) => i.imageMappingId === mappingId);
        if (img) { img.qcStatus = status; img.qcReason = reason; }
        return { success: true };
      }),
      updateImagePathsByMappingId: vi.fn(async (mappingId, tempPath, finalPath) => {
        const img = store.images.find((i) => i.imageMappingId === mappingId);
        if (img) { img.tempImagePath = tempPath; img.finalImagePath = finalPath; }
        return { success: true };
      }),
      updateGeneratedImageByMappingId: vi.fn(async (mappingId, patch) => {
        const img = store.images.find((i) => i.imageMappingId === mappingId);
        if (img) img.metadata = patch.metadata || img.metadata;
        return { success: true };
      }),
      updateJobExecution: vi.fn(async () => ({ success: true })),
    };

    runner.backendAdapter = adapter;

    const src1 = path.join(tempDir, 'img1.png');
    const src2 = path.join(tempDir, 'img2.png');
    fs.writeFileSync(src1, 'x');
    fs.writeFileSync(src2, 'y');

    // Ensure JobRunner uses this config for move logic
    const jobConfig = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { tempDirectory: tempDir, outputDirectory: outDir },
      parameters: { processMode: 'batch', count: 1, variations: 2, enablePollingTimeout: false },
      processing: { imageConvert: true, convertToJpg: true, removeBg: false, removeBgFailureMode: 'approve' },
      ai: { runQualityCheck: false, runMetadataGen: false },
    };
    runner.jobConfiguration = jobConfig;

    // Keep parameter/image generation deterministic and focused on executeJob internals
    vi.spyOn(runner, 'generateParameters').mockResolvedValueOnce({ prompt: 'p', promptContext: 'ctx', aspectRatios: ['1:1'] });
    vi.spyOn(runner, 'generateImages').mockResolvedValueOnce([
      { path: src1, status: 'generated', mappingId: 'm1', aspectRatio: '1:1', metadata: { prompt: 'p' } },
      { path: src2, status: 'generated', mappingId: 'm2', aspectRatio: '1:1', metadata: { prompt: 'p' } },
    ]);

    await expect(runner.executeJob(jobConfig, 'job-xyz')).resolves.toBeUndefined();

    // Both images should have been saved, approved, moved, and paths updated
    expect(adapter.saveGeneratedImage).toHaveBeenCalledTimes(2);
    expect(adapter.updateQCStatusByMappingId).toHaveBeenCalled();
    expect(adapter.updateImagePathsByMappingId).toHaveBeenCalled();

    const moved1 = store.images.find((i) => i.imageMappingId === 'm1')?.finalImagePath;
    const moved2 = store.images.find((i) => i.imageMappingId === 'm2')?.finalImagePath;
    expect(typeof moved1).toBe('string');
    expect(typeof moved2).toBe('string');
    expect(fs.existsSync(moved1)).toBe(true);
    expect(fs.existsSync(moved2)).toBe(true);
    expect(store.images.find((i) => i.imageMappingId === 'm1')?.qcStatus).toBe('approved');
    expect(store.images.find((i) => i.imageMappingId === 'm2')?.qcStatus).toBe('approved');
  });
});

