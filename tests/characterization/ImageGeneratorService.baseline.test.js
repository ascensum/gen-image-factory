/**
 * CHARACTERIZATION TEST: ImageGeneratorService Baseline
 * 
 * Purpose: Capture CURRENT behavior of Runware API integration in producePictureModule.js BEFORE extraction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);

const mockAxios = {
  post: vi.fn(),
  get: vi.fn()
};

vi.mock('axios', () => ({
  default: mockAxios
}));

describe('ImageGeneratorService Characterization Tests (Baseline)', () => {
  let producePictureModule;
  let prevCache = {};
  const tempTestDir = path.resolve(__dirname, '../../temp-test-image-generator');

  const patchCjs = () => {
    prevCache = {};
    const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id, exports) => { 
      remember(id); 
      req.cache[id] = { id, filename: id, loaded: true, exports }; 
    };

    set(req.resolve('axios'), mockAxios);

    const mockLogDebug = vi.fn();
    set(req.resolve('../../src/utils/logDebug'), { logDebug: mockLogDebug });
  };

  const whitePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYZAAAF396YQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(async () => {
    await fs.mkdir(tempTestDir, { recursive: true });
    
    mockAxios.get.mockImplementation(() => Promise.resolve({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    }));
    mockAxios.post.mockImplementation(() => Promise.resolve({
      status: 200,
      data: { data: [{ imageURL: 'https://example.com/image1.png' }] }
    }));

    patchCjs();
    process.env.RUNWARE_API_KEY = 'test-runware-key';
    process.env.FEATURE_MODULAR_GENERATOR = 'true';
    producePictureModule = req('../../src/producePictureModule.js');
  });

  afterEach(async () => {
    await fs.rm(tempTestDir, { recursive: true, force: true });
    vi.clearAllMocks();
    delete process.env.RUNWARE_API_KEY;
    Object.keys(prevCache).forEach(id => {
      req.cache[id] = prevCache[id];
    });
  });

  it('should successfully generate and download images', async () => {
    const settings = {
      prompt: 'a beautiful sunset',
      parameters: {
        runwareModel: 'runware:101@1',
        variations: 1
      }
    };
    const config = {
      tempDirectory: tempTestDir,
      outputDirectory: tempTestDir,
      preserveInput: true
    };

    mockAxios.post.mockResolvedValue({
      status: 200,
      data: {
        data: [{ imageURL: 'https://example.com/image1.png' }]
      }
    });

    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule.producePictureModule(settings, 'sunset', null, config);

    expect(result.processedImages).toHaveLength(1);
    expect(result.processedImages[0].outputPath).toContain('sunset_1.png');
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.runware.ai/v1/images/generate',
      expect.arrayContaining([expect.objectContaining({ positivePrompt: 'a beautiful sunset' })]),
      expect.anything()
    );
  });

  it('should throw error if Runware API key is missing', async () => {
    delete process.env.RUNWARE_API_KEY;
    const settings = { prompt: 'test' };
    const config = { tempDirectory: tempTestDir };

    await expect(producePictureModule.producePictureModule(settings, 'test', null, config))
      .rejects.toThrow(/Runware API key is missing/);
  });

  it('should handle Runware API errors', async () => {
    mockAxios.post.mockRejectedValue({
      response: {
        status: 400,
        data: { errors: ['Invalid model'] }
      }
    });

    const settings = { prompt: 'test' };
    const config = { tempDirectory: tempTestDir };

    await expect(producePictureModule.producePictureModule(settings, 'test', null, config))
      .rejects.toThrow(/Runware request failed \(400\)/);
  });

  it('should implement top-up mechanism if fewer images are returned', async () => {
    const settings = {
      prompt: 'test top-up',
      parameters: { variations: 2 }
    };
    const config = {
      tempDirectory: tempTestDir,
      outputDirectory: tempTestDir,
      preserveInput: true
    };

    // First call returns 1 image
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ imageURL: 'https://example.com/img1.png' }] }
    });
    // Second call (top-up) returns 1 more
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ imageURL: 'https://example.com/img2.png' }] }
    });

    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule.producePictureModule(settings, 'topup', null, config);

    expect(result.processedImages).toHaveLength(2);
    expect(mockAxios.post).toHaveBeenCalledTimes(2);
  });
});
