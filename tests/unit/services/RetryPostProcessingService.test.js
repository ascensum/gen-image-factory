/**
 * RetryPostProcessingService — remove.bg retry policy (original vs custom + failOptions).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const { run } = await import('../../../src/services/RetryPostProcessingService.js');

const minimalPng = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000100000100000802000000',
  'hex',
);

describe('RetryPostProcessingService.run', () => {
  let dir;
  let sourcePath;

  beforeEach(async () => {
    dir = path.join(os.tmpdir(), `rpp-test-${Date.now()}`);
    await fs.mkdir(dir, { recursive: true });
    sourcePath = path.join(dir, 'in.png');
    await fs.writeFile(sourcePath, minimalPng);
  });

  afterEach(async () => {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function makeExecutor(processFile) {
    return {
      outputDirectory: dir,
      tempDirectory: dir,
      currentImageId: null,
      generatedImage: {},
      imageProcessorService: { processFile },
    };
  }

  const jobPaths = () => ({
    settings: { filePaths: { outputDirectory: dir, tempDirectory: dir } },
  });

  it('fails retry (remove_bg) on original-settings path even without failOptions', async () => {
    const err = Object.assign(new Error('remove.bg 502'), { stage: 'remove_bg' });
    const executor = makeExecutor(vi.fn().mockRejectedValue(err));
    const settings = { imageConvert: false, removeBg: true };
    const result = await run(
      executor,
      sourcePath,
      settings,
      false,
      jobPaths(),
      true,
      {},
      undefined,
    );
    expect(result.success).toBe(false);
    expect(result.qcReason).toBe('processing_failed:remove_bg');
  });

  it('fails retry when custom failOptions enforces remove_bg', async () => {
    const err = Object.assign(new Error('remove.bg 403'), { stage: 'remove_bg' });
    const executor = makeExecutor(vi.fn().mockRejectedValue(err));
    const settings = { imageConvert: false, removeBg: true };
    const result = await run(
      executor,
      sourcePath,
      settings,
      false,
      jobPaths(),
      false,
      { enabled: true, steps: ['remove_bg'] },
      undefined,
    );
    expect(result.success).toBe(false);
    expect(result.qcReason).toBe('processing_failed:remove_bg');
  });

  it('continues with source file on custom retry without Fail Retry on remove_bg', async () => {
    const outDir = path.join(dir, 'final-out');
    await fs.mkdir(outDir, { recursive: true });
    const err = Object.assign(new Error('remove.bg down'), { stage: 'remove_bg' });
    const processFile = vi.fn().mockRejectedValueOnce(err);
    const executor = makeExecutor(processFile);
    const settings = { imageConvert: false, removeBg: true };
    const result = await run(
      executor,
      sourcePath,
      settings,
      false,
      {
        settings: {
          filePaths: { outputDirectory: outDir, tempDirectory: dir },
        },
      },
      false,
      { enabled: false, steps: [] },
      undefined,
    );
    expect(result.success).toBe(true);
    expect(processFile).toHaveBeenCalledTimes(1);
    expect(result.processedImagePath).toBeTruthy();
    await expect(fs.access(result.processedImagePath)).resolves.toBeUndefined();
  });
});
