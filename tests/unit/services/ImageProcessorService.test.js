import { describe, it, expect, beforeEach, vi } from 'vitest';
import ImageProcessorService from '../../../src/services/ImageProcessorService';

describe('ImageProcessorService', () => {
  let service;
  let mockFs;

  const whitePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYZAAAF396YQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(() => {
    mockFs = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(whitePngBuffer)
    };

    service = new ImageProcessorService({
      fs: mockFs
    });
  });

  it('should process image and save as PNG by default', async () => {
    const result = await service.process(whitePngBuffer, 'test', { outputDirectory: '/tmp' });
    expect(result).toContain('.png');
  });

  it('should convert to JPG', async () => {
    const result = await service.process(whitePngBuffer, 'test', { 
      imageConvert: true, 
      convertToJpg: true,
      outputDirectory: '/tmp' 
    });
    expect(result).toContain('.jpg');
  });

  it('should convert to WebP', async () => {
    const result = await service.process(whitePngBuffer, 'test', { 
      imageConvert: true, 
      convertToWebp: true,
      outputDirectory: '/tmp' 
    });
    expect(result).toContain('.webp');
  });

  it('should apply enhancements', async () => {
    const result = await service.process(whitePngBuffer, 'test', { 
      imageEnhancement: true,
      sharpening: 1,
      saturation: 1.2,
      outputDirectory: '/tmp' 
    });
    expect(result).toBeDefined();
  });
});
