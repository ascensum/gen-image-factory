import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'node:module';

vi.mock('../../../src/producePictureModule', () => ({
  producePictureModule: vi.fn(),
}));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));

describe('JobRunner additional coverage: AI + paths + helpers', () => {
  let runner;
  let prevGlobalRunner;
  let aiVision;
  let JobRunner;
  const req = createRequire(import.meta.url);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    prevGlobalRunner = global.currentJobRunner;

    // Spy on real module exports so JobRunner's require('../aiVision') sees the mocked functions
    aiVision = req('../../../src/aiVision');
    vi.spyOn(aiVision, 'runQualityCheck');
    vi.spyOn(aiVision, 'generateMetadata');

    // Require JobRunner after the cache injection is in place
    ({ JobRunner } = req('../../../src/services/jobRunner'));
    runner = new JobRunner({ parameters: { count: 1 } });
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('getSavedImagesForExecution returns [] for missing backendAdapter/executionId and supports wrapped/unwrapped results', async () => {
    runner.backendAdapter = null;
    await expect(runner.getSavedImagesForExecution(123)).resolves.toEqual([]);
    await expect(runner.getSavedImagesForExecution(null)).resolves.toEqual([]);

    const all = [
      { id: 1, executionId: 7 },
      { id: 2, executionId: 8 },
      { id: 3, executionId: 7 },
    ];
    runner.backendAdapter = {
      getAllGeneratedImages: vi.fn()
        .mockResolvedValueOnce({ success: true, images: all })
        .mockResolvedValueOnce(all)
        .mockResolvedValueOnce({ success: true, images: 'nope' }),
    };

    await expect(runner.getSavedImagesForExecution(7)).resolves.toEqual([all[0], all[2]]);
    await expect(runner.getSavedImagesForExecution(8)).resolves.toEqual([all[1]]);
    await expect(runner.getSavedImagesForExecution(7)).resolves.toEqual([]);
  });

  it('runQualityChecks updates qcStatus/qcReason and calls backendAdapter update when mappingId present', async () => {
    const updates = [];
    runner.backendAdapter = {
      updateQCStatusByMappingId: vi.fn(async (mappingId, status, reason) => {
        updates.push({ mappingId, status, reason });
      }),
    };

    aiVision.runQualityCheck
      .mockResolvedValueOnce({ passed: true, reason: 'ok' })
      .mockResolvedValueOnce({ passed: false, reason: 'blurry' });

    const images = [
      { id: 1, tempImagePath: '/tmp/a.png', imageMappingId: 'm1' },
      { id: 2, finalImagePath: '/tmp/b.png', mappingId: 'm2' },
    ];

    await runner.runQualityChecks(images, {
      parameters: { openaiModel: 'gpt-4o', enablePollingTimeout: false },
      ai: { qualityCheckPrompt: 'prompt' },
    });

    expect(runner.backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([
      { mappingId: 'm1', status: 'approved', reason: 'ok' },
      { mappingId: 'm2', status: 'qc_failed', reason: 'blurry' },
    ]);
    expect(images[0]).toEqual(expect.objectContaining({ qcStatus: 'approved', qcReason: 'ok' }));
    expect(images[1]).toEqual(expect.objectContaining({ qcStatus: 'qc_failed', qcReason: 'blurry' }));
  });

  it('runQualityChecks throws when qc input path is missing (covers error path)', async () => {
    aiVision.runQualityCheck.mockResolvedValueOnce({ passed: true, reason: 'ok' });
    await expect(
      runner.runQualityChecks([{ id: 1, imageMappingId: 'x' }], { parameters: {}, ai: {} })
    ).rejects.toThrow(/QC input path is missing/);
  });

  it('generateMetadata persists regenerated metadata by mappingId and marks metadata failures as qc_failed', async () => {
    const updateQC = vi.fn().mockResolvedValue(undefined);
    const updateByMapping = vi.fn().mockResolvedValue(undefined);
    
    runner.backendAdapter = {
      updateQCStatusByMappingId: updateQC,
      updateGeneratedImageByMappingId: updateByMapping,
    };

    aiVision.generateMetadata
      .mockResolvedValueOnce({ new_title: 't', new_description: 'd', uploadTags: ['a', 'b'] })
      .mockImplementationOnce(() => new Promise((_, reject) => global.setTimeout(() => reject(new Error('openai down')), 10)));

    const imgs = [
      { id: 1, mappingId: 'map-1', finalImagePath: '/tmp/ok.png', metadata: { prompt: 'p' } },
      { id: 2, imageMappingId: 'map-2', tempImagePath: '/tmp/fail.png', metadata: { prompt: 'p2' } },
    ];

    await expect(
      runner.generateMetadata(imgs, {
        parameters: { openaiModel: 'gpt-4o', enablePollingTimeout: false },
        ai: { metadataPrompt: 'meta' },
      })
    ).rejects.toThrow(/Metadata generation failed/);

    // map-1 got metadata persisted via backendAdapter
    expect(updateByMapping).toHaveBeenCalledWith(
      'map-1',
      expect.objectContaining({
        metadata: expect.objectContaining({ title: 't', description: 'd' }), // Object not stringified here, assuming adapter handles it?
      })
    );
    // WAIT! In JobRunner code, I pass { metadata: image.metadata } which IS an object (JobRunner.js L2960).
    // The previous code STRINGIFIED it.
    // My new code passes OBJECT.
    // BackendAdapter expects object (it merges it).
    // So expectation should check object.

    // map-2 got qc_failed + metadata failure merged via adapter
    expect(updateQC).toHaveBeenCalledWith('map-2', 'qc_failed', 'processing_failed:metadata');
    expect(updateByMapping).toHaveBeenCalledWith(
      'map-2',
      expect.objectContaining({
        metadata: expect.objectContaining({
          failure: expect.objectContaining({ stage: 'metadata', vendor: 'openai' }),
        }),
      })
    );
  });

  it('waitForQCToSettle returns true when transient QC states clear; times out otherwise', async () => {
    const calls = [];
    runner.backendAdapter = {
      getGeneratedImagesByExecution: vi.fn(async () => {
        calls.push(Date.now());
        // first call has unsettled, second call settled
        if (calls.length === 1) return { success: true, images: [{ qcStatus: 'processing' }] };
        return { success: true, images: [{ qcStatus: 'approved' }] };
      }),
    };
    await expect(runner.waitForQCToSettle(10, 50, 1)).resolves.toBe(true);

    runner.backendAdapter.getGeneratedImagesByExecution = vi.fn(async () => ({ success: true, images: [{ qcStatus: 'retry_pending' }] }));
    await expect(runner.waitForQCToSettle(10, 15, 1)).rejects.toThrow(/QC finalize timeout reached/);
  });

  it('moveImageToFinalLocation moves into configured output dir and prefixes mappingId', async () => {
    const base = path.join(os.tmpdir(), `gif-jobrunner-move-${Date.now()}`);
    const inDir = path.join(base, 'in');
    const outDir = path.join(base, 'out');
    fs.mkdirSync(inDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    const src = path.join(inDir, 'img.png');
    fs.writeFileSync(src, 'x');

    runner.jobConfiguration = { filePaths: { outputDirectory: outDir } };

    const final = await runner.moveImageToFinalLocation(src, 'map-123');
    expect(final).toBe(path.join(outDir, 'map-123_img.png'));
    expect(fs.existsSync(final)).toBe(true);
    expect(fs.existsSync(src)).toBe(false);
  });

  it('moveImageToFinalLocation falls back to copy+unlink when rename fails', async () => {
    const base = path.join(os.tmpdir(), `gif-jobrunner-move-fallback-${Date.now()}`);
    const inDir = path.join(base, 'in');
    const outDir = path.join(base, 'out');
    fs.mkdirSync(inDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    const src = path.join(inDir, 'img.png');
    fs.writeFileSync(src, 'x');

    runner.jobConfiguration = { filePaths: { outputDirectory: outDir } };

    const fsPromises = require('fs').promises;
    vi.spyOn(fsPromises, 'rename').mockRejectedValue(Object.assign(new Error('exdev'), { code: 'EXDEV' }));

    const final = await runner.moveImageToFinalLocation(src, 'map-999');
    expect(final).toBe(path.join(outDir, 'map-999_img.png'));
    expect(fs.existsSync(final)).toBe(true);
    expect(fs.existsSync(src)).toBe(false);
  });
});

