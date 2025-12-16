import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

const mockAxiosPost = vi.fn();
const mockAxiosGet = vi.fn();

vi.mock('axios', () => {
  return {
    default: { post: mockAxiosPost, get: mockAxiosGet },
    post: mockAxiosPost,
    get: mockAxiosGet,
  };
});

let producePictureModule: any;

beforeAll(() => {
  vi.resetModules();
  const modulePath = path.resolve(__dirname, '../../src/producePictureModule.js');
  if (require.cache[modulePath]) delete require.cache[modulePath];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../src/producePictureModule.js');
  producePictureModule = mod.producePictureModule;

  // Ensure the module-local axios instance is our mock (module uses: const axios = require('axios'))
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axiosModule = require('axios');
  if (axiosModule && axiosModule.default) {
    axiosModule.default.post = mockAxiosPost;
    axiosModule.default.get = mockAxiosGet;
  }
  if (axiosModule.post) axiosModule.post = mockAxiosPost;
  if (axiosModule.get) axiosModule.get = mockAxiosGet;
});

describe('producePictureModule (Runware) top-up + error branches', () => {
  const tmpBase = path.join(os.tmpdir(), 'gif-runware-topup-test');
  const tempDir = path.join(tmpBase, 'generated');
  const outDir = path.join(tmpBase, 'toupload');

  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: pngBuffer,
      headers: { 'content-type': 'image/png' },
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {}
    delete process.env.RUNWARE_API_KEY;
  });

  it('throws a clear error when RUNWARE_API_KEY is missing', async () => {
    process.env.RUNWARE_API_KEY = '';

    const settings = {
      prompt: 'a cat',
      promptContext: '',
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
    };

    await expect(
      producePictureModule(settings, 'img', null, { tempDirectory: tempDir, outputDirectory: outDir, variations: 1 }),
    ).rejects.toThrow(/Runware API key is missing/i);

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('tops up when provider returns fewer URLs than requested variations', async () => {
    process.env.RUNWARE_API_KEY = 'k';

    mockAxiosPost
      .mockResolvedValueOnce({ status: 200, data: { data: [{ imageURL: 'https://example.com/a.png' }] } })
      .mockResolvedValueOnce({
        status: 200,
        data: { data: [{ imageURL: 'https://example.com/b.png' }, { imageURL: 'https://example.com/c.png' }] },
      });

    const settings = {
      prompt: 'a cat --v 6.1 --ar 1:1',
      promptContext: '',
      parameters: {
        runwareModel: 'runware:101@1',
        runwareFormat: 'png',
        runwareDimensionsCsv: '1024x1024',
        variations: 3,
        enablePollingTimeout: false,
      },
    };

    const result = await producePictureModule(settings, 'test_image', null, {
      tempDirectory: tempDir,
      outputDirectory: outDir,
      variations: 3,
      enablePollingTimeout: false,
      pollingTimeout: 1,
      removeBg: false,
      imageConvert: false,
    });

    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);

    expect(result).toHaveProperty('processedImages');
    expect(Array.isArray(result.processedImages)).toBe(true);
    expect(result.processedImages.length).toBe(3);
  });

  it('surfaces provider error details when Runware responds with errors[]', async () => {
    process.env.RUNWARE_API_KEY = 'k';

    const err: any = new Error('bad');
    err.response = { status: 400, data: { errors: ['invalid prompt'] } };
    mockAxiosPost.mockRejectedValueOnce(err);

    const settings = {
      prompt: 'a cat',
      promptContext: '',
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1 },
    };

    await expect(
      producePictureModule(settings, 'img', null, { tempDirectory: tempDir, outputDirectory: outDir, variations: 1 }),
    ).rejects.toThrow(/Runware request failed \(400\)/i);
  });
});
