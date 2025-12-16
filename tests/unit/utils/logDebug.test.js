import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { logDebug } = require('../../../src/utils/logDebug');

describe('logDebug', () => {
  const originalEnv = process.env.DEBUG_MODE;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete global.currentJobRunner;
    process.env.DEBUG_MODE = 'false';
  });

  afterEach(() => {
    process.env.DEBUG_MODE = originalEnv;
    delete global.currentJobRunner;
    vi.clearAllMocks();
  });

  it('emits structured log when debug mode is enabled and a job runner is present', () => {
    const structuredSpy = vi.fn();
    global.currentJobRunner = { _logStructured: structuredSpy };
    process.env.DEBUG_MODE = 'true';

    logDebug('test', 'payload');

    expect(structuredSpy).toHaveBeenCalledTimes(1);
    const payload = structuredSpy.mock.calls[0][0];
    expect(payload.level).toBe('debug');
    expect(payload.message).toBe('test payload');
    expect(payload.metadata.args).toEqual(['test', 'payload']);
  });

  it('falls back to console.log when debug is enabled without a job runner', () => {
    process.env.DEBUG_MODE = 'true';
    const consoleSpy = vi.spyOn(console, 'log').mockReturnValue();

    logDebug('hello-world');

    expect(consoleSpy).toHaveBeenCalledWith('hello-world');
  });

  it('does nothing when debug mode is disabled', () => {
    process.env.DEBUG_MODE = 'false';
    const consoleSpy = vi.spyOn(console, 'log').mockReturnValue();

    logDebug('should-not-log');

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
