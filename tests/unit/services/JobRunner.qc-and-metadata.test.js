import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, require.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
  originalCache.clear();
};

const mockProducePictureModule = { producePictureModule: vi.fn() };
const mockParamsGeneratorModule = { paramsGeneratorModule: vi.fn() };
const mockAiVision = { runQualityCheck: vi.fn(), generateMetadata: vi.fn() };

const installCjsMocks = () => {
  const produceId = require.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  require.cache[produceId] = { id: produceId, filename: produceId, loaded: true, exports: mockProducePictureModule };

  const paramsId = require.resolve('../../../src/paramsGeneratorModule.js');
  rememberCache(paramsId);
  require.cache[paramsId] = { id: paramsId, filename: paramsId, loaded: true, exports: mockParamsGeneratorModule };

  const aiVisionId = require.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  require.cache[aiVisionId] = { id: aiVisionId, filename: aiVisionId, loaded: true, exports: mockAiVision };

  const sutId = require.resolve('../../../src/services/jobRunner.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  const { JobRunner } = require('../../../src/services/jobRunner.js');
  return JobRunner;
};

describe('JobRunner QC + metadata helpers (unit)', () => {
  let tmpRoot;
  let imgPath1;
  let imgPath2;
  let backendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAiVision.runQualityCheck.mockReset();
    mockAiVision.generateMetadata.mockReset();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-qc-md-'));
    imgPath1 = path.join(tmpRoot, 'a.png');
    imgPath2 = path.join(tmpRoot, 'b.png');
    fs.writeFileSync(imgPath1, 'x', 'utf8');
    fs.writeFileSync(imgPath2, 'y', 'utf8');

    backendAdapter = {
      updateQCStatusByMappingId: vi.fn().mockResolvedValue({ success: true }),
      updateGeneratedImageByMappingId: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    restoreCache();
  });

  it('runQualityChecks updates qcStatus/qcReason based on aiVision result', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;

    mockAiVision.runQualityCheck
      .mockResolvedValueOnce({ passed: true, reason: 'ok' })
      .mockResolvedValueOnce({ passed: false, reason: 'bad' });

    const images = [
      { id: 1, mappingId: 'm1', tempImagePath: imgPath1, metadata: { prompt: 'P1' } },
      { id: 2, mappingId: 'm2', finalImagePath: imgPath2, metadata: { prompt: 'P2' } },
    ];

    const cfg = { parameters: { enablePollingTimeout: false, pollingTimeout: 1, openaiModel: 'gpt-4o-mini' }, ai: { qualityCheckPrompt: 'q' } };

    await runner.runQualityChecks(images, cfg);

    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m1', 'approved', 'ok');
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m2', 'qc_failed', 'bad');
    expect(images[0].qcStatus).toBe('approved');
    expect(images[1].qcStatus).toBe('qc_failed');
  });

  it('generateMetadata persists metadata and marks qc_failed on failures', async () => {
    const JobRunner = loadSut();
    const runner = new JobRunner();
    runner.backendAdapter = backendAdapter;

    mockAiVision.generateMetadata
      .mockResolvedValueOnce({ new_title: 't1', new_description: 'd1', uploadTags: ['a'] })
      .mockImplementationOnce(() => new Promise((_, reject) => global.setTimeout(() => reject(new Error('meta down')), 10)));

    const images = [
      { id: 10, mappingId: 'm10', tempImagePath: imgPath1, metadata: { prompt: 'P1' } },
      { id: 20, mappingId: 'm20', tempImagePath: imgPath2, metadata: { prompt: 'P2' } },
    ];

    const cfg = { parameters: { enablePollingTimeout: false, pollingTimeout: 1, openaiModel: 'gpt-4o-mini' }, ai: { metadataPrompt: 'mp' } };

    let thrown = null;
    try {
      await runner.generateMetadata(images, cfg);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown && thrown.message)).toContain('Metadata generation failed');

    expect(backendAdapter.updateGeneratedImageByMappingId).toHaveBeenCalledWith(
      'm10',
      expect.objectContaining({ metadata: expect.objectContaining({ title: 't1', description: 'd1' }) }),
    );
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('m20', 'qc_failed', 'processing_failed:metadata');
    expect(backendAdapter.updateGeneratedImageByMappingId).toHaveBeenCalledWith(
      'm20',
      expect.objectContaining({ metadata: expect.objectContaining({ failure: expect.any(Object) }) }),
    );
  });
});

