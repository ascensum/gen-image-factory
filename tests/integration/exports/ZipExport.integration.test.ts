/**
 * ZIP export integration tests (Story 3.5 Phase 4).
 * Decomposed from backend/ExportZip.integration.test.ts.
 * Uses real fs; own mocks for electron/keytar/DB. File < 400 lines (ADR-011).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.unmock('fs');

const tempDir = path.join(os.tmpdir(), `gif-zip-export-${Date.now()}`);

vi.mock('electron', () => {
  const mod = {
    app: {
      getPath: vi.fn().mockImplementation((which: string) => {
        if (which === 'userData') return tempDir;
        return os.tmpdir();
      }),
    },
    ipcMain: undefined,
  };
  return { default: mod, ...mod };
});

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../../src/database/models/GeneratedImage', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getGeneratedImage: vi.fn(),
  })),
}));

import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('ZIP Export Integration', () => {
  let backend: any;

  beforeEach(async () => {
    fs.mkdirSync(tempDir, { recursive: true });

    backend = new BackendAdapter({
      ipc: { handle: vi.fn(), removeHandler: vi.fn() },
      skipIpcSetup: true,
    });

    const imgA = path.join(tempDir, 'a.png');
    const imgB = path.join(tempDir, 'b.jpg');
    fs.writeFileSync(imgA, Buffer.from([0, 1, 2, 3]));
    fs.writeFileSync(imgB, Buffer.from([0, 1, 2, 3, 4, 5]));

    vi.spyOn(backend.generatedImage, 'getGeneratedImage').mockImplementation(async (id: string) => {
      if (id === '1') return { success: true, image: { id: 1, finalImagePath: imgA, tempImagePath: null, metadata: { title: 'A' }, createdAt: new Date().toISOString() } };
      if (id === '2') return { success: true, image: { id: 2, finalImagePath: imgB, tempImagePath: null, metadata: { title: 'B' }, createdAt: new Date().toISOString() } };
      if (id === '3') return { success: true, image: { id: 3, finalImagePath: path.join(tempDir, 'missing.png'), tempImagePath: null, metadata: { title: 'C' }, createdAt: new Date().toISOString() } };
      return { success: false, error: 'not found' };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('creates a ZIP file with images and metadata', async () => {
    const res = await backend.createZipExport(['1', '2', '3'], true);
    expect(res.success).toBe(true);
    expect(res.zipPath).toBeTruthy();
    expect(fs.existsSync(res.zipPath)).toBe(true);
    expect(fs.statSync(res.zipPath).size).toBeGreaterThan(0);
  }, 60000);

  it('respects overwrite duplicate policy for custom output path', async () => {
    const outDir = path.join(tempDir, 'zip-out');
    fs.mkdirSync(outDir, { recursive: true });
    const target = path.join(outDir, 'images_out.zip');
    fs.writeFileSync(target, Buffer.from([1, 2, 3]));
    const res = await backend.createZipExport(['1', '2'], true, { outputPath: target, duplicatePolicy: 'overwrite' });
    expect(res.success).toBe(true);
    expect(res.zipPath).toBe(target);
    expect(fs.existsSync(res.zipPath)).toBe(true);
    expect(fs.statSync(res.zipPath).size).toBeGreaterThan(0);
  }, 60000);

  it('appends number when duplicate and policy is append', async () => {
    const outDir = path.join(tempDir, 'zip-out2');
    fs.mkdirSync(outDir, { recursive: true });
    const target = path.join(outDir, 'images_out.zip');
    fs.writeFileSync(target, Buffer.from([1, 2, 3]));
    const res = await backend.createZipExport(['1'], true, { outputPath: target, duplicatePolicy: 'append' });
    expect(res.success).toBe(true);
    expect(res.zipPath).not.toBe(target);
    expect(String(res.zipPath).toLowerCase().endsWith('.zip')).toBe(true);
    expect(fs.existsSync(res.zipPath)).toBe(true);
  }, 60000);
});
