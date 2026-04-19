import { describe, it, expect, vi } from 'vitest';
import {
  resolveRunwareRetryOptions,
  isRunwareHttpRetryable,
  withRunwareRetries,
} from '../../../src/utils/runwareRetry.js';

describe('runwareRetry', () => {
  describe('resolveRunwareRetryOptions', () => {
    it('defaults to 1 attempt and 0 backoff', () => {
      expect(resolveRunwareRetryOptions({}, {})).toEqual({ maxAttempts: 1, backoffMs: 0 });
    });

    it('reads from config then settings.parameters', () => {
      expect(
        resolveRunwareRetryOptions(
          { parameters: { generationRetryAttempts: 2, generationRetryBackoffMs: 100 } },
          { generationRetryAttempts: 3, generationRetryBackoffMs: 200 },
        ),
      ).toEqual({ maxAttempts: 3, backoffMs: 200 });
    });

    it('clamps attempts to [1,5] and backoff to [0,60000]', () => {
      expect(resolveRunwareRetryOptions({}, { generationRetryAttempts: 0, generationRetryBackoffMs: -1 })).toEqual({
        maxAttempts: 1,
        backoffMs: 0,
      });
      expect(resolveRunwareRetryOptions({}, { generationRetryAttempts: 10, generationRetryBackoffMs: 999999 })).toEqual({
        maxAttempts: 5,
        backoffMs: 60000,
      });
    });
  });

  describe('isRunwareHttpRetryable', () => {
    it('retries network and 5xx/429', () => {
      expect(isRunwareHttpRetryable({ message: 'no response' })).toBe(true);
      expect(isRunwareHttpRetryable({ response: { status: 503 } })).toBe(true);
      expect(isRunwareHttpRetryable({ response: { status: 429 } })).toBe(true);
      expect(isRunwareHttpRetryable({ response: { status: 400 } })).toBe(false);
      expect(isRunwareHttpRetryable({ code: 'ECONNABORTED' })).toBe(true);
    });
  });

  describe('withRunwareRetries', () => {
    it('retries then succeeds when backoff is 0', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValueOnce('ok');

      const out = await withRunwareRetries({
        label: 't',
        fn,
        maxAttempts: 3,
        backoffMs: 0,
        logDebug: vi.fn(),
      });

      expect(out).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-retryable HTTP errors', async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 400 } });

      await expect(
        withRunwareRetries({ label: 't', fn, maxAttempts: 3, backoffMs: 0 }),
      ).rejects.toEqual(expect.objectContaining({ response: { status: 400 } }));

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
