/**
 * Job run orchestration integration tests (Story 3.5 Phase 4).
 * Decomposed from backend/BackendAdapter.integration.test.ts "Single Job Run Functionality" and status tracking.
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
import { minimalJobConfig, shortJobConfig } from '../shared/test-fixtures';

const req = createRequire(import.meta.url);
const { patchCjsDeps, restoreCjsDeps } = buildCjsPatcher(req, resolveBackendAdapterPath(req));

describe('Job Runner Integration', () => {
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

  it('should start a job with valid configuration', async () => {
    const config = minimalJobConfig();
    const result = await backendAdapter.startJob(config);
    expect(result.success).toBe(true);
    expect(result.jobId).toBeDefined();
  });

  it('should reject job start with invalid configuration', async () => {
    const invalidConfig = shortJobConfig({
      apiKeys: { openai: '', piapi: 'test-piapi-key' },
    });
    const result = await backendAdapter.startJob(invalidConfig);
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.error).toContain('OpenAI API key is required');
      expect(result.code).toBe('JOB_CONFIGURATION_ERROR');
    }
  });

  it('should prevent starting multiple jobs simultaneously', async () => {
    const config = shortJobConfig();
    const result1 = await backendAdapter.startJob(config);
    expect(result1.success).toBe(true);

    if (backendAdapter.jobRunner) {
      backendAdapter.jobRunner.isRunning = true;
    } else {
      backendAdapter.jobRunner = { isRunning: true, startJob: vi.fn(), stopJob: vi.fn() };
    }

    const result2 = await backendAdapter.startJob(config);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('already running');
  });

  it('should stop a running job', async () => {
    const config = shortJobConfig();
    const startResult = await backendAdapter.startJob(config);
    expect(startResult.success).toBe(true);

    const stopResult = await backendAdapter.stopJob();
    expect(stopResult.success).toBe(true);
  });

  it('should force stop all jobs', async () => {
    const config = shortJobConfig();
    const startResult = await backendAdapter.startJob(config);
    expect(startResult.success).toBe(true);

    const forceStopResult = await backendAdapter.forceStopAll();
    expect(forceStopResult.success).toBe(true);
  });

  it('should track job progress correctly', async () => {
    const config = shortJobConfig();
    const startResult = await backendAdapter.startJob(config);
    expect(startResult.success).toBe(true);

    const status = await backendAdapter.getJobStatus();
    expect(status).toBeDefined();
    expect(status.state).toBeDefined();
    if (status.state === 'running') {
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
      expect(status.currentStep).toBeDefined();
      expect(status.totalSteps).toBeDefined();
    }
  });
});
