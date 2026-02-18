/**
 * Shared setup for BackendAdapter integration tests (Story 3.5 Phase 4).
 * Mocks keytar, fs, DB models, JobRunner, ErrorTranslationService.
 * Provides CJS cache patch/restore for require() inside backendAdapter.js.
 * Each file < 400 lines (ADR-011).
 */

import path from 'path';
import { vi } from 'vitest';

// In-memory store for keytar mocks to persist API keys across calls (shared across tests that import this)
export const storedApiKeys: Record<string, string> = {};

export function clearStoredApiKeys(): void {
  Object.keys(storedApiKeys).forEach((key) => delete storedApiKeys[key]);
}

// Mock keytar for ESM and for CommonJS require() - implementations use storedApiKeys
vi.mock('keytar', () => ({
  getPassword: vi.fn((_service: string, account: string) => {
    const key = storedApiKeys[account] ?? null;
    return Promise.resolve(key);
  }),
  setPassword: vi.fn((_service: string, account: string, password: string) => {
    storedApiKeys[account] = password;
    return Promise.resolve(undefined);
  }),
  deletePassword: vi.fn((_service: string, account: string) => {
    delete storedApiKeys[account];
    return Promise.resolve(true);
  }),
}));

vi.mock('fs', () => ({
  promises: {
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('test content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
    saveSettings: vi.fn().mockResolvedValue({ success: true, id: 1 }),
  })),
}));

vi.mock('../../../src/database/models/JobExecution', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: {} }),
    saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    getJobExecutions: vi.fn().mockResolvedValue({ success: true, executions: [] }),
  })),
}));

vi.mock('../../../src/database/models/GeneratedImage', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: {} }),
    saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
  })),
}));

