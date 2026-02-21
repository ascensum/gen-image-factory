import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner QC finalize + QC verification helpers (more coverage)', () => {
  let prevCache = {};

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const patchCjs = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };

  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/jobRunner.js');
    remember(sutId);
    delete req.cache[sutId];
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};
  });

  afterEach(() => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('waitForQCToSettle resolves once transient states disappear (wrapped and array responses)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    const getGeneratedImagesByExecution = vi
      .fn()
      .mockResolvedValueOnce({ success: true, images: [{ id: 1, qcStatus: 'processing' }] })
      .mockResolvedValueOnce([{ id: 1, qcStatus: 'retry_pending' }])
      .mockResolvedValueOnce({ success: true, images: [{ id: 1, qcStatus: 'approved' }] });

    runner.backendAdapter = { getGeneratedImagesByExecution };

    const p = runner.waitForQCToSettle(123, 5_000, 50);
    await vi.advanceTimersByTimeAsync(60);
    await vi.advanceTimersByTimeAsync(60);

    await expect(p).resolves.toBe(true);
    expect(getGeneratedImagesByExecution).toHaveBeenCalled();
  });

  it('waitForQCToSettle times out if transient states persist', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    runner.backendAdapter = {
      getGeneratedImagesByExecution: vi.fn(async () => ({ success: true, images: [{ id: 1, qcStatus: 'processing' }] })),
    };

    const p = runner.waitForQCToSettle(123, 120, 25);
    // Attach rejection handler before advancing timers to avoid unhandled-rejection noise.
    const expectation = expect(p).rejects.toThrow(/QC finalize timeout reached/i);
    await vi.advanceTimersByTimeAsync(200);
    await expectation;
  });

  it('_verifyQCStatus forces update by ID when DB status mismatches expected', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    const updateQCStatus = vi.fn(async () => ({ success: true }));
    const getGeneratedImage = vi.fn(async () => ({
      success: true,
      image: { id: 77, qcStatus: 'qc_failed', qcReason: 'bad' },
    }));

    runner.backendAdapter = {
      getGeneratedImage,
      updateQCStatus,
    };

    await expect(runner._verifyQCStatus({ id: 77, imageMappingId: 'map-77' }, 'approved', 'fixed')).resolves.toBeUndefined();

    expect(getGeneratedImage).toHaveBeenCalledWith(77);
    expect(updateQCStatus).toHaveBeenCalledWith(77, 'approved', 'fixed');
  });

  it('_verifyQCStatus does not update when status already matches', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    const updateQCStatus = vi.fn(async () => ({ success: true }));
    const getGeneratedImage = vi.fn(async () => ({
      success: true,
      image: { id: 88, qcStatus: 'approved', qcReason: 'ok' },
    }));

    runner.backendAdapter = {
      getGeneratedImage,
      updateQCStatus,
    };

    await runner._verifyQCStatus({ id: 88, imageMappingId: 'map-88' }, 'approved', 'ok');

    expect(updateQCStatus).not.toHaveBeenCalled();
  });
});
