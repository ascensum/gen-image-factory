import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('JobRunner core helpers (vite import) coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

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
  });

  const loadJobRunner = async () => {
    const mod: any = await import('../../../src/services/jobRunner.js');
    return mod.JobRunner;
  };

  it('withTimeout rejects after timeout', async () => {
    const JobRunner = await loadJobRunner();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    vi.useFakeTimers();
    const never = new Promise(() => {});
    const p = runner.withTimeout(never, 10, 't');

    const expectation = expect(p).rejects.toThrow('t');
    await vi.advanceTimersByTimeAsync(10);
    await expectation;
  });

  it('_buildModuleConfig respects runQualityCheck by disabling processing flags', async () => {
    const JobRunner = await loadJobRunner();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    const cfg: any = {
      ai: { runQualityCheck: true },
      processing: { removeBg: true, imageConvert: true, convertToJpg: true, convertToWebp: true, trimTransparentBackground: true },
      parameters: { enablePollingTimeout: true, pollingTimeout: 5, pollingInterval: 2, processMode: 'relax', aspectRatios: '16:9' },
      filePaths: { tempDirectory: '/tmp/gen' },
    };

    const res = runner._buildModuleConfig(cfg, { prompt: 'P', aspectRatios: ['1:1', '2:3'] });

    expect(res.runQualityCheck).toBe(true);
    expect(res.removeBg).toBe(false);
    expect(res.imageConvert).toBe(false);
    expect(res.convertToJpg).toBe(false);
    expect(res.convertToWebp).toBe(false);
    expect(res.trimTransparentBackground).toBe(false);
    expect(res.outputDirectory).toBe('/tmp/gen');
  });

  it('_buildImageObject maps settings fields and aspect ratio selection', async () => {
    const JobRunner = await loadJobRunner();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    const item: any = {
      outputPath: '/tmp/a.png',
      mappingId: 'map-1',
      softFailures: [{ stage: 'convert', vendor: 'x', message: 'oops' }],
      settings: {
        title: { title: 'T', description: 'D' },
        uploadTags: ['t1'],
      },
    };

    const out = runner._buildImageObject(item, { prompt: 'P', aspectRatios: ['1:1', '2:3'] }, 1, 0, 2);

    expect(out).toEqual(expect.objectContaining({ path: '/tmp/a.png', mappingId: 'map-1', status: 'generated' }));
    expect(out.metadata).toEqual(expect.objectContaining({ prompt: 'P', title: 'T', description: 'D', uploadTags: ['t1'], failure: expect.any(Object) }));
    expect(out.aspectRatio).toBe('2:3');
  });

  it('_logStructured stores logs and emits log events', async () => {
    const JobRunner = await loadJobRunner();
    const runner: any = new JobRunner({ parameters: { count: 1 } });

    const logs: any[] = [];
    runner.on('log', (e: any) => logs.push(e));

    runner._logStructured({ level: 'debug', stepName: 'initialization', subStep: 'x', message: 'm1' });
    runner._logStructured({ level: 'info', stepName: 'initialization', subStep: 'x', message: 'm2' });
    runner._logStructured({ level: 'warn', stepName: 'initialization', subStep: 'x', message: 'm3' });
    runner._logStructured({ level: 'error', stepName: 'initialization', subStep: 'x', message: 'm4' });

    expect(logs.length).toBe(4);
    expect(runner._inMemoryLogs.length).toBeGreaterThanOrEqual(4);
  });
});
