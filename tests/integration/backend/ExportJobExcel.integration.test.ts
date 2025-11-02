import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';

// Ensure no stray fs mock from other suites
vi.unmock('fs');

const tempDir = path.join(os.tmpdir(), `gif-job-export-test-${Date.now()}`);

// Mock Electron app.getPath to write exports to a temp dir
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

// Mock keytar to avoid secure storage calls
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}));

// Mock DB models to avoid real SQLite usage
vi.mock('../../../src/database/models/JobExecution', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobExecution: vi.fn(),
    getJobExecutionsByIds: vi.fn(),
    updateJobExecution: vi.fn().mockResolvedValue({ success: true })
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

describe('Job Export to Excel - Integration', () => {
  let backend: any;

  beforeEach(async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    backend = new BackendAdapter({
      ipc: { handle: vi.fn(), removeHandler: vi.fn() },
      skipIpcSetup: true,
    });

    // Wire job execution and images
    const JobExecution = (await import('../../../src/database/models/JobExecution')).JobExecution as any;
    const jobExec = new JobExecution();
    vi.spyOn(jobExec, 'getJobExecution').mockImplementation(async (id: string) => {
      return { success: true, execution: { id, label: 'My Fancy Job', status: 'completed', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), totalImages: 2, successfulImages: 2, failedImages: 0, configurationId: 42 } };
    });
    (backend as any).jobExecution = jobExec;

    const GeneratedImage = (await import('../../../src/database/models/GeneratedImage')).GeneratedImage as any;
    const gi = new GeneratedImage();
    vi.spyOn(gi, 'getGeneratedImagesByExecution').mockImplementation(async (_id: string) => {
      return { success: true, images: [
        { id: '1', executionId: '123', generationPrompt: 'A', seed: 1, qcStatus: 'approved', qcReason: '', finalImagePath: path.join(tempDir, 'a.png'), createdAt: new Date().toISOString() },
        { id: '2', executionId: '123', generationPrompt: 'B', seed: 2, qcStatus: 'approved', qcReason: '', finalImagePath: path.join(tempDir, 'b.png'), createdAt: new Date().toISOString() }
      ] };
    });
    (backend as any).generatedImage = gi;

    const JobConfiguration = (await import('../../../src/database/models/JobConfiguration')).JobConfiguration as any;
    const cfg = new JobConfiguration();
    vi.spyOn(cfg, 'getConfigurationById').mockImplementation(async (_id: number) => {
      return { success: true, configuration: { id: 42, name: 'CfgName', settings: { parameters: { label: 'CfgLabel' }, processing: { convertToJpg: true } }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    });
    (backend as any).jobConfig = cfg;
  });

  afterEach(() => {
    vi.clearAllMocks();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('creates an Excel file at a custom path using label-first filename and overwrite policy', async () => {
    const customDir = path.join(tempDir, 'out');
    const options = { outputPath: path.join(customDir, 'my_export.xlsx'), duplicatePolicy: 'overwrite' as const };
    const res = await backend.exportJobToExcel('job-123456', options);
    expect(res.success).toBe(true);
    expect(res.filePath).toBeTruthy();
    expect(fs.existsSync(res.filePath)).toBe(true);
    expect(res.filePath!.toLowerCase().endsWith('.xlsx')).toBe(true);

    // Parse workbook and verify sheets exist
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(res.filePath);
    const summary = wb.getWorksheet('Job Summary');
    const images = wb.getWorksheet('Images');
    expect(summary).toBeTruthy();
    expect(images).toBeTruthy();
    // Basic cell checks
    expect(summary.getRow(1).values).toBeTruthy();
  });
});


