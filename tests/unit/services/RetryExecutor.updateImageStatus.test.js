import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('RetryExecutor.updateImageStatus (unit)', () => {
  let RetryExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    RetryExecutor = require('../../../src/services/retryExecutor.js');
  });

  it('updates DB via generatedImage.updateQCStatus and emits image-status-updated', async () => {
    const generatedImage = { updateQCStatus: vi.fn().mockResolvedValue(undefined) };
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' } }) },
    });

    const events = [];
    exec.on('image-status-updated', (e) => events.push(e));

    await exec.updateImageStatus(123, 'approved', 'ok');

    expect(generatedImage.updateQCStatus).toHaveBeenCalledWith(123, 'approved', 'ok');
    expect(events.length).toBe(1);
    expect(events[0]).toEqual(expect.objectContaining({ imageId: 123, status: 'approved', reason: 'ok', context: 'retry' }));
    expect(events[0].timestamp).toBeInstanceOf(Date);
  });

  it('still emits event when generatedImage model is missing updateQCStatus', async () => {
    const exec = new RetryExecutor({
      generatedImage: {},
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' } }) },
    });

    const spy = vi.fn();
    exec.on('image-status-updated', spy);

    await exec.updateImageStatus(1, 'processing', '');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ imageId: 1, status: 'processing', context: 'retry' }));
  });

  it('swallows DB update errors and still emits event', async () => {
    const generatedImage = { updateQCStatus: vi.fn().mockRejectedValue(new Error('db down')) };
    const exec = new RetryExecutor({
      generatedImage,
      jobConfig: { getDefaultSettings: () => ({ filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' } }) },
    });

    const spy = vi.fn();
    exec.on('image-status-updated', spy);

    await exec.updateImageStatus(5, 'retry_failed', 'processing_failed:qc');

    expect(generatedImage.updateQCStatus).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ imageId: 5, status: 'retry_failed', reason: 'processing_failed:qc' }));
  });
});

