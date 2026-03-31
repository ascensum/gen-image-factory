import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import path from 'node:path';
import ImageGeneratorService from '../../../src/services/ImageGeneratorService';
import { producePictureModule } from '../../../src/producePictureModule';

describe('ImageGeneratorService Bridge Integration Tests', () => {
  let mockAxios;
  let mockFs;
  const mockApiKey = 'test-api-key';

  const whitePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYZAAAF396YQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(() => {
    mockAxios = {
      post: vi.fn(),
      get: vi.fn()
    };
    mockFs = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(whitePngBuffer),
      unlink: vi.fn().mockResolvedValue(undefined)
    };
    
    process.env.RUNWARE_API_KEY = mockApiKey;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FEATURE_MODULAR_GENERATOR;
  });

  it('should use legacy path when flag is false', async () => {
    process.env.FEATURE_MODULAR_GENERATOR = 'false';
    
    mockAxios.post.mockResolvedValue({
      data: { data: [{ imageURL: 'https://example.com/legacy.png' }] }
    });
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule({ prompt: 'test' }, 'job', null, { 
       axios: mockAxios,
       fs: mockFs,
       tempDirectory: '/tmp', 
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result.processedImages).toHaveLength(1);
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should use modular path when flag is true', async () => {
    process.env.FEATURE_MODULAR_GENERATOR = 'true';
    
    mockAxios.post.mockResolvedValue({
      data: { data: [{ imageURL: 'https://example.com/modular.png' }] }
    });
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule({ prompt: 'test' }, 'job', null, { 
       axios: mockAxios,
       fs: mockFs,
       ImageGeneratorService: ImageGeneratorService,
       tempDirectory: '/tmp', 
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result.processedImages).toHaveLength(1);
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should fail fast (no legacy fallback) if modular path fails', async () => {
    process.env.FEATURE_MODULAR_GENERATOR = 'true';
    
    mockAxios.post.mockRejectedValueOnce(new Error('Service failed'));

    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    await expect(
      producePictureModule({ prompt: 'test' }, 'job', null, {
        axios: mockAxios,
        fs: mockFs,
        ImageGeneratorService: ImageGeneratorService,
        tempDirectory: '/tmp',
        outputDirectory: '/tmp',
        preserveInput: true
      })
    ).rejects.toThrow(/Service failed/);

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
  });
});
