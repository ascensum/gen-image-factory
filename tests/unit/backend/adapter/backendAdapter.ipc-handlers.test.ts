import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

describe('BackendAdapter.setupIpcHandlers (unit, isolated)', () => {
  const handlers = new Map<string, Function>();
  const req = createRequire(import.meta.url);

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    vi.resetModules();
    vi.unmock('keytar');
    vi.unmock('electron');
    vi.unmock('../../../../src/database/models/JobConfiguration');
    vi.unmock('../../../../src/database/models/JobExecution');
    vi.unmock('../../../../src/database/models/GeneratedImage');
    vi.unmock('../../../../src/services/jobRunner');
    vi.unmock('../../../../src/services/retryExecutor');
  });

  it('registers core IPC handlers and routes calls to adapter methods', async () => {
    vi.doMock('keytar', () => ({
      getPassword: vi.fn().mockResolvedValue(null),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deletePassword: vi.fn().mockResolvedValue(true),
    }));

    vi.doMock('electron', () => ({
      ipcMain: undefined,
      app: { getPath: vi.fn(() => '/tmp') },
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
        showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
      },
      shell: {
        openPath: vi.fn().mockResolvedValue(''),
        showItemInFolder: vi.fn(),
      },
    }));

    // Avoid sqlite initialization: BackendAdapter is CJS and uses require() at module scope,
    // so patch Node's require cache for these CJS model modules.
    const resolvedJC = req.resolve('../../../../src/database/models/JobConfiguration');
    const resolvedJE = req.resolve('../../../../src/database/models/JobExecution');
    const resolvedGI = req.resolve('../../../../src/database/models/GeneratedImage');
    const prevJC = req.cache[resolvedJC];
    const prevJE = req.cache[resolvedJE];
    const prevGI = req.cache[resolvedGI];

    req.cache[resolvedJC] = {
      id: resolvedJC, filename: resolvedJC, loaded: true,
      exports: {
        JobConfiguration: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          getSettings: vi.fn().mockResolvedValue({ success: true, settings: {} }),
          saveSettings: vi.fn().mockResolvedValue({ success: true, id: 1 }),
          getConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: { id: 1, settings: {} } }),
          getDefaultSettings: vi.fn().mockReturnValue({ filePaths: { outputDirectory: '/tmp', tempDirectory: '/tmp' } }),
        })),
      },
    } as any;

    req.cache[resolvedJE] = {
      id: resolvedJE, filename: resolvedJE, loaded: true,
      exports: {
        JobExecution: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 1 } }),
          getJobExecutionsByIds: vi.fn().mockResolvedValue({ success: true, executions: [{ id: 1, status: 'completed', configurationId: 1 }] }),
        })),
      },
    } as any;

    req.cache[resolvedGI] = {
      id: resolvedGI, filename: resolvedGI, loaded: true,
      exports: {
        GeneratedImage: vi.fn().mockImplementation(() => ({
          init: vi.fn().mockResolvedValue(undefined),
          createTables: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          getGeneratedImage: vi.fn().mockResolvedValue({ success: false }),
        })),
      },
    } as any;

    vi.doMock('../../../../src/services/jobRunner', () => ({
      JobRunner: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        getJobStatus: vi.fn().mockResolvedValue({ status: 'idle', state: 'idle' }),
        startJob: vi.fn().mockResolvedValue({ success: true, jobId: 'job-1' }),
        stopJob: vi.fn().mockResolvedValue(undefined),
        forceStopAll: vi.fn().mockResolvedValue(undefined),
      })),
    }));

    vi.doMock('../../../../src/services/retryExecutor', () => ({
      default: vi.fn().mockImplementation(() => ({
        addBatchRetryJob: vi.fn().mockResolvedValue({ success: true, queuedJobs: 1 }),
        getQueueStatus: vi.fn().mockReturnValue({ isProcessing: false, queueLength: 0 }),
      })),
    }));

    const ipc = {
      removeHandler: vi.fn(),
      handle: vi.fn((channel: string, fn: Function) => handlers.set(channel, fn)),
    };

    const mod = await import('../../../../src/adapter/backendAdapter');
    const adapter = new mod.BackendAdapter({ ipc });

    expect(ipc.handle).toHaveBeenCalled();
    expect(handlers.has('get-api-key')).toBe(true);
    expect(handlers.has('job-configuration:get-by-image-id')).toBe(true);
    expect(handlers.has('job-execution:get-by-image-id')).toBe(true);

    const getApiKeySpy = vi.spyOn(adapter, 'getApiKey').mockResolvedValue({ success: true, apiKey: 'x' } as any);
    const res = await handlers.get('get-api-key')?.({}, 'openai');
    expect(getApiKeySpy).toHaveBeenCalledWith('openai');
    expect(res).toEqual({ success: true, apiKey: 'x' });

    vi.spyOn(adapter, 'ensureInitialized').mockRejectedValueOnce(new Error('db down'));
    const cfgRes = await handlers.get('job-configuration:get-by-image-id')?.({}, 123);
    expect(cfgRes.success).toBe(false);
    expect(String(cfgRes.error)).toContain('db down');

    adapter.generatedImage.getGeneratedImage = vi.fn().mockResolvedValueOnce({ success: false }) as any;
    const execRes = await handlers.get('job-execution:get-by-image-id')?.({}, 999);
    expect(execRes).toEqual({ success: false, error: 'Image not found' });

    // Restore require cache to avoid leaking to other test files
    if (prevJC) req.cache[resolvedJC] = prevJC; else delete req.cache[resolvedJC];
    if (prevJE) req.cache[resolvedJE] = prevJE; else delete req.cache[resolvedJE];
    if (prevGI) req.cache[resolvedGI] = prevGI; else delete req.cache[resolvedGI];
  });
});

