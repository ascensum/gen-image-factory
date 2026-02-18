/**
 * CHARACTERIZATION TEST: BackendAdapter Export Baseline
 *
 * Purpose: Capture CURRENT Excel/ZIP export behavior BEFORE extraction (ADR-011).
 * Baseline: exportJobToExcel, createZipExport (or equivalent export entry points).
 *
 * CRITICAL: Tests must pass against CURRENT BackendAdapter code (100% pass rate).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { patchCjsDeps, createAdapter, storedApiKeys } from './shared-setup.js';

describe('BackendAdapter Export Characterization (Baseline)', () => {
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

  it('should have exportJobToExcel method', () => {
    expect(typeof adapter.exportJobToExcel).toBe('function');
  });

  it('should return export result shape from exportJobToExcel', async () => {
    adapter.jobExecution.getJobExecution = vi.fn().mockResolvedValue({
      success: true,
      execution: { id: 1, configurationId: 1, status: 'completed' },
    });
    adapter.generatedImage.getGeneratedImagesByExecution = vi.fn().mockResolvedValue({
      success: true,
      images: [],
    });
    adapter.jobConfig.getConfigurationById = vi.fn().mockResolvedValue({
      success: true,
      configuration: { settings: {} },
    });
    const result = await adapter.exportJobToExcel(1, {});
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should have createZipExport method', () => {
    expect(typeof adapter.createZipExport).toBe('function');
  });

  it('should return result from createZipExport for empty image list', async () => {
    const result = await adapter.createZipExport([], false, {});
    expect(result).toBeDefined();
  });
});
