import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, req.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) req.cache[id] = entry;
    else delete req.cache[id];
  }
  originalCache.clear();
};

const installCjsMocks = () => {
  const electronId = req.resolve('electron');
  rememberCache(electronId);
  req.cache[electronId] = {
    id: electronId,
    filename: electronId,
    loaded: true,
    exports: { app: { getPath: () => '/tmp' } },
  };

  // Avoid loading real sqlite-backed model during module import
  const jcId = req.resolve('../../../src/database/models/JobConfiguration.js');
  rememberCache(jcId);
  req.cache[jcId] = {
    id: jcId,
    filename: jcId,
    loaded: true,
    exports: {
      JobConfiguration: function MockJobConfiguration() {
        return {
          getDefaultSettings: () => ({
            filePaths: { outputDirectory: '/tmp/toupload', tempDirectory: '/tmp/generated' },
            apiKeys: {},
          }),
        };
      },
    },
  };

  // Keep retryExecutor import cheap
  const produceId = req.resolve('../../../src/producePictureModule.js');
  rememberCache(produceId);
  req.cache[produceId] = {
    id: produceId,
    filename: produceId,
    loaded: true,
    exports: { processImage: vi.fn() },
  };

  const aiVisionId = req.resolve('../../../src/aiVision.js');
  rememberCache(aiVisionId);
  req.cache[aiVisionId] = {
    id: aiVisionId,
    filename: aiVisionId,
    loaded: true,
    exports: { generateMetadata: vi.fn() },
  };

  const sutId = req.resolve('../../../src/services/retryExecutor.js');
  rememberCache(sutId);
  delete req.cache[sutId];
};

const loadSut = () => {
  installCjsMocks();
  return req('../../../src/services/retryExecutor.js');
};

describe('RetryExecutor.getOriginalProcessingSettings (unit) - parsing + defaults', () => {
  let RetryExecutor;
  let exec;

  beforeEach(() => {
    vi.clearAllMocks();
    RetryExecutor = loadSut();
    exec = new RetryExecutor({ jobConfig: { getDefaultSettings: () => ({ filePaths: {}, apiKeys: {} }) } });
  });

  afterEach(() => {
    restoreCache();
  });

  it('returns defaults when processingSettings is missing', async () => {
    const res = await exec.getOriginalProcessingSettings({ id: 1 });
    expect(res).toEqual(expect.objectContaining({
      imageEnhancement: false,
      sharpening: 0,
      saturation: 1.0,
      imageConvert: false,
      convertToJpg: false,
      convertToWebp: false,
      jpgQuality: 100,
      pngQuality: 100,
      webpQuality: 85,
      removeBg: false,
      removeBgSize: 'auto',
      trimTransparentBackground: false,
      jpgBackground: 'white',
    }));
  });

  it('parses JSON settings string and applies defaults for missing fields', async () => {
    const res = await exec.getOriginalProcessingSettings({
      id: 2,
      processingSettings: JSON.stringify({ imageEnhancement: true, sharpening: 3, removeBg: true, removeBgSize: 'preview' }),
    });
    expect(res).toEqual(expect.objectContaining({
      imageEnhancement: true,
      sharpening: 3,
      removeBg: true,
      removeBgSize: 'preview',
      saturation: 1.0,
      imageConvert: false,
      jpgBackground: 'white',
    }));
  });

  it('falls back to defaults when processingSettings JSON is invalid', async () => {
    const res = await exec.getOriginalProcessingSettings({
      id: 3,
      processingSettings: '{not valid json',
    });
    expect(res).toEqual(expect.objectContaining({
      imageEnhancement: false,
      removeBg: false,
      removeBgSize: 'auto',
    }));
  });
});

