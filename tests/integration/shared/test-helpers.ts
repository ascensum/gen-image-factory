/**
 * Common test utilities and assertion helpers for BackendAdapter integration tests (Story 3.5 Phase 4).
 * Each file < 400 lines (ADR-011).
 */

import { vi } from 'vitest';

/** Options for creating BackendAdapter in tests (mocked IPC, skip setup). */
export function createBackendAdapterOptions(): {
  ipc: { handle: ReturnType<typeof vi.fn>; removeHandler: ReturnType<typeof vi.fn> };
  skipIpcSetup: boolean;
} {
  return {
    ipc: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
    skipIpcSetup: true,
  };
}

/** Default job execution mock returned by getJobExecution. */
export function defaultJobExecutionMock(overrides: Partial<{ id: number; configurationId: number; status: string }> = {}) {
  return {
    success: true as const,
    execution: {
      id: 1,
      configurationId: 1,
      status: 'completed',
      totalImages: 4,
      successfulImages: 4,
      failedImages: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      ...overrides,
    },
  };
}

/** Default job config mock returned by getConfigurationById. */
export function defaultJobConfigMock(overrides: Partial<{ id: number; name: string }> = {}) {
  return {
    success: true as const,
    configuration: {
      id: 1,
      name: 'Test Config',
      settings: {
        apiKeys: { openai: 'test-key' },
        parameters: {
          runwareModel: 'runware:101@1',
          runwareFormat: 'png',
          variations: 1,
        },
      },
      ...overrides,
    },
  };
}

/** Assert result has success: true and optional message/field. */
export function expectSuccess<T extends { success: boolean; error?: string }>(result: T): asserts result is T & { success: true } {
  expect(result).toBeDefined();
  expect(result.success).toBe(true);
  if ('error' in result && result.error) {
    expect(result.error).toBe('');
  }
}

/** Assert result has success: false and error string. */
export function expectFailure(result: { success: boolean; error?: string }, errorSubstring?: string): void {
  expect(result).toBeDefined();
  expect(result.success).toBe(false);
  expect(typeof (result as { error?: string }).error).toBe('string');
  if (errorSubstring) {
    expect((result as { error: string }).error).toContain(errorSubstring);
  }
}
