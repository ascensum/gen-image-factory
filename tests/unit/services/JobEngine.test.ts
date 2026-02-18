/**
 * Unit Tests: JobEngine
 * 
 * Purpose: Test JobEngine orchestration in isolation with mocked dependencies
 * Coverage Goal: ≥70% statement and branch coverage
 * 
 * Testing Strategy:
 * - Mock producePictureModule and paramsGeneratorModule
 * - Test orchestration flow: Init → ParamGen → ImageGen → QC → Metadata
 * - Test abort behavior mid-flow
 * - Test edge cases: parameter validation failures, API errors
 * 
 * Related: Story 3.1 Phase 4 Task 4.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('JobEngine Unit Tests', () => {
  let JobEngine: any;
  let jobEngine: any;
  let mockProducePictureModule: any;
  let mockParamsGeneratorModule: any;

  beforeEach(() => {
    // Clear module cache
    delete req.cache[req.resolve('../../../src/services/JobEngine.js')];
    
    // Create mock modules
    mockProducePictureModule = {
      producePictureModule: vi.fn()
    };

    mockParamsGeneratorModule = {
      generateParameters: vi.fn()
    };

    // Load JobEngine
    const module = req('../../../src/services/JobEngine.js');
    JobEngine = module.JobEngine;

    // Create JobEngine instance with mocked dependencies
    jobEngine = new JobEngine({
      producePictureModule: mockProducePictureModule,
      paramsGeneratorModule: mockParamsGeneratorModule
    });
  });

  describe('Constructor', () => {
    it('should initialize with default dependencies', () => {
      const engine = new JobEngine();
      expect(engine).toBeDefined();
      expect(engine.isStopping).toBe(false);
      expect(engine.abortController).toBeNull();
    });

    it('should accept injected dependencies', () => {
      expect(jobEngine.producePictureModule).toBe(mockProducePictureModule);
      expect(jobEngine.paramsGeneratorModule).toBe(mockParamsGeneratorModule);
    });
  });

  describe('executeJob() - Happy Path', () => {
    it('should execute single generation job successfully', async () => {
      // Arrange
      const config = {
        parameters: {
          count: 1,
          variations: 1
        },
        apiKeys: { test: 'key' },
        processing: {},
        ai: {}
      };

      mockParamsGeneratorModule.generateParameters.mockResolvedValue({
        prompt: 'test prompt',
        promptContext: 'test context'
      });

      mockProducePictureModule.producePictureModule.mockResolvedValue([
        '/test/image1.png'
      ]);

      // Act
      const result = await jobEngine.executeJob(config);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(1);
      expect(result.successfulImages).toBe(1);
      expect(result.failedImages).toBe(0);
      expect(mockParamsGeneratorModule.generateParameters).toHaveBeenCalledTimes(1);
      expect(mockProducePictureModule.producePictureModule).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple generations successfully', async () => {
      // Arrange
      const config = {
        parameters: {
          count: 3,
          variations: 2
        },
        apiKeys: { test: 'key' }
      };

      mockParamsGeneratorModule.generateParameters.mockResolvedValue({
        prompt: 'test prompt'
      });

      mockProducePictureModule.producePictureModule.mockResolvedValue([
        '/test/image1.png',
        '/test/image2.png'
      ]);

      // Act
      const result = await jobEngine.executeJob(config);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.images).toHaveLength(6); // 3 generations × 2 images each
      expect(mockParamsGeneratorModule.generateParameters).toHaveBeenCalledTimes(3);
      expect(mockProducePictureModule.producePictureModule).toHaveBeenCalledTimes(3);
    });

    it('should emit progress events during execution', async () => {
      // Arrange
      const config = {
        parameters: { count: 1, variations: 1 },
        apiKeys: { test: 'key' }
      };

      mockParamsGeneratorModule.generateParameters.mockResolvedValue({
        prompt: 'test prompt'
      });

      mockProducePictureModule.producePictureModule.mockResolvedValue(['/test/image.png']);

      const progressEvents: any[] = [];
      jobEngine.on('progress', (event: any) => progressEvents.push(event));

      // Act
      await jobEngine.executeJob(config);

      // Assert
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some((e: any) => e.step === 'initialization')).toBe(true);
      expect(progressEvents.some((e: any) => e.step === 'completed')).toBe(true);
    });
  });

  describe('executeJob() - Error Handling', () => {
    it('should handle parameter generation failure', async () => {
      // Arrange
      const config = {
        parameters: { count: 2, variations: 1 },
        apiKeys: { test: 'key' }
      };

      mockParamsGeneratorModule.generateParameters
        .mockRejectedValueOnce(new Error('Parameter generation failed'))
        .mockResolvedValueOnce({ prompt: 'test prompt' });

      mockProducePictureModule.producePictureModule.mockResolvedValue(['/test/image.png']);

      const errorEvents: any[] = [];
      jobEngine.on('error', (event: any) => errorEvents.push(event));

      // Act
      const result = await jobEngine.executeJob(config);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.failedImages).toBe(1); // First generation failed
      expect(result.successfulImages).toBe(1); // Second generation succeeded
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].step).toBe('parameter_generation');
    });

    it('should handle image generation failure', async () => {
      // Arrange
      const config = {
        parameters: { count: 2, variations: 1 },
        apiKeys: { test: 'key' }
      };

      mockParamsGeneratorModule.generateParameters.mockResolvedValue({
        prompt: 'test prompt'
      });

      mockProducePictureModule.producePictureModule
        .mockRejectedValueOnce(new Error('Image generation failed'))
        .mockResolvedValueOnce(['/test/image.png']);

      const errorEvents: any[] = [];
      jobEngine.on('error', (event: any) => errorEvents.push(event));

      // Act
      const result = await jobEngine.executeJob(config);

      // Assert
      expect(result.status).toBe('completed');
      expect(result.failedImages).toBe(1);
      expect(result.successfulImages).toBe(1);
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].step).toBe('image_generation');
    });

    it('should handle invalid configuration', async () => {
      // Arrange: Add error event listener to prevent unhandled error
      jobEngine.on('error', () => {});

      // Act
      const result = await jobEngine.executeJob(null);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.error).toContain('configuration is required');
    });

    it('should handle missing parameters', async () => {
      // Arrange: Add error event listener to prevent unhandled error
      jobEngine.on('error', () => {});

      // Act
      const result = await jobEngine.executeJob({});

      // Assert
      expect(result.status).toBe('failed');
      expect(result.error).toContain('parameters are required');
    });
  });

  describe('executeJob() - Abort Behavior', () => {
    it('should abort job when abort() is called', async () => {
      // Arrange
      const config = {
        parameters: { count: 5, variations: 1 },
        apiKeys: { test: 'key' }
      };

      mockParamsGeneratorModule.generateParameters.mockResolvedValue({
        prompt: 'test prompt'
      });

      mockProducePictureModule.producePictureModule.mockImplementation(async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 10));
        return ['/test/image.png'];
      });

      // Act: Start job and abort after 20ms
      const jobPromise = jobEngine.executeJob(config);
      setTimeout(() => jobEngine.abort(), 20);
      const result = await jobPromise;

      // Assert
      expect(result.status).toBe('aborted');
      expect(result.message).toContain('aborted');
    });

    it('should handle external abort signal', async () => {
      // Arrange
      const config = {
        parameters: { count: 3, variations: 1 },
        apiKeys: { test: 'key' }
      };

      const abortController = new AbortController();

      mockParamsGeneratorModule.generateParameters.mockResolvedValue({
        prompt: 'test prompt'
      });

      mockProducePictureModule.producePictureModule.mockResolvedValue(['/test/image.png']);

      // Act: Abort immediately
      abortController.abort();
      const result = await jobEngine.executeJob(config, abortController.signal);

      // Assert
      expect(result.status).toBe('aborted');
    });
  });

  describe('_processGenerationResult()', () => {
    it('should process array of image paths', () => {
      // Arrange
      const result = ['/test/image1.png', '/test/image2.png'];
      const genParameters = { prompt: 'test prompt' };

      // Act
      const images = jobEngine._processGenerationResult(result, genParameters, 0);

      // Assert
      expect(images).toHaveLength(2);
      expect(images[0].finalImagePath).toBe('/test/image1.png');
      expect(images[0].qcStatus).toBe('approved');
      expect(images[1].finalImagePath).toBe('/test/image2.png');
    });

    it('should process single image path string', () => {
      // Arrange
      const result = '/test/image.png';
      const genParameters = { prompt: 'test prompt' };

      // Act
      const images = jobEngine._processGenerationResult(result, genParameters, 0);

      // Assert
      expect(images).toHaveLength(1);
      expect(images[0].finalImagePath).toBe('/test/image.png');
      expect(images[0].qcStatus).toBe('approved');
    });

    it('should process structured result with processedImages and failedItems', () => {
      // Arrange
      const result = {
        processedImages: [
          { path: '/test/image1.png', qcStatus: 'approved' }
        ],
        failedItems: [
          { mappingId: 'failed-1', stage: 'processing', message: 'Processing failed' }
        ]
      };
      const genParameters = { prompt: 'test prompt' };

      // Act
      const images = jobEngine._processGenerationResult(result, genParameters, 0);

      // Assert
      expect(images).toHaveLength(2);
      expect(images[0].qcStatus).toBe('approved');
      expect(images[1].qcStatus).toBe('qc_failed');
      expect(images[1].qcReason).toContain('processing_failed');
    });
  });

  describe('_buildImageObject()', () => {
    it('should build image object from string path', () => {
      // Arrange
      const genParameters = { prompt: 'test prompt' };

      // Act
      const image = jobEngine._buildImageObject('/test/image.png', genParameters, 0, 0, 1);

      // Assert
      expect(image.finalImagePath).toBe('/test/image.png');
      expect(image.generationPrompt).toBe('test prompt');
      expect(image.qcStatus).toBe('approved');
      expect(image.metadata.prompt).toBe('test prompt');
    });

    it('should build image object from structured object', () => {
      // Arrange
      const item = {
        imageMappingId: 'test-mapping-id',
        path: '/test/image.png',
        qcStatus: 'approved',
        seed: 12345,
        metadata: { custom: 'data' }
      };
      const genParameters = { prompt: 'test prompt' };

      // Act
      const image = jobEngine._buildImageObject(item, genParameters, 0, 0, 1);

      // Assert
      expect(image.imageMappingId).toBe('test-mapping-id');
      expect(image.finalImagePath).toBe('/test/image.png');
      expect(image.seed).toBe(12345);
      expect(image.metadata.custom).toBe('data');
    });

    it('should handle invalid item format with fallback', () => {
      // Arrange
      const genParameters = { prompt: 'test prompt' };

      // Act
      const image = jobEngine._buildImageObject(null, genParameters, 0, 0, 1);

      // Assert
      expect(image.qcStatus).toBe('qc_failed');
      expect(image.qcReason).toBe('invalid_result_format');
    });
  });

  describe('_validateConfig()', () => {
    it('should validate valid configuration', () => {
      // Arrange
      const config = {
        parameters: { count: 1 },
        apiKeys: { test: 'key' }
      };

      // Act
      const validated = jobEngine._validateConfig(config);

      // Assert
      expect(validated).toEqual(config);
    });

    it('should throw error for null configuration', () => {
      // Act & Assert
      expect(() => jobEngine._validateConfig(null)).toThrow('configuration is required');
    });

    it('should throw error for missing parameters', () => {
      // Act & Assert
      expect(() => jobEngine._validateConfig({})).toThrow('parameters are required');
    });
  });

  describe('_buildModuleConfig()', () => {
    it('should build module config with effective variations', () => {
      // Arrange
      const config = {
        parameters: {
          count: 1,
          variations: 5,
          runwareDimensionsCsv: '512x512'
        },
        processing: { sharpening: 1 },
        ai: { metadataPrompt: 'test' }
      };
      const genParameters = { prompt: 'test' };

      // Act
      const moduleConfig = jobEngine._buildModuleConfig(config, genParameters, 0);

      // Assert
      expect(moduleConfig.generationIndex).toBe(0);
      expect(moduleConfig.variations).toBe(5);
      expect(moduleConfig.runwareDimensionsCsv).toBe('512x512');
      expect(moduleConfig.processing.sharpening).toBe(1);
      expect(moduleConfig.ai.metadataPrompt).toBe('test');
    });

    it('should clamp variations to max allowed (10000 total cap)', () => {
      // Arrange
      const config = {
        parameters: {
          count: 1000, // 1000 generations
          variations: 50 // Requested 50 variations per generation
        }
      };
      const genParameters = { prompt: 'test' };

      // Act
      const moduleConfig = jobEngine._buildModuleConfig(config, genParameters, 0);

      // Assert
      // Max allowed = Math.min(20, Math.floor(10000 / 1000)) = Math.min(20, 10) = 10
      expect(moduleConfig.variations).toBe(10);
    });
  });
});
