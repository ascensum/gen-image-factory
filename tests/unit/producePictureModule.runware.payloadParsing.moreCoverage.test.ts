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

  // Ensure module-local axios uses our mocks
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axiosModule = require('axios');
  if (axiosModule && axiosModule.default) {
    axiosModule.default.post = mockAxiosPost;
    axiosModule.default.get = mockAxiosGet;
  }
  if (axiosModule.post) axiosModule.post = mockAxiosPost;
  if (axiosModule.get) axiosModule.get = mockAxiosGet;
});

describe('producePictureModule Runware request payload parsing', () => {
  const tmpBase = path.join(os.tmpdir(), 'gif-runware-payload-test');
  const tempDir = path.join(tmpBase, 'generated');
  const outDir = path.join(tmpBase, 'toupload');

  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    process.env.RUNWARE_API_KEY = 'k';

    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    mockAxiosGet.mockResolvedValue({ status: 200, data: pngBuffer, headers: { 'content-type': 'image/png' } });
  });

  afterEach(() => {
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
    delete process.env.RUNWARE_API_KEY;
  });

  it('defaults to 1024x1024 when runwareDimensionsCsv is invalid', async () => {
    mockAxiosPost.mockImplementationOnce((_url: string, payload: any) => {
      const body = payload?.[0];
      expect(body.width).toBe(1024);
      expect(body.height).toBe(1024);
      return Promise.resolve({ status: 200, data: { data: [{ imageURL: 'https://example.com/a.png' }] } });
    });

    const settings = {
      prompt: 'cat',
      promptContext: '',
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1, runwareDimensionsCsv: 'not-a-csv' },
    };

    const res = await producePictureModule(settings, 'img', null, {
      tempDirectory: tempDir,
      outputDirectory: outDir,
      variations: 1,
      enablePollingTimeout: false,
      pollingTimeout: 1,
      imageConvert: false,
      removeBg: false,
    });

    expect(res.processedImages.length).toBe(1);
  });

  it('selects dimensions based on generationIndex from CSV list', async () => {
    mockAxiosPost.mockImplementationOnce((_url: string, payload: any) => {
      const body = payload?.[0];
      expect(body.width).toBe(768);
      expect(body.height).toBe(1024);
      return Promise.resolve({ status: 200, data: { data: [{ imageURL: 'https://example.com/a.png' }] } });
    });

    const settings = {
      prompt: 'cat',
      promptContext: '',
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1, runwareDimensionsCsv: '512x512,768x1024' },
    };

    const res = await producePictureModule(settings, 'img', null, {
      tempDirectory: tempDir,
      outputDirectory: outDir,
      variations: 1,
      generationIndex: 1,
      enablePollingTimeout: false,
      pollingTimeout: 1,
      imageConvert: false,
      removeBg: false,
    });

    expect(res.processedImages.length).toBe(1);
  });

  it('extracts image URLs from array response shape', async () => {
    mockAxiosPost.mockResolvedValueOnce({
      status: 200,
      data: [{ data: [{ imageURL: 'https://example.com/a.png' }] }],
    });

    const settings = {
      prompt: 'cat --v 6.1 --ar 1:1 --q 2',
      promptContext: '',
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png', variations: 1, runwareDimensionsCsv: '1024x1024' },
    };

    const res = await producePictureModule(settings, 'img', null, {
      tempDirectory: tempDir,
      outputDirectory: outDir,
      variations: 1,
      enablePollingTimeout: false,
      pollingTimeout: 1,
      imageConvert: false,
      removeBg: false,
    });

    expect(res.processedImages.length).toBe(1);
  });
});
