import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import ImageRemoverService from '../../../src/services/ImageRemoverService';
import { producePictureModule } from '../../../src/producePictureModule';

describe('ImageRemoverService Bridge Integration Tests', () => {
  let mockAxios;
  let mockFs;
  const mockApiKey = 'test-key';

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
    
    process.env.REMOVE_BG_API_KEY = mockApiKey;
    process.env.RUNWARE_API_KEY = 'mock-runware-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FEATURE_MODULAR_REMOVER;
  });

  it('should use legacy path when flag is false', async () => {
    process.env.FEATURE_MODULAR_REMOVER = 'false';
    
    // First call: Runware (legacy always calls it)
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ imageURL: 'https://example.com/img.png' }] }
    });
    // Second call: remove.bg
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: whitePngBuffer
    });
    // Third call: download
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule({ prompt: 'test' }, 'job', null, { 
       removeBg: true,
       axios: mockAxios,
       fs: mockFs,
       tempDirectory: '/tmp', 
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result.processedImages).toHaveLength(1);
    expect(mockAxios.post).toHaveBeenCalled();
  });

  it('should use modular path when flag is true', async () => {
    process.env.FEATURE_MODULAR_REMOVER = 'true';
    
    // First call: Runware (legacy toujours called by bridge if generator flag false)
    // Wait, producePictureModule bridge calls generatorService.generateImages if FEATURE_MODULAR_GENERATOR is true
    // but in this test FEATURE_MODULAR_GENERATOR is undefined (defaults to false).
    // So it calls _legacyProducePictureModule which calls Runware.
    
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ imageURL: 'https://example.com/img.png' }] }
    });
    // Second call: remove.bg (modular service)
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: whitePngBuffer
    });
    // download
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule({ prompt: 'test' }, 'job', null, { 
       removeBg: true,
       axios: mockAxios,
       fs: mockFs,
       ImageRemoverService: ImageRemoverService,
       tempDirectory: '/tmp', 
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result.processedImages).toHaveLength(1);
    expect(mockAxios.post).toHaveBeenCalled();
  });

  it('should fallback to legacy if modular path fails', async () => {
    process.env.FEATURE_MODULAR_REMOVER = 'true';
    
    // Runware
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ imageURL: 'https://example.com/img.png' }] }
    });
    // First call (modular remover) fails
    mockAxios.post.mockRejectedValueOnce(new Error('Modular failed'));

    // Second call (legacy remover) succeeds
    mockAxios.post.mockResolvedValueOnce({
      status: 200,
      data: whitePngBuffer
    });

    mockAxios.get.mockResolvedValue({
      status: 200,
      data: whitePngBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const result = await producePictureModule({ prompt: 'test' }, 'job', null, { 
       removeBg: true,
       axios: mockAxios,
       fs: mockFs,
       ImageRemoverService: ImageRemoverService,
       tempDirectory: '/tmp', 
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result.processedImages).toHaveLength(1);
    expect(mockAxios.post).toHaveBeenCalledTimes(3); // 1 Runware + 1 failed modular remover + 1 legacy remover
  });
});
