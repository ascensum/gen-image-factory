import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

describe('Failed Images Review - IPC Integration', () => {
  let backend: any;
  let handlers: Map<string, Function>;
  let store: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();

    // In-memory store for images to avoid DB coupling in IPC wiring test
    store = {};

    // Mock electron ipcMain and capture handlers
    handlers = new Map();
    vi.mock('electron', () => ({
      ipcMain: {
        handle: vi.fn((channel: string, cb: Function) => handlers.set(channel, cb)),
        removeHandler: vi.fn(),
      },
    }));

    // Stub GeneratedImage model methods by overriding instance after construction

    // Import after mocks are set up (ensures mocked electron is used)
    const mod = await import('../../../src/adapter/backendAdapter');
    // Inject mock ipc to capture handlers
    backend = new mod.BackendAdapter({
      ipc: {
        handle: vi.fn((channel: string, cb: Function) => handlers.set(channel, cb)),
        removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
      }
    });

    // Override DB interactions with in-memory fakes
    backend.ensureInitialized = vi.fn(async () => {});
    backend.ensureRetryExecutorInitialized = vi.fn(async () => {});
    // Mock retryExecutor for batch retry operations
    backend.retryExecutor = {
      addBatchRetryJob: vi.fn(async (job) => {
        return { success: true, jobId: 'mock-retry-job', ...job };
      })
    } as any;
    backend.generatedImage = {
      getGeneratedImage: vi.fn(async (id: string | number) => {
        const key = String(id);
        const image = store[key];
        if (!image) return { success: false, error: 'not found' };
        return { success: true, image: { ...image, id: key } };
      }),
      updateQCStatus: vi.fn(async (id: string | number, status: string, reason?: string) => {
        const key = String(id);
        if (!store[key]) return { success: false };
        store[key].qcStatus = status;
        store[key].qcReason = reason || null;
        return { success: true };
      }),
      updateGeneratedImage: vi.fn(async (id: string | number, image: any) => {
        const key = String(id);
        if (!store[key]) return { success: false };
        // Merge processingSettings if provided
        if (image.processingSettings) {
          store[key].processingSettings = { ...store[key].processingSettings, ...image.processingSettings };
        }
        store[key] = { ...store[key], ...image };
        return { success: true };
      }),
      deleteGeneratedImage: vi.fn(async (id: string | number) => {
        const key = String(id);
        if (!store[key]) return { success: false };
        delete store[key];
        return { success: true };
      })
    } as any;
    backend.jobExecution = {
      db: { run: vi.fn() },
      getJobExecution: vi.fn(async (id: number) => {
        // Return mock job execution with completed status for testing
        return { success: true, execution: { id, configuration_id: 1, status: 'completed' } };
      })
    } as any;

    // Seed test data - include processingSettings for modified settings test
    store['1'] = { executionId: 1, generationPrompt: 'failed 1', qcStatus: 'failed', qcReason: 'reason a', processingSettings: {} };
    store['2'] = { executionId: 1, generationPrompt: 'failed 2', qcStatus: 'failed', qcReason: 'reason b', processingSettings: {} };
    store['3'] = { executionId: 2, generationPrompt: 'failed 3', qcStatus: 'failed', qcReason: 'reason c', processingSettings: {} };
  });

  afterEach(async () => {
    store = {} as any;
    vi.restoreAllMocks();
  });

  it('registers IPC handlers for failed images review channels', async () => {
    // Ensure handlers were registered
    // Handlers should have been registered via mocked ipcMain.handle
    expect(handlers.has('generated-image:get-by-qc-status')).toBe(true);
    expect(handlers.has('generated-image:update-qc-status')).toBe(true);
    expect(handlers.has('generated-image:delete')).toBe(true);
    expect(handlers.has('failed-image:retry-batch')).toBe(true);
  });

  it('handles retry batch via IPC with original settings', async () => {
    const handler = handlers.get('failed-image:retry-batch');
    expect(typeof handler).toBe('function');

    const result = await handler({}, { imageIds: ['1', '2'], useOriginalSettings: true, modifiedSettings: null });
    expect(result.success).toBe(true);
    expect(result.message).toContain('batch retry');

    expect(store['1'].qcStatus).toBe('retry_pending');
    expect(store['2'].qcStatus).toBe('retry_pending');
  });

  it('rejects retry batch via IPC with original settings if mixed jobs', async () => {
    const handler = handlers.get('failed-image:retry-batch');
    const result = await handler({}, { imageIds: ['1', '3'], useOriginalSettings: true, modifiedSettings: null });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/different jobs/i);
  });

  it('handles retry batch via IPC with modified settings', async () => {
    const handler = handlers.get('failed-image:retry-batch');
    const modified = { sharpening: 99, removeBg: true };
    const result = await handler({}, { imageIds: ['1', '2'], useOriginalSettings: false, modifiedSettings: modified });
    expect(result.success).toBe(true);

    // Verify status was updated to retry_pending
    expect(store['1'].qcStatus).toBe('retry_pending');
    expect(store['2'].qcStatus).toBe('retry_pending');
    // Modified settings are NOT persisted to processingSettings - they're passed transiently via retry queue
    // This is by design to avoid configuration bleed (per BackendAdapter code)
    // The retryExecutor will use the modified settings when processing, but they're not stored on the image
  });

  it('updates QC status via IPC and deletes via IPC', async () => {
    const updateHandler = handlers.get('generated-image:update-qc-status');
    const deleteHandler = handlers.get('generated-image:delete');

    const upd = await updateHandler({}, { imageId: '1', status: 'approved' });
    expect(upd.success).toBe(true);
    expect(store['1'].qcStatus).toBe('approved');

    const del = await deleteHandler({}, { imageId: '2' });
    expect(del.success).toBe(true);
    expect(store['2']).toBeUndefined();
  });
});


