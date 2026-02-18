/**
 * Settings persistence integration tests (Story 3.5 Phase 4).
 * Classification: legacy — same monolithic BackendAdapter; decomposed by feature.
 * Decomposed from backend/BackendAdapter.integration.test.ts "Settings Management".
 * Uses shared test-setup, test-helpers, test-fixtures. File < 400 lines (ADR-011).
 */

import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearStoredApiKeys,
  buildCjsPatcher,
  resolveBackendAdapterPath,
} from '../shared/test-setup';
import { createBackendAdapterOptions, defaultJobExecutionMock, defaultJobConfigMock } from '../shared/test-helpers';
import { fullSettingsFixture } from '../shared/test-fixtures';

const req = createRequire(import.meta.url);
const { patchCjsDeps, restoreCjsDeps } = buildCjsPatcher(req, resolveBackendAdapterPath(req));

describe('Settings Adapter Integration', () => {
  let BackendAdapter: any;
  let backendAdapter: any;

  beforeEach(async () => {
    clearStoredApiKeys();
    vi.resetModules();
    patchCjsDeps();
    const mod = await import('../../../src/adapter/backendAdapter');
    BackendAdapter = mod.BackendAdapter;
    backendAdapter = new BackendAdapter(createBackendAdapterOptions());

    vi.spyOn(backendAdapter.jobExecution, 'getJobExecution').mockResolvedValue(defaultJobExecutionMock());
    vi.spyOn(backendAdapter.jobExecution, 'saveJobExecution').mockResolvedValue({ success: true, id: 2 });
    vi.spyOn(backendAdapter.jobConfig, 'getConfigurationById').mockResolvedValue(defaultJobConfigMock());
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreCjsDeps();
  });

  it('should get settings', async () => {
    const result = await backendAdapter.getSettings();
    expect(result.success).toBe(true);
    expect(result.settings).toBeDefined();
  });

  it('should save settings', async () => {
    const settings = fullSettingsFixture();
    const result = await backendAdapter.saveSettings(settings);
    expect(result.success).toBe(true);
  });
});
