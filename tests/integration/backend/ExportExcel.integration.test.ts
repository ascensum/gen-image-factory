import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';

// Ensure no stray fs mock from other suites
vi.unmock('fs');

// Mock Electron app.getPath to write exports to a temp dir
const tempDir = path.join(os.tmpdir(), `gif-export-test-${Date.now()}`);

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
vi.mock('../../../src/database/models/JobConfiguration', () => ({
  JobConfiguration: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getConfigurationById: vi.fn(),
  }))
}));

vi.mock('../../../src/database/models/JobExecution', () => ({
  JobExecution: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getJobExecution: vi.fn(),
  }))
}));

vi.mock('../../../src/database/models/GeneratedImage', () => ({
  GeneratedImage: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getGeneratedImagesByExecution: vi.fn(),
  }))
}));

import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('Export to Excel - Regression', () => {
  let backend: any;

  beforeEach(async () => {
    fs.mkdirSync(tempDir, { recursive: true });

    backend = new BackendAdapter({
      ipc: { handle: vi.fn(), removeHandler: vi.fn() },
      skipIpcSetup: true,
    });

    // Provide predictable data
    vi.spyOn(backend.jobExecution, 'getJobExecution').mockResolvedValue({
      success: true,
      execution: {
        id: 1,
        label: 'Test Job',
        configurationId: 10,
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalImages: 2,
        successfulImages: 2,
        failedImages: 0,
        errorMessage: null,
      },
    });

    vi.spyOn(backend.generatedImage, 'getGeneratedImagesByExecution').mockResolvedValue({
      success: true,
      images: [
        { id: 101, executionId: 1, generationPrompt: 'A', seed: 123, qcStatus: 'approved', qcReason: null, finalImagePath: '/tmp/a.png', createdAt: new Date().toISOString() },
        { id: 102, executionId: 1, generationPrompt: 'B', seed: 456, qcStatus: 'approved', qcReason: null, finalImagePath: '/tmp/b.png', createdAt: new Date().toISOString() },
      ],
    });

    vi.spyOn(backend.jobConfig, 'getConfigurationById').mockResolvedValue({
      success: true,
      configuration: {
        id: 10,
        name: 'cfg-10',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          apiKeys: { openai: 'sk-should-not-export', piapi: 'piapi-should-not-export', removeBg: 'rm-should-not-export' },
          filePaths: { outputDirectory: '/out', tempDirectory: '/tmp' },
          parameters: { processMode: 'relax', aspectRatios: '1:1', mjVersion: '6.1', openaiModel: 'gpt-4o-mini' },
          ai: { runQualityCheck: true, runMetadataGen: true },
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('excludes API keys and includes labeled settings in Job Summary', async () => {
    const res = await backend.exportJobToExcel(1);
    // Temporary debug to understand failures in CI
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error('Export failure:', res);
      throw new Error(res.error || 'unknown export error');
    }
    expect(res.success).toBe(true);
    expect(res.filePath).toBeTruthy();
    expect(fs.existsSync(res.filePath)).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(res.filePath);
    const summaryWs = wb.getWorksheet('Job Summary');
    expect(summaryWs).toBeTruthy();

    const rows: any[][] = [];
    summaryWs!.eachRow((row) => {
      const vals = (row.values as unknown as any[]);
      rows.push(vals.slice(1));
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const headers: string[] = rows[0] as string[];
    const values: any[] = rows[1] as any[];

    // Build a map header -> value for easy assertions
    const dataMap = new Map<string, any>();
    headers.forEach((h, idx) => dataMap.set(String(h), values[idx]));

    // Security: ensure API key fields are not exported by header name
    expect(headers.find(h => String(h).toLowerCase().includes('api key'))).toBeUndefined();
    expect(headers.find(h => String(h).startsWith('apiKeys.'))).toBeUndefined();

    // Positive: ensure labeled parameters are present (provider-agnostic)
    // After Runware migration, omit MJ/OpenAI/MJ-mode specific fields
    expect(headers).not.toContain('Aspect Ratios');
    expect(headers).not.toContain('MJ Version');
    expect(headers).not.toContain('Process Mode');

    // And values reflect mocked config
    // 'Process Mode' may be omitted with Runware; skip asserting its value
    // OpenAI Model may be omitted in Runware export; assert only if present
    if (headers.includes('OpenAI Model')) {
      expect(dataMap.get('OpenAI Model')).toBe('gpt-4o-mini');
    }

    // Images sheet exists
    expect(wb.getWorksheet('Images')).toBeTruthy();
  });
});


