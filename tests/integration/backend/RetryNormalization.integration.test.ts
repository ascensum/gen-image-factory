import { describe, it, expect, beforeEach, vi } from 'vitest';

// Avoid native sqlite3 init in integration tests
vi.mock('sqlite3', () => ({ verbose: () => ({ Database: vi.fn() }), Database: vi.fn() }));

// Spy on processImage to capture config passed (mock before importing BackendAdapter)
vi.mock('../../../src/producePictureModule', () => ({
  processImage: vi.fn().mockResolvedValue('/tmp/out.png')
}));

// Mock minimal fs
vi.mock('fs', () => ({ promises: { mkdir: vi.fn().mockResolvedValue(undefined), access: vi.fn().mockResolvedValue(undefined) }}));

// Mock GeneratedImage model to provide a tempImagePath
vi.mock('../../../src/database/models/GeneratedImage.js', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    close: vi.fn(),
    getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, executionId: 2, tempImagePath: '/tmp/generated/job_A_1.png', finalImagePath: null, processingSettings: JSON.stringify({}) } }),
    updateGeneratedImage: vi.fn().mockResolvedValue({ success: true }),
  }))
}));

// Mock other models
vi.mock('../../../src/database/models/JobConfiguration.js', () => ({ JobConfiguration: vi.fn().mockImplementation(() => ({ init: vi.fn(), close: vi.fn(), getDefaultSettings: vi.fn().mockReturnValue({ filePaths: { outputDirectory: '/fallback/toupload', tempDirectory: '/fallback/generated' }}) })) }));
vi.mock('../../../src/database/models/JobExecution.js', () => ({ JobExecution: vi.fn().mockImplementation(() => ({ init: vi.fn(), close: vi.fn(), updateJobExecution: vi.fn().mockResolvedValue({ success: true }) })) }));

import { BackendAdapter } from '../../../src/adapter/backendAdapter';
import { processImage } from '../../../src/producePictureModule';

describe('Retry normalization integration', () => {
  let adapter: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    adapter = new BackendAdapter({ ipc: { handle: vi.fn(), removeHandler: vi.fn() }, skipIpcSetup: true });
    // Stub retryExecutor and models to avoid sqlite3 and use pure JS
    adapter.retryExecutor = new (require('../../../src/services/retryExecutor'))({});
    adapter.retryExecutor.generatedImage = new (class { async getGeneratedImage() { return { success: true, image: { id: 1, executionId: 2, tempImagePath: '/tmp/generated/job_A_1.png', finalImagePath: null, processingSettings: JSON.stringify({}) }}} })();
    adapter.retryExecutor.updateImageStatus = vi.fn().mockResolvedValue({ success: true });
    adapter.retryExecutor.getQueueStatus = vi.fn().mockReturnValue({});
  });

  it('normalizes stringified processing values before calling processImage', async () => {
    // Queue a retry job with modified string values
    const imageIds = [1];
    const modified = {
      removeBg: '1',
      imageConvert: 'true',
      convertToJpg: 'true',
      jpgQuality: '105',
      pngQuality: '-5',
      imageEnhancement: 'true',
      sharpening: '9.6',
      saturation: '3.5',
      removeBgSize: 'FULL',
      jpgBackground: 123 as any,
    } as any;

    await adapter.retryExecutor.addBatchRetryJob({ imageIds, useOriginalSettings: false, modifiedSettings: modified, includeMetadata: false });
    // Let the queue process synchronously (processQueue is called inside)

    // Verify processImage received normalized values
    expect((processImage as any).mock.calls.length).toBeGreaterThan(0);
    const passedConfig = (processImage as any).mock.calls[0][2];
    expect(passedConfig.removeBg).toBe(true);
    expect(passedConfig.imageConvert).toBe(true);
    expect(passedConfig.convertToJpg).toBe(true);
    expect(passedConfig.jpgQuality).toBe(100);
    expect(passedConfig.pngQuality).toBe(100);
    expect(passedConfig.imageEnhancement).toBe(true);
    expect(passedConfig.sharpening).toBe(10);
    expect(passedConfig.saturation).toBe(3);
    expect(passedConfig.removeBgSize).toBe('full');
    expect(passedConfig.jpgBackground).toBe('#FFFFFF');
  });
});


