import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock producePictureModule to control fail/succeed per attempt
vi.mock('../../../src/producePictureModule', () => {
  return {
    producePictureModule: vi.fn()
  };
});

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const producePictureModule = require('../../../src/producePictureModule');

describe('JobRunner - per-generation retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries failed generation up to attempts and emits retry logs', async () => {
    const runner = new JobRunner();
    // Stub parameter generation to avoid external calls
    vi.spyOn(runner, 'generateParameters').mockResolvedValue({ prompt: 'k1', promptContext: '', aspectRatios: ['1:1'] });
    const config = {
      apiKeys: { openai: 'x', runware: 'y' },
      filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' },
      parameters: {
        processMode: 'relax',
        aspectRatios: ['1:1'],
        count: 1,
        enablePollingTimeout: false,
        generationRetryAttempts: 1,
        generationRetryBackoffMs: 0
      },
      processing: {},
      ai: { runQualityCheck: false, runMetadataGen: false }
    };

    // Minimal parameters to pass through
    const parameters = { prompt: 'k1', promptContext: '', aspectRatios: ['1:1'] };

    // First attempt throws, second succeeds
    // Ensure the function is a vi.fn instance we control
    producePictureModule.producePictureModule = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([{ outputPath: '/tmp/a.png', settings: {} }]);

    const images = await runner._generateImagesPerGeneration(config, parameters, 1);

    // Called twice: 1 fail + 1 retry success
    expect(producePictureModule.producePictureModule).toHaveBeenCalledTimes(2);
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBe(1);

    // Logs contain retry and retry_success markers
    const logs = runner.getJobLogs('debug');
    const hasRetry = logs.some(l => l.subStep === 'generation_retry');
    const hasRetrySuccess = logs.some(l => l.subStep === 'generation_retry_success');
    expect(hasRetry).toBe(true);
    expect(hasRetrySuccess).toBe(true);
  });
});


