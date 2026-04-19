/**
 * Runware HTTP retry helpers (ADR-003: pure functions, no globals).
 * Aligns with ImageRemoverService.retryRemoveBackground retryability rules.
 */

const RETRY_ATTEMPTS_MIN = 1;
const RETRY_ATTEMPTS_MAX = 5;
const RETRY_BACKOFF_MS_MAX = 60_000;

/**
 * @param {Object} [settings]
 * @param {Object} [settings.parameters]
 * @param {Object} [config] - module config from JobEngine (takes precedence)
 * @returns {{ maxAttempts: number, backoffMs: number }}
 */
function resolveRunwareRetryOptions(settings, config = {}) {
  const p = settings?.parameters || {};
  const rawAttempts = Number(config.generationRetryAttempts ?? p.generationRetryAttempts ?? 1);
  const rawBackoff = Number(config.generationRetryBackoffMs ?? p.generationRetryBackoffMs ?? 0);
  const maxAttempts = Math.max(
    RETRY_ATTEMPTS_MIN,
    Math.min(RETRY_ATTEMPTS_MAX, Number.isFinite(rawAttempts) ? rawAttempts : 1)
  );
  const backoffMs = Math.max(
    0,
    Math.min(RETRY_BACKOFF_MS_MAX, Number.isFinite(rawBackoff) ? rawBackoff : 0)
  );
  return { maxAttempts, backoffMs };
}

/**
 * @param {unknown} error - axios-style error
 * @returns {boolean}
 */
function isRunwareHttpRetryable(error) {
  if (error == null || typeof error !== 'object') return true;
  const status = error.response?.status;
  if (!error.response) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  const code = error.code;
  if (
    code === 'ECONNABORTED'
    || code === 'ETIMEDOUT'
    || code === 'ECONNRESET'
    || code === 'ENOTFOUND'
    || code === 'EAI_AGAIN'
    || code === 'ECONNREFUSED'
  ) {
    return true;
  }
  return false;
}

/**
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function sleepAbortable(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
  }
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    function cleanup() {
      clearTimeout(id);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
    function onAbort() {
      cleanup();
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {Object} opts
 * @param {string} opts.label - log / pipeline label
 * @param {() => Promise<T>} opts.fn
 * @param {number} opts.maxAttempts
 * @param {number} opts.backoffMs
 * @param {AbortSignal} [opts.abortSignal]
 * @param {Function} [opts.logDebug]
 * @param {Function} [opts.onRetry] - (attempt, maxAttempts, error) => void
 * @returns {Promise<T>}
 * @template T
 */
async function withRunwareRetries(opts) {
  const {
    label,
    fn,
    maxAttempts,
    backoffMs,
    abortSignal,
    logDebug,
    onRetry
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retry = isRunwareHttpRetryable(err) && attempt < maxAttempts;
      if (!retry) throw err;
      try {
        onRetry?.(attempt, maxAttempts, err);
        logDebug?.(`Runware ${label}: attempt ${attempt}/${maxAttempts} failed, waiting ${backoffMs}ms`, err?.message || err);
      } catch (_) { /* ignore */ }
      await sleepAbortable(backoffMs, abortSignal);
    }
  }
  throw lastErr;
}

module.exports = {
  resolveRunwareRetryOptions,
  isRunwareHttpRetryable,
  sleepAbortable,
  withRunwareRetries,
  RETRY_ATTEMPTS_MAX,
  RETRY_BACKOFF_MS_MAX,
};
