import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({
  runQualityCheck: vi.fn(),
  generateMetadata: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const aiVision = require('../../../src/aiVision');

describe('JobRunner - withTimeout and quality checks', () => {
  let runner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new JobRunner();
    runner.backendAdapter = { updateQCStatusByMappingId: vi.fn().mockResolvedValue({ success: true }) };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('withTimeout returns original promise when timeoutMs <= 0', async () => {
    const p = Promise.resolve('ok');
    await expect(runner.withTimeout(p, 0)).resolves.toBe('ok');
  });

  it('withTimeout resolves when promise resolves before timeout', async () => {
    vi.useFakeTimers();
    const p = new Promise((resolve) => setTimeout(() => resolve('done'), 10));
    const wrapped = runner.withTimeout(p, 50, 'nope');
    vi.advanceTimersByTime(11);
    await expect(wrapped).resolves.toBe('done');
  });

  it('withTimeout rejects when timeout elapses', async () => {
    vi.useFakeTimers();
    const p = new Promise(() => {}); // never resolves
    const wrapped = runner.withTimeout(p, 10, 'timed out');
    vi.advanceTimersByTime(11);
    await expect(wrapped).rejects.toThrow(/timed out/i);
  });

  it('runQualityChecks updates QC status and local image objects', async () => {
    // In some module-load configurations this import isn't auto-mocked into vi.fn().
    aiVision.runQualityCheck = vi.fn()
      .mockResolvedValueOnce({ passed: true, reason: 'ok' })
      .mockResolvedValueOnce({ passed: false, reason: 'bad' });

    const images = [
      { id: 1, mappingId: 'm1', tempImagePath: '/tmp/a.png', metadata: { prompt: 'P1' } },
      { id: 2, image_mapping_id: 'm2', final_image_path: '/tmp/b.png', metadata: { prompt: 'P2' } },
    ];

    await runner.runQualityChecks(images, {
      parameters: { openaiModel: 'gpt-4o-mini', enablePollingTimeout: false, pollingTimeout: 1 },
      ai: { qualityCheckPrompt: 'qc' },
    });

    expect(runner.backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m1', 'approved', 'ok');
    expect(runner.backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m2', 'qc_failed', 'bad');
    expect(images[0].qcStatus).toBe('approved');
    expect(images[1].qcStatus).toBe('qc_failed');
  });

  it('runQualityChecks marks image as qc_failed when qcInputPath is missing (does not abort batch)', async () => {
    aiVision.runQualityCheck = vi.fn().mockResolvedValueOnce({ passed: true, reason: 'ok' });
    const images = [{ id: 1, mappingId: 'm1' }];
    // Should NOT throw; instead marks image as qc_failed and continues
    await runner.runQualityChecks(images, { parameters: { enablePollingTimeout: false }, ai: {} });
    expect(images[0].qcStatus).toBe('qc_failed');
    expect(images[0].qcReason).toBe('QC input path is missing');
    // runQualityCheck should NOT have been called (skipped due to missing path)
    expect(aiVision.runQualityCheck).not.toHaveBeenCalled();
  });
});

