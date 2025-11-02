import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.unmock('fs');

const tempDir = path.join(os.tmpdir(), `gif-bulk-export-test-${Date.now()}`);

vi.mock('electron', () => {
  const mod = {
    app: {
      getPath: vi.fn().mockImplementation((which: string) => {
        if (which === 'userData') return tempDir;
        return os.tmpdir();
      })
    },
    ipcMain: undefined
  };
  return { default: mod, ...mod };
});

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('../../../src/database/models/JobExecution', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobExecutionsByIds: vi.fn(),
  }))
}));

vi.mock('../../../src/database/models/GeneratedImage', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getGeneratedImagesByExecution: vi.fn(),
  }))
}));

vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getConfigurationById: vi.fn(),
  }))
}));

import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('Bulk Export Jobs - Integration', () => {
  let backend: any;

  beforeEach(async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    backend = new BackendAdapter({
      ipc: { handle: vi.fn(), removeHandler: vi.fn() },
      skipIpcSetup: true,
    });

    const JobExecution = (await import('../../../src/database/models/JobExecution')).JobExecution as any;
    const jobExec = new JobExecution();
    (vi.spyOn as any)(jobExec as any, 'getJobExecutionsByIds').mockImplementation(async (...args: any[]) => {
      const _ids: string[] = args[0];
      return { success: true, executions: [
        { id: 'j1', label: 'Label One', status: 'completed', configurationId: 1, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), totalImages: 1, successfulImages: 1, failedImages: 0 },
        { id: 'j2', label: 'Label Two', status: 'completed', configurationId: 2, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), totalImages: 0, successfulImages: 0, failedImages: 0 }
      ] };
    });
    (backend as any).jobExecution = jobExec;

    const GeneratedImage = (await import('../../../src/database/models/GeneratedImage')).GeneratedImage as any;
    const gi = new GeneratedImage();
    (vi.spyOn as any)(gi as any, 'getGeneratedImagesByExecution').mockImplementation(async (...args: any[]) => {
      const _id: string = args[0];
      return { success: true, images: [] };
    });
    (backend as any).generatedImage = gi;

    const JobConfiguration = (await import('../../../src/database/models/JobConfiguration')).JobConfiguration as any;
    const cfg = new JobConfiguration();
    (vi.spyOn as any)(cfg as any, 'getConfigurationById').mockImplementation(async (...args: any[]) => {
      const id: number = args[0];
      return { success: true, configuration: { id, name: `Cfg${id}`, settings: { parameters: { label: `Cfg${id}` } } } };
    });
    (backend as any).jobConfig = cfg;
  });

  afterEach(() => {
    vi.clearAllMocks();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('creates a ZIP at a custom path and appends number when duplicate exists', async () => {
    const outDir = path.join(tempDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const basePath = path.join(outDir, 'bulk_out.zip');
    // Pre-create a file to force append policy
    fs.writeFileSync(basePath, Buffer.from([0]));
    const res = await backend.bulkExportJobExecutions(['j1', 'j2'], { outputPath: basePath, duplicatePolicy: 'append' });
    expect(res.success).toBe(true);
    expect(res.zipPath).toBeTruthy();
    expect(res.zipPath.toLowerCase().endsWith('.zip')).toBe(true);
    expect(fs.existsSync(res.zipPath)).toBe(true);
    expect(res.zipPath).not.toBe(basePath);
  });
});


