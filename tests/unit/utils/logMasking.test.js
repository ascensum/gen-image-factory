import { describe, it, expect, vi, beforeEach } from 'vitest';

const { maskSensitiveData, safeLogger } = require('../../../src/utils/logMasking');

describe('maskSensitiveData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('masks OpenAI-style keys', () => {
    const masked = maskSensitiveData('token sk-12345678901234567890abcdef');
    expect(masked).toContain('sk-...cdef');
    expect(masked.includes('1234567890abcdef')).toBe(false);
  });

  it('masks Anthropic-style keys', () => {
    const masked = maskSensitiveData('key sk-ant-12345678901234567890-anth');
    expect(masked).toContain('sk-ant-...anth');
    expect(masked.includes('1234567890')).toBe(false);
  });

  it('masks Google-style keys', () => {
    const masked = maskSensitiveData('AIza123456789012345678901234567890abcd');
    expect(masked).toContain('AIza...abcd');
    expect(masked).not.toContain('123456789012345678901234567890');
  });

  it('masks apiKey fields in JSON strings', () => {
    const masked = maskSensitiveData('{"apiKey":"abcdef1234567890ZYXW"}');
    expect(masked).toContain('"apiKey":"abc...ZYXW"');
    expect(masked).not.toContain('abcdef1234567890ZYXW');
  });

  it('returns non-string inputs unchanged', () => {
    const original = { ok: true };
    expect(maskSensitiveData(original)).toBe(original);
  });
});

describe('safeLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs masked values through console.log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockReturnValue();
    safeLogger.log('value sk-12345678901234567890abcd');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0];
    expect(String(logged)).toContain('sk-...abcd');
    expect(String(logged)).not.toContain('12345678901234567890');
  });

  it('logs masked values through console.error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
    safeLogger.error('AIza123456789012345678901234567890abcd');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0];
    expect(String(logged)).toContain('AIza...abcd');
  });
});
