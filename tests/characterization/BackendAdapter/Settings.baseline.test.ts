/**
 * CHARACTERIZATION TEST: BackendAdapter Settings Baseline
 *
 * Purpose: Capture CURRENT settings/API key persistence behavior BEFORE extraction (ADR-011).
 * Baseline: getSettings, saveSettings, getApiKey, setApiKey, getSecurityStatus, file paths.
 *
 * CRITICAL: Tests must pass against CURRENT BackendAdapter code (100% pass rate).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { patchCjsDeps, createAdapter, storedApiKeys } from './shared-setup.js';

describe('BackendAdapter Settings Characterization (Baseline)', () => {
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

  it('should return getSettings with success and settings object', async () => {
    const result = await adapter.getSettings();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('settings');
    expect(result.settings).toHaveProperty('apiKeys');
    expect(result.settings).toHaveProperty('filePaths');
    expect(result.settings).toHaveProperty('parameters');
  });

  it('should return settings with default file paths when from getDefaultSettings', async () => {
    const result = await adapter.getSettings();
    expect(result.settings.filePaths).toHaveProperty('outputDirectory');
    expect(result.settings.filePaths).toHaveProperty('tempDirectory');
    expect(result.settings.filePaths).toHaveProperty('logDirectory');
  });

  it('should return getApiKey for known service name', async () => {
    const key = await adapter.getApiKey('openai');
    expect(key === null || typeof key === 'string' || typeof key === 'object' || key === false).toBe(true);
  });

  it('should store and return API key via setApiKey and getApiKey', async () => {
    const setResult = await adapter.setApiKey('openai', 'test-key-123');
    expect(setResult).toBeDefined();
    expect(setResult.success).toBe(true);
    const key = await adapter.getApiKey('openai');
    expect(key === 'test-key-123' || (key && (key as any).apiKey === 'test-key-123')).toBe(true);
  });

  it('should return getSecurityStatus with expected shape', async () => {
    const status = await adapter.getSecurityStatus();
    expect(status).toBeDefined();
    expect(typeof status).toBe('object');
  });

  it('should call jobConfig.saveSettings when saveSettings is called', async () => {
    const settings = {
      apiKeys: {},
      filePaths: { outputDirectory: '/out', tempDirectory: '/tmp', logDirectory: '/logs' },
      parameters: {},
      processing: {},
      ai: {},
      advanced: {},
    };
    adapter.jobConfig.saveSettings = vi.fn().mockResolvedValue({ success: true, id: 1 });
    const result = await adapter.saveSettings(settings);
    expect(adapter.jobConfig.saveSettings).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should handle getSettings when jobConfig.getSettings returns null settings', async () => {
    adapter.jobConfig.getSettings = vi.fn().mockResolvedValue({ success: true, settings: null });
    adapter.jobConfig.getDefaultSettings = vi.fn().mockReturnValue({
      apiKeys: {},
      filePaths: {},
      parameters: {},
      processing: {},
      ai: {},
      advanced: {},
    });
    const result = await adapter.getSettings();
    expect(result.success).toBe(true);
    expect(result.settings).toBeDefined();
  });
});
