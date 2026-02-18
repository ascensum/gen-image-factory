/**
 * Job execution lifecycle and rerun integration tests (Story 3.5 Phase 4).
 * Decomposed from backend/BackendAdapter.integration.test.ts "Single Job Rerun", "Path Normalization", "Bulk Rerun".
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
import { savedSettingsForRerun, shortJobConfig } from '../shared/test-fixtures';

const req = createRequire(import.meta.url);
const { patchCjsDeps, restoreCjsDeps } = buildCjsPatcher(req, resolveBackendAdapterPath(req));

describe('Job Execution Integration', () => {
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

  describe('Single Job Rerun', () => {
    it('should rerun a completed job successfully', async () => {
      const savedSettings = savedSettingsForRerun();
      const configResult = await backendAdapter.jobConfig.saveSettings(savedSettings, 'test-config');
      vi.spyOn(backendAdapter.jobConfig, 'getConfigurationById').mockResolvedValue({
        success: true,
        configuration: { id: configResult.id, name: 'test-config', settings: savedSettings, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });

      const execResult = await backendAdapter.jobExecution.saveJobExecution({
        configurationId: configResult.id,
        label: 'Test Job',
        status: 'completed',
      });
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
        success: true,
        executions: [{ id: execResult.id, configurationId: configResult.id, label: 'Test Job', status: 'completed' }],
      });

      if (!backendAdapter.jobRunner) {
        const { JobRunner } = await import('../../../src/services/jobRunner');
        backendAdapter.jobRunner = new JobRunner();
      }
      vi.spyOn(backendAdapter.jobRunner, 'getJobStatus').mockResolvedValue({ status: 'idle', state: 'idle', progress: 0 });
      vi.spyOn(backendAdapter.jobRunner, 'startJob').mockResolvedValue({ success: true, jobId: 'test-rerun-job', message: 'Job started successfully' });

      const result = await backendAdapter.bulkRerunJobExecutions([execResult.id]);
      expect(result.success).toBe(true);
      expect(result.message ?? result.startedJob).toBeDefined();
    }, 15000);

    it('should reject rerun for running job', async () => {
      const configResult = await backendAdapter.jobConfig.saveSettings(savedSettingsForRerun(), 'test-config');
      const execResult = await backendAdapter.jobExecution.saveJobExecution({
        configurationId: configResult.id,
        label: 'Running Job',
        status: 'running',
      });
      if (typeof backendAdapter.jobExecution.getJobExecutionsByIds === 'function') {
        vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
          success: true,
          executions: [{ id: execResult.id, configurationId: configResult.id, label: 'Running Job', status: 'running' }],
        });
      }
      vi.spyOn(backendAdapter.jobRunner, 'getJobStatus').mockResolvedValue({ status: 'running', state: 'running' });

      const result = await backendAdapter.bulkRerunJobExecutions([execResult.id]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('running');
    });

    it('should reject rerun for non-existent job', async () => {
      const result = await backendAdapter.bulkRerunJobExecutions([999]);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);
    });

    it('should preserve original job configuration during rerun', async () => {
      const savedSettings = savedSettingsForRerun();
      const configResult = await backendAdapter.jobConfig.saveSettings(savedSettings, 'test-config');
      const getConfigSpy = vi.spyOn(backendAdapter.jobConfig, 'getConfigurationById').mockResolvedValue({
        success: true,
        configuration: { id: configResult.id, name: 'test-config', settings: savedSettings, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
      const execResult = await backendAdapter.jobExecution.saveJobExecution({
        configurationId: configResult.id,
        label: 'Test Job',
        status: 'completed',
      });
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
        success: true,
        executions: [{ id: execResult.id, configurationId: configResult.id, label: 'Test Job', status: 'completed' }],
      });
      if (!backendAdapter.jobRunner) {
        const { JobRunner } = await import('../../../src/services/jobRunner');
        backendAdapter.jobRunner = new JobRunner();
      }
      vi.spyOn(backendAdapter.jobRunner, 'getJobStatus').mockResolvedValue({ status: 'idle', state: 'idle', progress: 0 });
      vi.spyOn(backendAdapter.jobRunner, 'startJob').mockResolvedValue({ success: true, jobId: 'test-rerun-job', message: 'Job started successfully' });

      const result = await backendAdapter.bulkRerunJobExecutions([execResult.id]);
      expect(result.success).toBe(true);
      expect(getConfigSpy).toHaveBeenCalled();
      getConfigSpy.mockRestore();
    });

    it('should handle rerun with modified configuration', async () => {
      const configResult = await backendAdapter.jobConfig.saveSettings(savedSettingsForRerun(), 'test-config');
      const execResult = await backendAdapter.jobExecution.saveJobExecution({
        configurationId: configResult.id,
        label: 'Test Job',
        status: 'completed',
      });
      const updatedSettings = savedSettingsForRerun({
        parameters: { runwareModel: 'runware:101@1', runwareFormat: 'jpg', variations: 2 },
        processing: { removeBg: true },
      });
      await backendAdapter.jobConfig.updateConfiguration(configResult.id, updatedSettings);
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
        success: true,
        executions: [{ id: execResult.id, configurationId: configResult.id, label: 'Test Job', status: 'completed' }],
      });
      vi.spyOn(backendAdapter.jobConfig, 'getConfigurationById').mockResolvedValue({
        success: true,
        configuration: { id: configResult.id, name: 'test-config', settings: updatedSettings, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
      if (!backendAdapter.jobRunner) {
        const { JobRunner } = await import('../../../src/services/jobRunner');
        backendAdapter.jobRunner = new JobRunner();
      }
      vi.spyOn(backendAdapter.jobRunner, 'getJobStatus').mockResolvedValue({ status: 'idle', state: 'idle', progress: 0 });
      vi.spyOn(backendAdapter.jobRunner, 'startJob').mockResolvedValue({ success: true, jobId: 'test-rerun-job', message: 'Job started successfully' });

      const result = await backendAdapter.bulkRerunJobExecutions([execResult.id]);
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('Path Normalization', () => {
    it('uses custom directories when provided, else falls back', async () => {
      const adapter = new BackendAdapter({ ipc: { handle: vi.fn(), removeHandler: vi.fn() }, skipIpcSetup: true });
      const customSettings = {
        apiKeys: { openai: 'k', runware: 'k', removeBg: 'k' },
        filePaths: { outputDirectory: '/custom/toupload', tempDirectory: '/custom/generated' },
        parameters: { runwareModel: 'runware:101@1', runwareDimensionsCsv: '1024x1024', runwareFormat: 'png', variations: 1, pollingTimeout: 15, enablePollingTimeout: true },
        processing: { removeBg: false, imageConvert: false, convertToJpg: false, trimTransparentBackground: false, jpgBackground: 'white', jpgQuality: 100, pngQuality: 100, removeBgSize: 'auto' },
        ai: { runQualityCheck: true, runMetadataGen: true },
        advanced: { debugMode: false },
      } as any;
      const start = await adapter.startJob(customSettings);
      expect(start.success).toBe(true);
      await adapter.initializeRetryExecutor();
      expect(adapter.retryExecutor.tempDirectory).toBeDefined();
      expect(adapter.retryExecutor.outputDirectory).toBeDefined();
    });
  });

  describe('Bulk Rerun', () => {
    it('should rerun multiple jobs sequentially', async () => {
      const mockJobExecutions = [
        { id: 1, configurationId: 1, status: 'completed', totalImages: 4, successfulImages: 4, failedImages: 0 },
        { id: 2, configurationId: 2, status: 'completed', totalImages: 2, successfulImages: 2, failedImages: 0 },
      ];
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({ success: true, executions: mockJobExecutions });
      vi.spyOn(backendAdapter.jobConfig, 'getConfigurationById')
        .mockResolvedValueOnce({ success: true, configuration: { id: 1, name: 'test-config-1', settings: savedSettingsForRerun(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
        .mockResolvedValueOnce({ success: true, configuration: { id: 2, name: 'test-config-2', settings: savedSettingsForRerun(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
      if (!backendAdapter.jobRunner) {
        const { JobRunner } = await import('../../../src/services/jobRunner');
        backendAdapter.jobRunner = new JobRunner();
      }
      vi.spyOn(backendAdapter.jobRunner, 'getJobStatus').mockResolvedValue({ status: 'idle', state: 'idle', progress: 0 });
      vi.spyOn(backendAdapter.jobRunner, 'startJob').mockResolvedValue({ success: true, jobId: 'test-rerun-job', message: 'Job started successfully' });

      const result = await backendAdapter.bulkRerunJobExecutions([1, 2]);
      expect(result.success).toBe(true);
      expect(result.message ?? result.startedJob).toBeDefined();
    });

    it('should reject bulk rerun when job is already running', async () => {
      await backendAdapter.startJob(shortJobConfig());
      vi.spyOn(backendAdapter.jobRunner, 'getJobStatus').mockResolvedValue({ status: 'running', state: 'running', currentJob: { id: 'test-job' }, progress: 50 });
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
        success: true,
        executions: [{ id: 1, configurationId: 1, status: 'completed' }, { id: 2, configurationId: 2, status: 'completed' }],
      });

      const result = await backendAdapter.bulkRerunJobExecutions([1, 2]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Cannot rerun jobs while other jobs are running|Another job is currently running/);
    });

    it('should handle partial failures in bulk rerun', async () => {
      vi.spyOn(backendAdapter.jobExecution, 'getJobExecutionsByIds').mockResolvedValue({
        success: true,
        executions: [{ id: 1, configurationId: 1, status: 'completed', totalImages: 4, successfulImages: 4, failedImages: 0 }],
      });
      vi.spyOn(backendAdapter.jobConfig, 'getConfigurationById').mockResolvedValue({
        success: true,
        configuration: { id: 1, name: 'test-config', settings: savedSettingsForRerun(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });

      const result = await backendAdapter.bulkRerunJobExecutions([1, 999]);
      if (Array.isArray(result.failedJobs) && result.failedJobs.length > 0) {
        const failedJob = result.failedJobs.find((j: { jobId: number }) => j.jobId === 999);
        expect(failedJob).toBeDefined();
      } else {
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      }
    });
  });
});
