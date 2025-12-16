import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fsSync from 'fs';

const req = createRequire(import.meta.url);

describe('BackendAdapter.createZipExport (unit) - high value coverage', () => {
  let prevCache: Record<string, any> = {};

  const patchCjs = () => {
    prevCache = {};
    const remember = (id: string) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id: string, exports: any) => {
      remember(id);
      (req.cache as any)[id] = { id, filename: id, loaded: true, exports };
    };

    // module-scope deps
    set(req.resolve('keytar'), { getPassword: vi.fn(), setPassword: vi.fn(), deletePassword: vi.fn(), default: {} });
    set(req.resolve('exceljs'), {
      Workbook: vi.fn(() => ({
        addWorksheet: vi.fn(() => ({ columns: [], addRows: vi.fn() })),
        xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) },
      })),
    });
    set(req.resolve('electron'), { ipcMain: undefined, app: { getPath: vi.fn(() => '/tmp/userData') } });

    // models and services
    set(req.resolve('../../../../src/database/models/JobConfiguration.js'), { JobConfiguration: function () { return {}; } });
    set(req.resolve('../../../../src/database/models/JobExecution.js'), { JobExecution: function () { return {}; } });
    set(req.resolve('../../../../src/database/models/GeneratedImage.js'), { GeneratedImage: function () { return {}; } });
    set(req.resolve('../../../../src/services/jobRunner.js'), { JobRunner: function () { return {}; } });
    set(req.resolve('../../../../src/services/retryExecutor.js'), function () { return {}; });
    set(req.resolve('../../../../src/services/errorTranslation.js'), { ErrorTranslationService: function () { return {}; } });
    set(req.resolve('../../../../src/utils/logMasking.js'), { safeLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });

    // Ensure reload
    const sutId = req.resolve('../../../../src/adapter/backendAdapter.js');
    remember(sutId);
    delete req.cache[sutId];
  };

  const restore = () => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
  };

  beforeEach(() => {
    vi.clearAllMocks();
    patchCjs();
  });

  afterEach(() => {
    restore();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns error when imageIds is empty', async () => {
    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);

    await expect(adapter.createZipExport([], true)).resolves.toEqual({ success: false, error: 'No image IDs provided' });
  });

  it('creates zip with excel metadata and appends (1) when outputPath exists', async () => {
    const errorHandlers: any[] = [];

    const outputStream = {
      on: vi.fn((evt: string, cb: any) => {
        if (evt === 'close') queueMicrotask(() => cb());
        if (evt === 'error') errorHandlers.push(cb);
      }),
    };

    // archive mock
    const archive = {
      pipe: vi.fn(),
      file: vi.fn(),
      append: vi.fn(),
      finalize: vi.fn(async () => undefined),
    };
    const archiverFn = vi.fn(() => archive);
    // createZipExport requires archiver dynamically
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    const existsSpy = vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('/exports')) return true;
      if (s.endsWith('/tmp/out.zip')) return true; // force duplicate
      if (s.endsWith('/tmp/out (1).zip')) return false;
      if (s === '/tmp') return true;
      return false;
    });
    const mkdirSpy = vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    const unlinkSpy = vi.spyOn(fsSync, 'unlinkSync').mockImplementation(() => undefined as any);
    const cwsSpy = vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);

    const accessSpy = vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.mainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };

    adapter.generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: {
          id: 1,
          finalImagePath: '/tmp/a.png',
          metadata: { title: 't', description: 'd', tags: ['a', 'b'] },
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      }),
    };

    const res = await adapter.createZipExport(['1'], true, { outputPath: '/tmp/out.zip', duplicatePolicy: 'append' });
    expect(res.success).toBe(true);
    expect(res.zipPath).toBe('/tmp/out (1).zip');

    expect(archiverFn).toHaveBeenCalledWith('zip', expect.any(Object));
    expect(archive.pipe).toHaveBeenCalledWith(outputStream);
    expect(archive.file).toHaveBeenCalledWith('/tmp/a.png', { name: expect.stringMatching(/^images\//) });
    expect(archive.append).toHaveBeenCalledWith(expect.any(Buffer), { name: 'metadata.xlsx' });
    expect(archive.finalize).toHaveBeenCalled();

    // sanity: we touched filesystem helpers
    expect(existsSpy).toHaveBeenCalled();
    expect(mkdirSpy).not.toHaveBeenCalledWith(expect.anything(), { recursive: true }); // exportDir already exists
    expect(unlinkSpy).not.toHaveBeenCalled(); // append policy
    expect(cwsSpy).toHaveBeenCalledWith('/tmp/out (1).zip');
    expect(accessSpy).toHaveBeenCalledWith('/tmp/a.png');
    expect(errorHandlers.length).toBeGreaterThanOrEqual(0);
  });

  it('append policy increments beyond (1) when duplicate already exists', async () => {
    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    const existsSpy = vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('/exports')) return true;
      if (s.endsWith('/tmp/out.zip')) return true; // duplicate
      if (s.endsWith('/tmp/out (1).zip')) return true; // also taken => loop increments
      if (s.endsWith('/tmp/out (2).zip')) return false;
      if (s === '/tmp') return true;
      return false;
    });
    const cwsSpy = vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, finalImagePath: '/tmp/a.png', metadata: '{}' } }),
    };

    const res = await adapter.createZipExport(['1'], false, { outputPath: '/tmp/out.zip', duplicatePolicy: 'append' });
    expect(res.success).toBe(true);
    expect(res.zipPath).toBe('/tmp/out (2).zip');
    expect(existsSpy).toHaveBeenCalled();
    expect(cwsSpy).toHaveBeenCalledWith('/tmp/out (2).zip');
  });

  it('skips missing files and still creates zip (no archive.file calls)', async () => {
    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    vi.spyOn(fsSync, 'existsSync').mockReturnValue(true);
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockRejectedValueOnce(new Error('no access'));

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: { id: 1, finalImagePath: '/tmp/missing.png', metadata: '{}' },
      }),
    };

    const res = await adapter.createZipExport(['1'], false);
    expect(res.success).toBe(true);
    expect(archive.file).not.toHaveBeenCalled();
    expect(archive.append).not.toHaveBeenCalled();
  });

  it('normalizes tags from metadata.tags string and writes excel rows', async () => {
    // Override exceljs workbook so we can assert addRows content
    const worksheet = { columns: [], addRows: vi.fn() };
    const workbook = { addWorksheet: vi.fn(() => worksheet), xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) } };
    const excelId = req.resolve('exceljs');
    if (!(excelId in prevCache)) prevCache[excelId] = req.cache[excelId];
    (req.cache as any)[excelId] = { id: excelId, filename: excelId, loaded: true, exports: { Workbook: vi.fn(() => workbook) } };

    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => String(p).endsWith('/exports'));
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: {
          id: 1,
          finalImagePath: '/tmp/a.png',
          metadata: { title: { en: 't' }, description: { en: 'd' }, tags: 'a, b, ,c ' },
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      }),
    };

    const res = await adapter.createZipExport(['1'], true);
    expect(res.success).toBe(true);
    expect(worksheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({ Tags: 'a, b, c' }),
    ]);
  });

  it('supports uploadTags/upload_tags variants (string + object) for tags extraction', async () => {
    const worksheet = { columns: [], addRows: vi.fn() };
    const workbook = { addWorksheet: vi.fn(() => worksheet), xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) } };
    const excelId = req.resolve('exceljs');
    if (!(excelId in prevCache)) prevCache[excelId] = req.cache[excelId];
    (req.cache as any)[excelId] = { id: excelId, filename: excelId, loaded: true, exports: { Workbook: vi.fn(() => workbook) } };

    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => String(p).endsWith('/exports'));
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn()
        .mockResolvedValueOnce({
          success: true,
          image: { id: 1, finalImagePath: '/tmp/a.png', metadata: { uploadTags: 'u1, u2' }, createdAt: new Date('2020-01-01T00:00:00Z') },
        })
        .mockResolvedValueOnce({
          success: true,
          image: { id: 2, finalImagePath: '/tmp/b.png', metadata: { upload_tags: { en: 'x, y' } }, createdAt: new Date('2020-01-01T00:00:00Z') },
        })
        .mockResolvedValueOnce({
          success: true,
          image: { id: 3, finalImagePath: '/tmp/c.png', metadata: { upload_tags: 'm, n' }, createdAt: new Date('2020-01-01T00:00:00Z') },
        }),
    };

    const res = await adapter.createZipExport(['1', '2', '3'], true);
    expect(res.success).toBe(true);
    expect(worksheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({ Tags: 'u1, u2' }),
      expect.objectContaining({ Tags: 'x, y' }),
      expect.objectContaining({ Tags: 'm, n' }),
    ]);
  });

  it('returns error and emits zip-export:error when archive.finalize throws', async () => {
    const outputStream = { on: vi.fn((_evt: string, _cb: any) => undefined) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => { throw new Error('zip fail'); }) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    vi.spyOn(fsSync, 'existsSync').mockReturnValue(true);
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.mainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } };
    adapter.generatedImage = { getGeneratedImage: vi.fn().mockResolvedValue({ success: true, image: { id: 1, finalImagePath: '/tmp/a.png', metadata: '{}' } }) };

    const res = await adapter.createZipExport(['1'], false);
    expect(res.success).toBe(false);
    expect(adapter.mainWindow.webContents.send).toHaveBeenCalledWith('zip-export:error', expect.any(Object));
  });

  it('skips images with no filePath and supports uploadTags object form', async () => {
    const worksheet = { columns: [], addRows: vi.fn() };
    const workbook = { addWorksheet: vi.fn(() => worksheet), xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) } };
    const excelId = req.resolve('exceljs');
    if (!(excelId in prevCache)) prevCache[excelId] = req.cache[excelId];
    (req.cache as any)[excelId] = { id: excelId, filename: excelId, loaded: true, exports: { Workbook: vi.fn(() => workbook) } };

    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => String(p).endsWith('/exports'));
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn()
        .mockResolvedValueOnce({ success: true, image: { id: 1, finalImagePath: null, tempImagePath: null, metadata: '{}' } }) // skipped (no filePath)
        .mockResolvedValueOnce({ success: true, image: { id: 2, finalImagePath: '/tmp/a.png', metadata: { uploadTags: { en: 'objTag' } }, createdAt: new Date('2020-01-01T00:00:00Z') } }),
    };

    const res = await adapter.createZipExport(['1', '2'], true);
    expect(res.success).toBe(true);
    expect(worksheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({ Tags: 'objTag' }),
    ]);
  });

  it('uses provided outputPath when file does not exist and skips non-success getGeneratedImage results', async () => {
    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    // No duplicate path -> zipPath = full (covers backendAdapter.js line ~3225)
    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s === '/tmp') return true;
      if (s.endsWith('/tmp/out.zip')) return false; // not existing -> use as-is
      if (s.endsWith('/exports')) return true;
      return false;
    });
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn()
        .mockResolvedValueOnce({ success: false }) // skipped via continue (covers ~3245-3246)
        .mockResolvedValueOnce({ success: true, image: { id: 2, finalImagePath: '/tmp/a.png', metadata: '{}' } }),
    };

    const res = await adapter.createZipExport(['1', '2'], false, { outputPath: '/tmp/out.zip', duplicatePolicy: 'append' });
    expect(res.success).toBe(true);
    expect(res.zipPath).toBe('/tmp/out.zip');
    expect(archive.file).toHaveBeenCalledWith('/tmp/a.png', { name: expect.stringMatching(/^images\//) });
  });

  it('parses JSON string metadata and supports tags array', async () => {
    const worksheet = { columns: [], addRows: vi.fn() };
    const workbook = { addWorksheet: vi.fn(() => worksheet), xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx')) } };
    const excelId = req.resolve('exceljs');
    if (!(excelId in prevCache)) prevCache[excelId] = req.cache[excelId];
    (req.cache as any)[excelId] = { id: excelId, filename: excelId, loaded: true, exports: { Workbook: vi.fn(() => workbook) } };

    const outputStream = { on: vi.fn((evt: string, cb: any) => { if (evt === 'close') queueMicrotask(() => cb()); }) };
    const archive = { pipe: vi.fn(), file: vi.fn(), append: vi.fn(), finalize: vi.fn(async () => undefined) };
    const archiverFn = vi.fn(() => archive);
    const archiverId = req.resolve('archiver');
    if (!(archiverId in prevCache)) prevCache[archiverId] = req.cache[archiverId];
    (req.cache as any)[archiverId] = { id: archiverId, filename: archiverId, loaded: true, exports: archiverFn };

    vi.spyOn(fsSync, 'existsSync').mockImplementation((p: any) => String(p).endsWith('/exports'));
    vi.spyOn(fsSync, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fsSync, 'createWriteStream').mockReturnValue(outputStream as any);
    vi.spyOn(fsSync.promises, 'access').mockResolvedValue(undefined);

    const mod: any = await import('../../../../src/adapter/backendAdapter');
    const adapter: any = new mod.BackendAdapter({ skipIpcSetup: true });
    adapter.ensureInitialized = vi.fn().mockResolvedValue(undefined);
    adapter.generatedImage = {
      getGeneratedImage: vi.fn().mockResolvedValue({
        success: true,
        image: {
          id: 1,
          finalImagePath: '/tmp/a.png',
          metadata: JSON.stringify({ title: 't', description: 'd', tags: ['x', 'y'] }),
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      }),
    };

    const res = await adapter.createZipExport(['1'], true);
    expect(res.success).toBe(true);
    expect(worksheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({ Tags: 'x, y' }),
    ]);
  });
});

