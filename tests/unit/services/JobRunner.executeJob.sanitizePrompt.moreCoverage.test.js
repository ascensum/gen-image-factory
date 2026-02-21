import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobRunner.executeJob - sanitizePromptForRunware + DB save loop (big path)', () => {
  let prevCache = {};

  const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
  const patchCjs = (id, exports) => {
    remember(id);
    req.cache[id] = { id, filename: id, loaded: true, exports };
  };
  const loadSut = () => {
    const sutId = req.resolve('../../../src/services/jobRunner.js');
    remember(sutId);
    delete req.cache[sutId];
    return req(sutId);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prevCache = {};
  });

  afterEach(() => {
    for (const [id, entry] of Object.entries(prevCache)) {
      if (entry) req.cache[id] = entry;
      else delete req.cache[id];
    }
    prevCache = {};
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('strips MJ flags from prompt before persisting generationPrompt', async () => {
    patchCjs(req.resolve('../../../src/producePictureModule.js'), {});
    patchCjs(req.resolve('../../../src/paramsGeneratorModule.js'), {});
    patchCjs(req.resolve('../../../src/aiVision.js'), {});

    const { JobRunner } = loadSut();
    const runner = new JobRunner();
    runner._logStructured = vi.fn();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jr-exec-'));
    const imgPath = path.join(tmpDir, 'img.png');
    await fs.writeFile(imgPath, 'x');

    const store = [];
    const backendAdapter = {
      saveGeneratedImage: vi.fn(async (img) => { store.push(img); return { success: true, id: store.length }; }),
      // JobRunner.getSavedImagesForExecution calls getAllGeneratedImages(), not getGeneratedImagesByExecution()
      getAllGeneratedImages: vi.fn(async () => ({ success: true, images: store })),
      updateImagePathsByMappingId: vi.fn(async () => ({ success: true })),
      updateQCStatusByMappingId: vi.fn(async () => ({ success: true })),
    };

    runner.backendAdapter = backendAdapter;
    runner.databaseExecutionId = 123;
    runner.jobConfiguration = {
      ai: { runQualityCheck: false, runMetadataGen: false },
      processing: { removeBgFailureMode: 'approve' },
      filePaths: { outputDirectory: tmpDir, tempDirectory: tmpDir },
      parameters: { processMode: 'relax', enablePollingTimeout: false, pollingTimeout: 1 },
    };

    runner.generateParameters = vi.fn(async () => ({
      prompt: 'unused',
      promptContext: '',
      aspectRatios: ['1:1'],
    }));

    const rawPrompt = 'Hello world --v 6.1 --ar 1:1 --stylize 100 --q 2 --seed 123';
    runner.generateImages = vi.fn(async () => ([
      { path: imgPath, status: 'generated', metadata: { prompt: rawPrompt }, mappingId: 'map1', aspectRatio: '1:1' },
    ]));

    runner.moveImageToFinalLocation = vi.fn(async () => path.join(tmpDir, 'final.png'));

    await expect(runner.executeJob(runner.jobConfiguration, 'job-1')).resolves.toBeUndefined();

    expect(backendAdapter.saveGeneratedImage).toHaveBeenCalledTimes(1);
    const saved = store[0];
    expect(saved.generationPrompt).toBe('Hello world');
    expect(saved.generationPrompt).not.toMatch(/--v|--ar|--stylize|--q|--seed/);

    expect(backendAdapter.updateImagePathsByMappingId).toHaveBeenCalledWith('map1', null, path.join(tmpDir, 'final.png'));
    expect(backendAdapter.updateQCStatusByMappingId).toHaveBeenCalledWith('map1', 'approved', expect.any(String));
  });
});

