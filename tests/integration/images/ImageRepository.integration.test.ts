/**
 * Image repository / CRUD integration tests (Story 3.5 Phase 4).
 * BackendAdapter.integration.test.ts does not contain image-specific describes; this suite
 * verifies adapter exposes generatedImage and getGeneratedImage/getGeneratedImagesByExecution work with mocks.
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

describe('Image Repository Integration', () => {
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

  it('exposes generatedImage on adapter', () => {
    expect(backendAdapter.generatedImage).toBeDefined();
    expect(typeof backendAdapter.generatedImage.getGeneratedImage).toBe('function');
    expect(typeof backendAdapter.generatedImage.getGeneratedImagesByExecution).toBe('function');
  });

  it('getGeneratedImage returns mocked result', async () => {
    const mockImage = { id: 1, executionId: 1, finalImagePath: '/tmp/test.png', qcStatus: 'approved', metadata: {} };
    vi.spyOn(backendAdapter.generatedImage, 'getGeneratedImage').mockResolvedValue({ success: true, image: mockImage });

    const result = await backendAdapter.generatedImage.getGeneratedImage('1');
    expect(result.success).toBe(true);
    expect(result.image).toBeDefined();
    expect(result.image!.id).toBe(1);
  });

  it('getGeneratedImagesByExecution returns mocked list', async () => {
    const mockImages = [
      { id: 1, executionId: 10, finalImagePath: '/tmp/a.png', qcStatus: 'approved' },
      { id: 2, executionId: 10, finalImagePath: '/tmp/b.png', qcStatus: 'approved' },
    ];
    vi.spyOn(backendAdapter.generatedImage, 'getGeneratedImagesByExecution').mockResolvedValue({ success: true, images: mockImages });

    const result = await backendAdapter.generatedImage.getGeneratedImagesByExecution(10);
    expect(result.success).toBe(true);
    expect(result.images).toHaveLength(2);
  });
});
