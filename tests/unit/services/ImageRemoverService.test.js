import { describe, it, expect, beforeEach, vi } from 'vitest';
import ImageRemoverService from '../../../src/services/ImageRemoverService';

describe('ImageRemoverService', () => {
  let service;
  let mockAxios;
  let mockFs;
  const mockApiKey = 'test-removebg-key';

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
      readFile: vi.fn().mockResolvedValue(whitePngBuffer)
    };

    service = new ImageRemoverService(mockApiKey, {
      axios: mockAxios,
      fs: mockFs
    });
  });

  describe('removeBackground', () => {
    it('should successfully remove background', async () => {
      mockAxios.post.mockResolvedValue({
        status: 200,
        data: whitePngBuffer
      });

      const result = await service.removeBackground(whitePngBuffer);
      expect(result).toEqual(whitePngBuffer);
      expect(mockAxios.post).toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      mockAxios.post.mockRejectedValue({
        response: { status: 401, statusText: 'Unauthorized' }
      });

      await expect(service.removeBackground(whitePngBuffer))
        .rejects.toThrow();
    });
  });

  describe('retryRemoveBackground', () => {
    it('should retry on 500 error', async () => {
      mockAxios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({ status: 200, data: whitePngBuffer });

      // Use a small delay for tests
      const result = await service.retryRemoveBackground(whitePngBuffer, { delay: 1 });
      expect(result).toEqual(whitePngBuffer);
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('trim', () => {
    it('should call sharp trim', async () => {
      // For sharp we use the real one as it's a binary dependency anyway 
      // but we could mock it if we wanted to be pure.
      // Since it's a characterization-like unit test, real sharp is fine.
      const result = await service.trim(whitePngBuffer);
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
