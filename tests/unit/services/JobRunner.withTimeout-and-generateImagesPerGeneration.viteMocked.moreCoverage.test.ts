import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

const originalCache = new Map<string, any>();
const rememberCache = (id: string) => {
  if (!originalCache.has(id)) originalCache.set(id, (req as any).cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) (req as any).cache[id] = entry;
    else delete (req as any).cache[id];
  }
  originalCache.clear();
};

const mockProducePictureModule = vi.fn();

const installCjsMocks = () => {
  // jobRunner.js is CJS and requires these modules at load time
  const produceId = req.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  (req as any).cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: { producePictureModule: mockProducePictureModule } };

  const paramsId = req.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  (req as any).cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: { paramsGeneratorModule: vi.fn() } };

  const aiId = req.resolve('../../../src/aiVision.js');
  rememberCache(aiId);
  (req as any).cache[aiId] = { id: aiId, filename: aiId, loaded: true, exports: { runQualityCheck: vi.fn(), generateMetadata: vi.fn() } };

  const sutId = req.resolve('../../../src/services/jobRunner.js');
  rememberCache(sutId);
  delete (req as any).cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = req('../../../src/services/jobRunner.js');
  return mod.JobRunner;
};

describe('JobRunner withTimeout + _generateImagesPerGeneration (CJS-mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProducePictureModule.mockReset();

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    restoreCache();
  });

  it('withTimeout returns original promise when timeout is invalid/<=0', async () => {
    const JobRunner = loadSut();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    await expect(runner.withTimeout(Promise.resolve('ok'), 0)).resolves.toBe('ok');
    await expect(runner.withTimeout(Promise.resolve('ok2'), -1)).resolves.toBe('ok2');
  });

  it('withTimeout rejects after timeout', async () => {
    const JobRunner = loadSut();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    vi.useFakeTimers();
    const never = new Promise(() => {});

    const p = runner.withTimeout(never, 50, 'boom');
    const expectation = expect(p).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });

  it('_generateImagesPerGeneration returns processed images for array results', async () => {
    const JobRunner = loadSut();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    vi.spyOn(runner, 'generateParameters').mockResolvedValue({ prompt: 'P', promptContext: '', aspectRatios: ['1:1'] });

    mockProducePictureModule.mockResolvedValueOnce([
      { outputPath: '/tmp/a.png', mappingId: 'm1', settings: { title: { title: 't', description: 'd' }, uploadTags: ['x'] } },
      { outputPath: '/tmp/b.png', mappingId: 'm2', settings: {} },
    ]);

    const config: any = {
      apiKeys: { runware: 'x' },
      ai: { runQualityCheck: false },
      filePaths: { tempDirectory: '/tmp' },
      processing: {},
      parameters: { variations: 2, generationRetryAttempts: 0 },
    };

    const res = await runner._generateImagesPerGeneration(config, { prompt: 'P' }, 1);

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(2);
    expect(runner.jobState.generatedImages).toBeGreaterThanOrEqual(2);
    expect(mockProducePictureModule).toHaveBeenCalled();
  });

  it('_generateImagesPerGeneration counts failures when parameter generation fails and no images generated', async () => {
    const JobRunner = loadSut();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    vi.spyOn(runner, 'generateParameters').mockRejectedValueOnce(new Error('param down'));

    const config: any = {
      apiKeys: { runware: 'x' },
      ai: { runQualityCheck: false },
      filePaths: { tempDirectory: '/tmp' },
      processing: {},
      parameters: { variations: 1 },
    };

    await expect(runner._generateImagesPerGeneration(config, { prompt: 'P' }, 1)).rejects.toThrow(/Failed to generate images/);
    expect(runner.jobState.failedImages).toBeGreaterThanOrEqual(1);
  });
});
