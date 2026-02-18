import { describe, it, expect, beforeEach, vi } from 'vitest';
import ImageGeneratorService from '../../../src/services/ImageGeneratorService';

describe('ImageGeneratorService', () => {
  let service;
  let mockAxios;
  let mockFs;
  const mockApiKey = 'test-api-key';
  const mockLogDebug = vi.fn();

  beforeEach(() => {
    console.log('TEST BEFORE EACH START');
    mockAxios = {
      post: vi.fn(),
      get: vi.fn()
    };
    mockFs = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined)
    };

    service = new ImageGeneratorService(mockApiKey, {
      axios: mockAxios,
      fs: mockFs,
      logDebug: mockLogDebug
    });

    if (service.axios !== mockAxios) {
       throw new Error('DI FAILURE: service.axios is not mockAxios');
    }
  });

  describe('generateImages', () => {
    it('should successfully generate and download one image', async () => {
      const rwData = { data: [{ imageURL: 'https://example.com/img1.png' }] };
      mockAxios.post.mockResolvedValue({ data: rwData });

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('fake-data'),
        headers: { 'content-type': 'image/png' }
      });

      const result = await service.generateImages({ prompt: 'test' }, 'test-job', {});

      if (result.successfulDownloads.length === 0) {
         // Force show what happened
         const urls = service.extractRunwareImageUrls(rwData);
         throw new Error(`DEBUG: urls extracted: ${JSON.stringify(urls)} from ${JSON.stringify(rwData)}`);
      }

      expect(result.successfulDownloads).toHaveLength(1);
      expect(mockAxios.post).toHaveBeenCalledTimes(1);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error if API key is missing', async () => {
      const emptyKeyService = new ImageGeneratorService('', { axios: mockAxios });
      await expect(emptyKeyService.generateImages({ prompt: 'test' }, 'test', {}))
        .rejects.toThrow(/Runware API key is missing/);
    });

    it('should handle Runware API failure', async () => {
      mockAxios.post.mockRejectedValue({
        response: { status: 400, data: { errors: ['err'] } }
      });
      await expect(service.generateImages({ prompt: 'test' }, 'test', {}))
        .rejects.toThrow(/Runware request failed \(400\)/);
    });

    it('should implement top-up mechanism if provider returns fewer images', async () => {
      mockAxios.post
        .mockResolvedValueOnce({ data: { data: [{ imageURL: 'https://example.com/1.png' }] } })
        .mockResolvedValueOnce({ data: { data: [{ imageURL: 'https://example.com/2.png' }] } });

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('data'),
        headers: { 'content-type': 'image/png' }
      });

      const result = await service.generateImages({ prompt: 'test', parameters: { variations: 2 } }, 'test', {});

      expect(result.successfulDownloads).toHaveLength(2);
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle download failure and record it in failedItems', async () => {
      mockAxios.post.mockResolvedValue({
        data: { data: [{ imageURL: 'https://example.com/img1.png' }] }
      });
      mockAxios.get.mockRejectedValue(new Error('Download failed'));

      const result = await service.generateImages({ prompt: 'test' }, 'test', {});

      expect(result.successfulDownloads).toHaveLength(0);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0].stage).toBe('download');
    });
  });

  describe('Utility Methods', () => {
    it('normalizeRunwareDimension should round to nearest 64', () => {
      expect(service.normalizeRunwareDimension(100)).toBe(128);
      expect(service.normalizeRunwareDimension(500)).toBe(512);
    });

    it('sanitizePromptForRunware should remove MJ flags', () => {
      const prompt = 'sunset --v 6.1 --ar 16:9';
      expect(service.sanitizePromptForRunware(prompt)).toBe('sunset');
    });
  });
});
