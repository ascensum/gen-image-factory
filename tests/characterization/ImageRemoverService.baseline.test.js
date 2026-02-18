/**
 * CHARACTERIZATION TEST: ImageRemoverService Baseline
 * 
 * Purpose: Capture CURRENT behavior of remove.bg integration in producePictureModule.js BEFORE extraction.
 * 
 * CRITICAL: These tests must pass against LEGACY code (producePictureModule.js lines ~21-87, ~584-692)
 * AND against the new ImageRemoverService after extraction (1:1 parity verification).
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

describe('ImageRemoverService Characterization Tests (Baseline)', () => {
  let producePictureModule;
  let prevCache = {};
  const tempTestDir = path.resolve(__dirname, '../../temp-test-image-remover');
  const inputImagePath = path.join(tempTestDir, 'input.png');

  const patchCjs = () => {
    prevCache = {};
    const remember = (id) => { if (!(id in prevCache)) prevCache[id] = req.cache[id]; };
    const set = (id, exports) => { 
      remember(id); 
      req.cache[id] = { id, filename: id, loaded: true, exports }; 
    };

    set(req.resolve('axios'), mockAxios);

    const mockLogDebug = vi.fn().mockImplementation((...args) => {
      // console.log('DEBUG:', ...args);
    });
    set(req.resolve('../../src/utils/logDebug'), { logDebug: mockLogDebug });
  };

  const whitePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYZAAAF396YQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(async () => {
    await fs.mkdir(tempTestDir, { recursive: true });
    await fs.writeFile(inputImagePath, whitePngBuffer);

    mockAxios.post.mockImplementation(() => Promise.resolve({ status: 200, data: whitePngBuffer }));
    mockAxios.get.mockImplementation(() => Promise.resolve({ status: 200, data: whitePngBuffer }));

    patchCjs();
    process.env.REMOVE_BG_API_KEY = 'test-api-key';
    process.env.FEATURE_MODULAR_REMOVER = 'true';

    producePictureModule = req('../../src/producePictureModule.js');
  });

  afterEach(async () => {
    await fs.rm(tempTestDir, { recursive: true, force: true });
    vi.clearAllMocks();
    delete process.env.REMOVE_BG_API_KEY;
    // Restore cache
    Object.keys(prevCache).forEach(id => {
      req.cache[id] = prevCache[id];
    });
  });

  describe('removeBg', () => {
    it('should successfully remove background and return a buffer', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: whitePngBuffer
      });

      const config = {
        removeBg: true,
        removeBgSize: 'auto',
        outputDirectory: tempTestDir,
        tempDirectory: tempTestDir,
        preserveInput: true
      };

      const resultPath = await producePictureModule.processImage(inputImagePath, 'test-remover', config);
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://api.remove.bg/v1.0/removebg',
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': 'test-api-key'
          })
        })
      );
      
      expect(resultPath).toBeDefined();
    });

    it('should handle API failure and fallback to original image in soft failure mode', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 402,
          statusText: 'Payment Required',
          data: 'Out of credits'
        }
      });

      const config = {
        removeBg: true,
        removeBgFailureMode: 'approve', // soft failure
        outputDirectory: tempTestDir,
        tempDirectory: tempTestDir,
        preserveInput: true
      };

      const resultPath = await producePictureModule.processImage(inputImagePath, 'test-fallback', config);
      
      expect(resultPath).toBeDefined();
      // Original image (white PNG) should be processed
      const exists = await fs.access(resultPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should throw error on API failure in hard failure mode', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: 'Invalid API Key'
        }
      });

      const config = {
        removeBg: true,
        removeBgFailureMode: 'mark_failed', // hard failure
        failRetryEnabled: true,
        failOnSteps: ['remove_bg'],
        outputDirectory: tempTestDir,
        tempDirectory: tempTestDir,
        preserveInput: true
      };

      await expect(producePictureModule.processImage(inputImagePath, 'test-fail', config))
        .rejects.toThrow('processing_failed:remove_bg');
    });
  });

  describe('trimming logic', () => {
    it('should apply trimming when enabled and removeBg is successful', async () => {
      const mockBuffer = whitePngBuffer; // In reality this would be transparent
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: mockBuffer
      });

      const config = {
        removeBg: true,
        trimTransparentBackground: true,
        outputDirectory: tempTestDir,
        tempDirectory: tempTestDir,
        preserveInput: true
      };

      const resultPath = await producePictureModule.processImage(inputImagePath, 'test-trim', config);
      expect(resultPath).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('should retry on 500 errors', async () => {
      mockAxios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({ status: 200, data: whitePngBuffer });

      const config = {
        removeBg: true,
        outputDirectory: tempTestDir,
        tempDirectory: tempTestDir,
        preserveInput: true,
        pollingTimeout: 1 // used to calculate removeBgTimeoutMs
      };

      // We don't use fake timers here as they sometimes conflict with complex async logic
      // instead we rely on the actual retry mechanism (2000ms delay)
      // but to speed up, we could mock the pause function if it were accessible.
      // Since it's not, we just wait.
      
      const resultPath = await producePictureModule.processImage(inputImagePath, 'test-retry', config);
      
      expect(resultPath).toBeDefined();
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    }, 10000); // 10s timeout for this test
  });
});
