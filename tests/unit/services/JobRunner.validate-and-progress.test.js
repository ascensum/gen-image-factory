import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({}));

const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner - validation and progress', () => {
  let runner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new JobRunner();
  });

  const baseConfig = () => ({
    apiKeys: { openai: 'k', runware: 'r' },
    filePaths: { outputDirectory: '/tmp/out' },
    parameters: { processMode: 'single' },
  });

  it('validateConfiguration requires openai key', () => {
    const cfg = baseConfig();
    delete cfg.apiKeys.openai;
    const res = runner.validateConfiguration(cfg);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/OpenAI API key/i);
  });

  it('validateConfiguration requires runware key', () => {
    const cfg = baseConfig();
    delete cfg.apiKeys.runware;
    const res = runner.validateConfiguration(cfg);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Runware API key/i);
  });

  it('validateConfiguration requires output directory', () => {
    const cfg = baseConfig();
    delete cfg.filePaths.outputDirectory;
    const res = runner.validateConfiguration(cfg);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Output directory/i);
  });

  it('validateConfiguration requires process mode', () => {
    const cfg = baseConfig();
    delete cfg.parameters.processMode;
    const res = runner.validateConfiguration(cfg);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Process mode/i);
  });

  it('validateConfiguration passes with required fields', () => {
    const res = runner.validateConfiguration(baseConfig());
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('emitProgress updates job state and emits event', () => {
    const listener = vi.fn();
    runner.on('progress', listener);

    runner.emitProgress('initialization', 25, 'start');

    expect(runner.jobState.currentStep).toBe('initialization');
    expect(runner.jobState.progress).toBe(25);
    expect(listener).toHaveBeenCalledTimes(1);
    const payload = listener.mock.calls[0][0];
    expect(payload.message).toBe('start');
    expect(payload.step).toBe('initialization');
    expect(payload.progress).toBe(25);
  });
});
