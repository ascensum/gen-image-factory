import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import ImageProcessorService from '../../../src/services/ImageProcessorService';
import { processImage } from '../../../src/producePictureModule';

describe('ImageProcessorService Bridge Integration Tests', () => {
  let mockFs;
  const whitePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYZAAAF396YQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(() => {
    mockFs = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(whitePngBuffer),
      unlink: vi.fn().mockResolvedValue(undefined)
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FEATURE_MODULAR_PROCESSOR;
  });

  it('should use legacy path when flag is false', async () => {
    process.env.FEATURE_MODULAR_PROCESSOR = 'false';
    
    const result = await processImage('/tmp/input.png', 'test-job', { 
       fs: mockFs,
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result).toContain('test-job.png');
    // Legacy uses sharp directly
  });

  it('should use modular path when flag is true', async () => {
    process.env.FEATURE_MODULAR_PROCESSOR = 'true';
    
    const result = await processImage('/tmp/input.png', 'test-job', { 
       fs: mockFs,
       ImageProcessorService: ImageProcessorService,
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result).toContain('test-job.png');
  });

  it('should fallback to legacy if modular path fails', async () => {
    process.env.FEATURE_MODULAR_PROCESSOR = 'true';
    
    // Create a failing service
    class FailingProcessor {
       async process() { throw new Error('Modular failed'); }
    }

    const result = await processImage('/tmp/input.png', 'test-job', { 
       fs: mockFs,
       ImageProcessorService: FailingProcessor,
       outputDirectory: '/tmp', 
       preserveInput: true 
    });
    
    expect(result).toContain('test-job.png');
  });
});
