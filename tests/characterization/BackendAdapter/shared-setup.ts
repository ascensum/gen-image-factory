/**
 * Shared setup for BackendAdapter characterization tests.
 * Patches CJS require cache so BackendAdapter and its dependencies load with mocks.
 */

import { vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

export const storedApiKeys: Record<string, string> = {};

export function patchCjsDeps() {
  const prevCache: Record<string, unknown> = {};
  const remember = (id: string) => {
    if (!(id in prevCache)) prevCache[id] = (req as any).cache[id];
  };
  const set = (id: string, exports: any) => {
    remember(id);
    (req as any).cache[id] = { id, filename: id, loaded: true, exports };
  };

  try {
    set(req.resolve('keytar'), {
      getPassword: vi.fn((_s: string, account: string) =>
        Promise.resolve(storedApiKeys[account] ?? null)
      ),
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
    // keytar may not resolve in test env
  }

  const defaultSettings = {
    apiKeys: { openai: '', runware: '', piapi: '', removeBg: '' },
    filePaths: { outputDirectory: './out', tempDirectory: './tmp', logDirectory: './logs' },
    parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1, pollingTimeout: 15, enablePollingTimeout: true },
    processing: { removeBg: false, imageConvert: false, imageEnhancement: false, convertToJpg: false, trimTransparentBackground: false, jpgBackground: 'white', jpgQuality: 100, pngQuality: 100, removeBgSize: 'auto' },
    ai: { runQualityCheck: true, runMetadataGen: true },
    advanced: { debugMode: false, autoSave: true },
  };

  set(req.resolve('../../../src/database/models/JobConfiguration.js'), {
    JobConfiguration: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: {} }),
      getSettings: vi.fn().mockResolvedValue({ success: true, settings: null }),
      saveSettings: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      getDefaultSettings: vi.fn().mockReturnValue(defaultSettings),
    })),
  });

  set(req.resolve('../../../src/database/models/JobExecution.js'), {
    JobExecution: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: {} }),
      saveJobExecution: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      getJobExecutions: vi.fn().mockResolvedValue({ success: true, executions: [] }),
    })),
  });

  set(req.resolve('../../../src/database/models/GeneratedImage.js'), {
    GeneratedImage: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: {} }),
      getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] }),
      saveGeneratedImage: vi.fn().mockResolvedValue({ success: true, id: 1 }),
      updateQCStatus: vi.fn().mockResolvedValue(undefined),
    })),
  });

  set(req.resolve('../../../src/services/jobRunner.js'), {
    JobRunner: vi.fn().mockImplementation(() => ({
      startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-1', message: 'Job started' }),
      stopJob: vi.fn().mockResolvedValue({ success: true }),
      forceStopAll: vi.fn().mockResolvedValue({ success: true }),
      getJobStatus: vi.fn().mockResolvedValue({ status: 'idle', progress: 0 }),
      getJobProgress: vi.fn().mockResolvedValue({ progress: 0, currentStep: 0, totalSteps: 0 }),
      on: vi.fn(),
      emit: vi.fn(),
    })),
  });

  set(req.resolve('../../../src/services/retryExecutor.js'), vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    addBatchRetryJob: vi.fn().mockResolvedValue({ success: true }),
    stop: vi.fn(),
  })));

  set(req.resolve('../../../src/services/errorTranslation.js'), {
    ErrorTranslationService: vi.fn().mockImplementation(() => ({ translateError: vi.fn().mockReturnValue('Error') })),
  });

  set(req.resolve('../../../src/services/SecurityService.js'), {
    SecurityService: vi.fn().mockImplementation(() => ({
      getSecret: vi.fn().mockResolvedValue(null),
      setSecret: vi.fn().mockResolvedValue(undefined),
    })),
  });

  set(req.resolve('../../../src/services/ExportService.js'), vi.fn().mockImplementation(() => ({})));
  set(req.resolve('../../../src/services/SingleRerunService.js'), {
    SingleRerunService: vi.fn().mockImplementation(() => ({})),
  });
  set(req.resolve('../../../src/services/BulkRerunService.js'), {
    BulkRerunService: vi.fn().mockImplementation(() => ({})),
  });

  set(req.resolve('../../../src/utils/logMasking.js'), {
    safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  });

  set(req.resolve('../../../src/utils/shadowBridgeLogger.js'), {
    logModularPath: vi.fn(),
    logLegacyPath: vi.fn(),
    logLegacyFallback: vi.fn(),
  });

  set(req.resolve('electron'), {
    ipcMain: undefined,
    app: { getPath: vi.fn(() => '/tmp') },
  });

  const sutId = req.resolve('../../../src/adapter/backendAdapter.js');
  remember(sutId);
  delete (req as any).cache[sutId];

  return { restore: () => restore(prevCache) };
}

function restore(prevCache: Record<string, unknown>) {
  for (const [id, entry] of Object.entries(prevCache)) {
    if (entry != null) (req as any).cache[id] = entry;
    else delete (req as any).cache[id];
  }
}

export function createAdapter(BackendAdapterClass: any) {
  return new BackendAdapterClass({
    ipc: { handle: vi.fn(), removeHandler: vi.fn() },
    skipIpcSetup: true,
  });
}
