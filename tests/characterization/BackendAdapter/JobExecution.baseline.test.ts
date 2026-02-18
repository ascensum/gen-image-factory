/**
 * CHARACTERIZATION TEST: BackendAdapter Job Execution Baseline
 *
 * Purpose: Capture CURRENT job start/stop/status behavior BEFORE extraction (ADR-011).
 * Baseline: startJob, stopJob, getJobStatus, saveJobExecution, getJobExecution.
 *
 * CRITICAL: Tests must pass against CURRENT BackendAdapter code (100% pass rate).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { patchCjsDeps, createAdapter, storedApiKeys } from './shared-setup.js';

describe('BackendAdapter Job Execution Characterization (Baseline)', () => {
  let BackendAdapter: any;
  let adapter: any;
  let teardown: { restore: () => void };

  beforeEach(async () => {
    Object.keys(storedApiKeys).forEach((k) => delete storedApiKeys[k]);
    vi.resetModules();
    teardown = patchCjsDeps();
    const mod = await import('../../../src/adapter/backendAdapter.js');
    BackendAdapter = mod.BackendAdapter;
    adapter = createAdapter(BackendAdapter);
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    teardown.restore();
    vi.clearAllMocks();
  });

  it('should start job with valid config and return success and jobId', async () => {
    const config = {
      apiKeys: { openai: 'k', runware: 'k' },
      filePaths: { outputDirectory: '/out', tempDirectory: '/tmp', logDirectory: '/logs' },
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
      processing: {},
      ai: {},
      advanced: {},
    };
    const result = await adapter.startJob(config);
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('jobId');
  });

  it('should prevent starting a second job when one is already running', async () => {
    adapter.jobRunner.isRunning = true;
    const config = {
      apiKeys: { openai: 'k', runware: 'k' },
      filePaths: { outputDirectory: '/out' },
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
      processing: {},
      ai: {},
      advanced: {},
    };
    const result = await adapter.startJob(config);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already running/i);
  });

  it('should stop job and return success', async () => {
    const result = await adapter.stopJob();
    expect(result.success).toBe(true);
    expect(adapter.jobRunner.stopJob).toHaveBeenCalled();
  });

  it('should return getJobStatus with status/state and progress', async () => {
    adapter.jobRunner.getJobStatus = vi.fn().mockResolvedValue({
      status: 'idle',
      state: 'idle',
      progress: 0,
      currentStep: null,
      totalSteps: 0,
    });
    const result = await adapter.getJobStatus();
    expect(result).toBeDefined();
    expect(result).toHaveProperty('progress');
    expect(result.hasOwnProperty('status') || result.hasOwnProperty('state')).toBe(true);
  });

  it('should save job execution via saveJobExecution', async () => {
    adapter.jobExecution.saveJobExecution = vi.fn().mockResolvedValue({ success: true, id: 1 });
    const execution = { configurationId: 1, status: 'running', totalImages: 10 };
    const result = await adapter.saveJobExecution(execution);
    expect(adapter.jobExecution.saveJobExecution).toHaveBeenCalledWith(execution);
    expect(result).toHaveProperty('success', true);
  });

  it('should return getJobExecution result from jobExecution model', async () => {
    const mockExecution = { id: 1, status: 'completed', totalImages: 5 };
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({
      success: true,
      execution: mockExecution,
    });
    const result = await adapter.getJobExecution(1);
    expect(result.success).toBe(true);
    expect(result.execution).toEqual(mockExecution);
  });
});
