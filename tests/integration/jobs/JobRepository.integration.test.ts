/**
 * Job execution CRUD / repository integration tests (Story 3.5 Phase 4).
 * Decomposed from backend/BackendAdapter.integration.test.ts; focuses on execution persistence and query.
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
import { savedSettingsForRerun } from '../shared/test-fixtures';

const req = createRequire(import.meta.url);
const { patchCjsDeps, restoreCjsDeps } = buildCjsPatcher(req, resolveBackendAdapterPath(req));

describe('Job Repository Integration', () => {
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

  it('should save job execution and return id', async () => {
    const configResult = await backendAdapter.jobConfig.saveSettings(savedSettingsForRerun(), 'repo-test-config');
    const saveSpy = vi.spyOn(backendAdapter.jobExecution, 'saveJobExecution').mockResolvedValue({ success: true, id: 42 });

    const result = await backendAdapter.jobExecution.saveJobExecution({
      configurationId: configResult.id,
      label: 'Repo Test Job',
      status: 'completed',
    });

    expect(saveSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.id).toBe(42);
  });

  it('should get job execution by id', async () => {
    const execMock = defaultJobExecutionMock({ id: 10, configurationId: 5, status: 'completed' });
    vi.spyOn(backendAdapter.jobExecution, 'getJobExecution').mockResolvedValue(execMock);

    const result = await backendAdapter.jobExecution.getJobExecution(10);
    expect(result.success).toBe(true);
    expect(result.execution).toBeDefined();
    expect(result.execution.id).toBe(10);
    expect(result.execution.status).toBe('completed');
  });

  it('should get job executions by ids', async () => {
    const executions = [
      { id: 1, configurationId: 1, status: 'completed' },
      { id: 2, configurationId: 2, status: 'completed' },
    ];
    vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
      success: true,
      executions,
    });

    const result = await backendAdapter.jobExecution.getJobExecutionsByIds([1, 2]);
    expect(result.success).toBe(true);
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0].id).toBe(1);
    expect(result.executions[1].id).toBe(2);
  });
});
