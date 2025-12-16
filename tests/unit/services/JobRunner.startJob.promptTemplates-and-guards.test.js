import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({
  runQualityCheck: vi.fn(),
  generateMetadata: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner.startJob prompt template loading + guards', () => {
  let runner;
  let tmpRoot;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new JobRunner();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-start-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  it('returns JOB_ALREADY_RUNNING when a job is already running', async () => {
    runner.jobState.status = 'running';
    const res = await runner.startJob({ any: 'config' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('JOB_ALREADY_RUNNING');
  });

  it('loads qualityCheckPromptFile and metadataPromptFile into config.ai', async () => {
    const qcFile = path.join(tmpRoot, 'qc.txt');
    const mdFile = path.join(tmpRoot, 'md.txt');
    fs.writeFileSync(qcFile, 'QC PROMPT', 'utf8');
    fs.writeFileSync(mdFile, 'MD PROMPT', 'utf8');

    // Keep this test focused: accept config regardless of shape
    vi.spyOn(runner, 'validateConfiguration').mockReturnValue({ valid: true });
    vi.spyOn(runner, 'setEnvironmentFromConfig').mockImplementation(() => {});
    vi.spyOn(runner, 'executeJob').mockResolvedValue(undefined);

    const config = {
      apiKeys: {},
      parameters: { count: 1 },
      filePaths: { qualityCheckPromptFile: qcFile, metadataPromptFile: mdFile },
      ai: {},
    };

    const res = await runner.startJob(config);
    expect(res.success).toBe(true);

    // startJob mutates config.ai based on file contents
    expect(config.ai.qualityCheckPrompt).toBe('QC PROMPT');
    expect(config.ai.metadataPrompt).toBe('MD PROMPT');
  });

  it('swallows prompt file read errors and continues', async () => {
    const badFile = path.join(tmpRoot, 'missing.txt');

    vi.spyOn(runner, 'validateConfiguration').mockReturnValue({ valid: true });
    vi.spyOn(runner, 'setEnvironmentFromConfig').mockImplementation(() => {});
    vi.spyOn(runner, 'executeJob').mockResolvedValue(undefined);

    const config = {
      apiKeys: {},
      parameters: { count: 1 },
      filePaths: { qualityCheckPromptFile: badFile, metadataPromptFile: badFile },
      ai: {},
    };

    const res = await runner.startJob(config);
    expect(res.success).toBe(true);
    // unchanged because file read failed
    expect(config.ai.qualityCheckPrompt).toBeUndefined();
    expect(config.ai.metadataPrompt).toBeUndefined();
  });
});

