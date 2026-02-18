/**
 * BackendAdapter bridge integration tests (Story 3.5 Phase 4).
 * Classification: legacy — adapter entry points only; no feature flags.
 * Verifies adapter entry points, IPC skip path, and key method availability.
 * Uses shared test-setup. File < 400 lines (ADR-011).
 */

import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearStoredApiKeys,
  buildCjsPatcher,
  resolveBackendAdapterPath,
} from '../shared/test-setup';
import { createBackendAdapterOptions, defaultJobExecutionMock, defaultJobConfigMock } from '../shared/test-helpers';

const req = createRequire(import.meta.url);
const { patchCjsDeps, restoreCjsDeps } = buildCjsPatcher(req, resolveBackendAdapterPath(req));

describe('BackendAdapter Bridge Integration', () => {
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

  it('constructs with skipIpcSetup and mocked IPC', () => {
    expect(backendAdapter).toBeDefined();
    expect(backendAdapter.jobConfig).toBeDefined();
    expect(backendAdapter.jobExecution).toBeDefined();
    expect(backendAdapter.generatedImage).toBeDefined();
    expect(backendAdapter.jobRunner).toBeDefined();
  });

  it('exposes startJob, stopJob, forceStopAll, getJobStatus', () => {
    expect(typeof backendAdapter.startJob).toBe('function');
    expect(typeof backendAdapter.stopJob).toBe('function');
    expect(typeof backendAdapter.forceStopAll).toBe('function');
    expect(typeof backendAdapter.getJobStatus).toBe('function');
  });

  it('exposes getSettings, saveSettings, setApiKey, getApiKey', () => {
    expect(typeof backendAdapter.getSettings).toBe('function');
    expect(typeof backendAdapter.saveSettings).toBe('function');
    expect(typeof backendAdapter.setApiKey).toBe('function');
    expect(typeof backendAdapter.getApiKey).toBe('function');
  });

  it('exposes bulkRerunJobExecutions and export methods', () => {
    expect(typeof backendAdapter.bulkRerunJobExecutions).toBe('function');
    expect(typeof backendAdapter.exportJobToExcel).toBe('function');
    expect(typeof backendAdapter.createZipExport).toBe('function');
  });

  it('getSettings returns success with mocked config', async () => {
    const result = await backendAdapter.getSettings();
    expect(result.success).toBe(true);
    expect(result.settings).toBeDefined();
  });
});
