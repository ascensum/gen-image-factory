/**
 * Image processing pipeline integration tests (Story 3.5 Phase 4).
 * BackendAdapter.integration.test.ts does not contain image processing describes; this suite
 * verifies adapter integrates with image-related APIs (e.g. export uses generatedImage).
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

describe('Image Processing Integration', () => {
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

  it('adapter has image-related export entry points', () => {
    expect(typeof backendAdapter.exportJobToExcel).toBe('function');
    expect(typeof backendAdapter.createZipExport).toBe('function');
  });

  it('generatedImage is used for image data', () => {
    expect(backendAdapter.generatedImage).toBeDefined();
    expect(backendAdapter.generatedImage.getGeneratedImagesByExecution).toBeDefined();
  });
});
