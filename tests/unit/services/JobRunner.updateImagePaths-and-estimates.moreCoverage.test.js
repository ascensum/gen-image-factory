import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner misc helpers (updateImagePaths + ETA) (more coverage)', () => {
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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

  it('updateImagePaths returns false when backendAdapter is missing', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    runner.backendAdapter = null;
    await expect(runner.updateImagePaths('m1', '/tmp/t.png', '/tmp/f.png')).resolves.toBe(false);
  });

  it('updateImagePaths returns true on successful DB update', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    const updateImagePathsByMappingId = vi.fn(async () => ({ success: true }));
    runner.backendAdapter = { updateImagePathsByMappingId };

    await expect(runner.updateImagePaths('m2', null, '/tmp/f.png')).resolves.toBe(true);
    expect(updateImagePathsByMappingId).toHaveBeenCalledWith('m2', null, '/tmp/f.png');
  });

  it('updateImagePaths returns false when DB update throws', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    runner.backendAdapter = {
      updateImagePathsByMappingId: vi.fn(async () => { throw new Error('db down'); }),
    };

    await expect(runner.updateImagePaths('m3', '/tmp/t.png', '/tmp/f.png')).resolves.toBe(false);
  });

  it('calculateEstimatedTimeRemaining returns null when not running or no progress', () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    runner.jobState.status = 'idle';
    runner.jobState.startTime = new Date();
    runner.jobState.progress = 50;
    expect(runner.calculateEstimatedTimeRemaining()).toBe(null);

    runner.jobState.status = 'running';
    runner.jobState.startTime = null;
    runner.jobState.progress = 50;
    expect(runner.calculateEstimatedTimeRemaining()).toBe(null);

    runner.jobState.status = 'running';
    runner.jobState.startTime = new Date('2025-01-01T00:00:00.000Z');
    runner.jobState.progress = 0;
    expect(runner.calculateEstimatedTimeRemaining()).toBe(null);
  });

  it('calculateEstimatedTimeRemaining estimates remaining time based on elapsed/progress', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:10.000Z'));

    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();

    runner.jobState.status = 'running';
    runner.jobState.startTime = new Date('2025-01-01T00:00:00.000Z');
    runner.jobState.progress = 50; // 50% done after 10s -> total 20s, remaining 10s

    const remaining = runner.calculateEstimatedTimeRemaining();
    expect(remaining).not.toBe(null);
    expect(Math.round(remaining)).toBe(10);
  });
});
