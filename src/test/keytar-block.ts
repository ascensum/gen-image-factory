/**
 * Keytar OS-keychain blocker — runs via Vitest setupFiles (inside each worker).
 *
 * Problem: backendAdapter.js does `keytar = require('keytar')` at module scope (CJS).
 * With fileParallelism:false all test files run sequentially in the same worker.
 * Each test file's CJS patcher saves prevCache[keytarId] = <real native binary>,
 * then restores it in afterEach — putting the real keytar back in require.cache.
 * The next test file re-requires backendAdapter.js, which picks up the real keytar
 * and writes e.g. 'test-openai-key' to the real macOS Keychain.
 *
 * Fix: Use a SHARED MUTABLE PROXY object as the keytar export — permanently injected
 * into the CJS require cache. Tests that need custom keytar behavior replace the
 * methods on this shared object (or use vi.spyOn on it). The native binary is never
 * loaded. The proxy object itself never leaves the cache.
 *
 * The Module._load override ensures that even if a test deletes the cache entry,
 * the next require('keytar') gets the proxy back — not the native binary.
 */

import { vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('node:module');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRequire } = require('node:module');

const req = createRequire(import.meta.url) as NodeRequire & { cache: Record<string, unknown> };

/**
 * Shared mutable proxy using vi.fn() — THIS is what all tests get when they
 * require('keytar'). Tests can call .mockRejectedValue(), .mockResolvedValue(),
 * vi.spyOn(), etc. freely because each method is a vi.fn().
 * Default behaviour: safe no-ops (null / undefined / true).
 */
export const keytarProxy = {
  getPassword: vi.fn().mockResolvedValue(null),
  setPassword: vi.fn().mockResolvedValue(undefined),
  deletePassword: vi.fn().mockResolvedValue(true),
};

let keytarResolvedPath: string | undefined;
try {
  keytarResolvedPath = req.resolve('keytar');
} catch {
  // keytar not installed — nothing to block
}

if (keytarResolvedPath) {
  const cacheEntry = {
    id: keytarResolvedPath,
    filename: keytarResolvedPath,
    loaded: true,
    exports: keytarProxy,
  };

  // Inject the proxy into the CJS require cache.
  req.cache[keytarResolvedPath] = cacheEntry;

  // Intercept Module._load so that even if a test deletes the cache entry,
  // require('keytar') never loads the real native binary from disk.
  // If a test has installed its own mock into the cache, honour that mock.
  const originalLoad: (...args: unknown[]) => unknown = Module._load;
  Module._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'keytar' || request === keytarResolvedPath) {
      // If a test has put its own mock in the cache, use that.
      const cached = req.cache[keytarResolvedPath!] as { exports: unknown } | undefined;
      if (cached) return cached.exports;
      // Cache was cleared (test's restoreCjsDeps deleted it) — re-inject proxy
      // so we never fall through to originalLoad which would load the real binary.
      req.cache[keytarResolvedPath!] = cacheEntry;
      return keytarProxy;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}
