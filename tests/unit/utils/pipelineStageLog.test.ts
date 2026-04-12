import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { emitPipelineStage } = require('../../../src/utils/pipelineStageLog');

describe('pipelineStageLog', () => {
  let origEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    origEnv = { ...process.env };
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = origEnv;
    vi.restoreAllMocks();
  });

  it('invokes pipelineStageLog callback when present', () => {
    const fn = vi.fn();
    emitPipelineStage({ pipelineStageLog: fn }, 'test_step', 'hello', { k: 1 });
    expect(fn).toHaveBeenCalledWith('test_step', 'hello', { k: 1 });
  });

  it('does not print console when VITEST is set', () => {
    process.env.VITEST = 'true';
    delete process.env.PIPELINE_STAGE_LOG;
    emitPipelineStage(null, 'x', 'y', {});
    expect(console.info).not.toHaveBeenCalled();
  });

  it('prints console when PIPELINE_STAGE_LOG=true', () => {
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';
    process.env.PIPELINE_STAGE_LOG = 'true';
    emitPipelineStage(null, 'runware_api_begin', 'msg', { host: 'h' });
    expect(console.info).toHaveBeenCalled();
    const printed = String(console.info.mock.calls[0][1]);
    expect(printed).toContain('runware_api_begin');
  });
});
