/**
 * API key management integration tests (Story 3.5 Phase 4).
 * Decomposed from backend/BackendAdapter.integration.test.ts "API Key Management".
 * Uses shared test-setup, test-helpers. File < 400 lines (ADR-011).
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

describe('API Keys Integration', () => {
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

  it('should set and get API key', async () => {
    const serviceName = 'openai';
    const apiKey = 'test-api-key';

    const setResult = await backendAdapter.setApiKey(serviceName, apiKey);
    expect(setResult.success).toBe(true);

    const getResult = await backendAdapter.getApiKey(serviceName);
    expect(getResult.success).toBe(true);
    expect(getResult.apiKey).toBe(apiKey);
  });

  it('should handle unknown service', async () => {
    const result = await backendAdapter.getApiKey('unknown-service');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown service');
  });
});