vi.mock('../../../src/services/jobRunner', () => ({
  JobRunner: vi.fn().mockImplementation(() => ({
    startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-1', message: 'Job started successfully' }),
    stopJob: vi.fn().mockResolvedValue({ success: true }),
    forceStop: vi.fn().mockResolvedValue({ success: true }),
    forceStopAll: vi.fn().mockResolvedValue({ success: true }),
    getJobStatus: vi.fn().mockResolvedValue({
      status: 'idle',
      state: 'idle',
      progress: 0,
      currentStep: null,
      totalSteps: 0,
    }),
    getJobProgress: vi.fn().mockResolvedValue({
      progress: 0,
      currentStep: 0,
      totalSteps: 0,
      stepName: '',
      estimatedTimeRemaining: null,
    }),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('../../../src/services/errorTranslation', () => ({
  ErrorTranslationService: vi.fn().mockImplementation(() => ({
    translateError: vi.fn().mockReturnValue('Translated error message'),
  })),
}));

/** Create an isolated DB path for tests that use real SQLite (optional; most suites use mocks). */
export function createIsolatedDbPath(): string {
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return path.join(__dirname, '../../.test-dbs', `test-${testId}.db`);
}

type RequireLike = NodeRequire & { cache: Record<string, { exports: unknown } | undefined> };

/**
 * Resolve backendAdapter.js path for the given req (from createRequire(import.meta.url) in test file).
 */
export function resolveBackendAdapterPath(req: RequireLike): string {
  return req.resolve('../../../src/adapter/backendAdapter.js');
}

/**
 * Build CJS patch/restore so require() inside backendAdapter.js sees mocks.
 * Call patchCjsDeps() in beforeEach and restoreCjsDeps() in afterEach.
 * req must be createRequire(import.meta.url) from the test file.
 * backendAdapterPath should be resolveBackendAdapterPath(req) so cache key matches.
 */
export function buildCjsPatcher(req: RequireLike, backendAdapterPath: string): {
  patchCjsDeps: () => void;
  restoreCjsDeps: () => void;
} {
  let prevCache: Record<string, unknown> = {};

  const patchCjsDeps = (): void => {
    prevCache = {};
    const remember = (id: string) => {
      if (!(id in prevCache)) prevCache[id] = (req as unknown as { cache: Record<string, unknown> }).cache[id];
    };
    const set = (id: string, exports: unknown) => {
      remember(id);
      (req as unknown as { cache: Record<string, unknown> }).cache[id] = {
        id,
        filename: id,
        loaded: true,
        exports,
      } as unknown as { exports: unknown };
    };

    try {
      const keytarId = req.resolve('keytar');
      set(keytarId, {
        getPassword: vi.fn((_s: string, account: string) => Promise.resolve(storedApiKeys[account] ?? null)),
        setPassword: vi.fn((_s: string, account: string, password: string) => {
          storedApiKeys[account] = password;
          return Promise.resolve(undefined);
        }),
        deletePassword: vi.fn((_s: string, account: string) => {
          delete storedApiKeys[account];
          return Promise.resolve(true);
        }),
      });
    } catch {
      // keytar may not be resolvable in some environments
    }

    const base = path.resolve(__dirname, '../../../src');
    set(path.join(base, 'database/models/JobConfiguration.js'), {
      JobConfiguration: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getJobConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
        getConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
        saveSettings: vi.fn().mockResolvedValue({ success: true, id: 1 }),
        updateConfiguration: vi.fn().mockResolvedValue({ success: true }),
        getSettings: vi.fn().mockResolvedValue({ success: true, settings: null }),
        getDefaultSettings: vi.fn().mockReturnValue({
          apiKeys: { openai: '', runware: '', piapi: '', removeBg: '' },
          filePaths: { outputDirectory: './out', tempDirectory: './tmp', logDirectory: './logs' },
          parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1, pollingTimeout: 15, enablePollingTimeout: true },
          processing: { removeBg: false, imageConvert: false, imageEnhancement: false, convertToJpg: false, trimTransparentBackground: false, jpgBackground: 'white', jpgQuality: 100, pngQuality: 100, removeBgSize: 'auto' },
          ai: { runQualityCheck: true, runMetadataGen: true },
          advanced: { debugMode: false, autoSave: true },
        }),
      })),
    });
    set(path.join(base, 'database/models/JobExecution.js'), {
      JobExecution: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: {} }),
        saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 1 }),
        updateJobExecution: vi.fn().mockResolvedValue({ success: true }),
        getJobExecutions: vi.fn().mockResolvedValue({ success: true, executions: [] }),
        getJobExecutionsByIds: vi.fn().mockResolvedValue({ success: true, executions: [] }),
      })),
    });
    set(path.join(base, 'database/models/GeneratedImage.js'), {
      GeneratedImage: vi.fn().mockImplementation(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: {} }),
        getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }),
        saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      })),
    });
    set(path.join(base, 'services/jobRunner.js'), {
      JobRunner: vi.fn().mockImplementation(() => ({
        startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-1', message: 'Job started successfully' }),
        stopJob: vi.fn().mockResolvedValue({ success: true }),
        forceStopAll: vi.fn().mockResolvedValue({ success: true }),
        getJobStatus: vi.fn().mockResolvedValue({ status: 'idle', state: 'idle', progress: 0, currentStep: null, totalSteps: 0 }),
        getJobProgress: vi.fn().mockResolvedValue({ progress: 0, currentStep: 0, totalSteps: 0, stepName: '', estimatedTimeRemaining: null }),
        on: vi.fn(),
        emit: vi.fn(),
      })),
    });

    remember(backendAdapterPath);
    delete (req as unknown as { cache: Record<string, unknown> }).cache[backendAdapterPath];
  };

  const restoreCjsDeps = (): void => {
    const cache = (req as unknown as { cache: Record<string, unknown> }).cache;
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry != null) cache[id] = entry as typeof cache[string];
      else delete cache[id];
    }
    prevCache = {};
  };

  return { patchCjsDeps, restoreCjsDeps };
}
