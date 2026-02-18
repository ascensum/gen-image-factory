/**
 * Bridge Integration Tests: ImageRepository Shadow Bridge
 * 
 * Purpose: Test both legacy and modular paths for ImageRepository methods
 * Scope: Feature flag routing, fallback behavior, 1:1 behavioral parity
 * 
 * Testing Strategy (ADR-006):
 * 1. Test LEGACY path (feature flag OFF) - ensure original behavior preserved
 * 2. Test MODULAR path (feature flag ON) - ensure new repository works
 * 3. Test FALLBACK behavior (repository throws error) - ensure graceful degradation
 * 4. Verify characterization tests pass in BOTH modes
 * 
 * Coverage Goal: 100% of Shadow Bridge routing logic
 * 
 * Related: Story 3.2 Phase 2 Task 2.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'fs';

const req = createRequire(import.meta.url);

describe('ImageRepository Bridge Integration Tests', () => {
  let GeneratedImage: any;
  let generatedImage: any;
  let testDbPath: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Save original env
    originalEnv = process.env.FEATURE_MODULAR_IMAGE_REPOSITORY;
    
    // Use unique test database for each run
    testDbPath = path.join(process.cwd(), 'tests', 'integration', `test-image-repo-${Date.now()}.db`);
    
    // Clear module cache to ensure fresh load
    const generatedImagePath = req.resolve('../../../src/database/models/GeneratedImage.js');
    delete req.cache[generatedImagePath];
  });

  afterEach(async () => {
    // Restore env
    if (originalEnv !== undefined) {
      process.env.FEATURE_MODULAR_IMAGE_REPOSITORY = originalEnv;
    } else {
      delete process.env.FEATURE_MODULAR_IMAGE_REPOSITORY;
    }

    // Close database connection
    if (generatedImage?.db) {
      await new Promise<void>((resolve) => {
        generatedImage.db.close((err: any) => {
          if (err) console.warn('Error closing test database:', err);
          resolve();
        });
      });
    }

    // Cleanup test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        console.warn('Could not delete test database:', err);
      }
    }
  });

  describe('Legacy Path (Feature Flag OFF)', () => {
    beforeEach(async () => {
      // Feature flag OFF
      delete process.env.FEATURE_MODULAR_IMAGE_REPOSITORY;
      
      // Load GeneratedImage
      const module = req('../../../src/database/models/GeneratedImage.js');
      GeneratedImage = module.GeneratedImage;
      generatedImage = new GeneratedImage();
      
      // Override dbPath for testing
      generatedImage.dbPath = testDbPath;
      await generatedImage.init();
    });

    it('should use legacy path when feature flag is OFF', async () => {
      // Assert: ImageRepository was NOT initialized
      expect(generatedImage.imageRepository).toBeNull();
      
      // Arrange: Insert test data
      const testImageData = {
        imageMappingId: 'legacy-test-1',
        executionId: 1,
        generationPrompt: 'test prompt',
        seed: 12345,
        qcStatus: 'approved'
      };

      await generatedImage.saveGeneratedImage(testImageData);

      // Act: Test a simple repository method
      const result = await generatedImage.getImageStatistics();

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(1);
    });

    it('should use legacy getImageStatistics when feature flag is OFF', async () => {
      // Arrange: Insert test data
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'legacy-stat-1',
        executionId: 1,
        generationPrompt: 'test 1',
        seed: 123,
        qcStatus: 'approved'
      });
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'legacy-stat-2',
        executionId: 1,
        generationPrompt: 'test 2',
        seed: 456,
        qcStatus: 'failed'
      });

      // Act
      const result = await generatedImage.getImageStatistics();

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(2);
      expect(result.statistics.approvedImages).toBe(1);
      expect(result.statistics.failedImages).toBe(1);
    });

    it('should use legacy updateMetadataById when feature flag is OFF', async () => {
      // Arrange: Insert test image
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'legacy-update-1',
        executionId: 1,
        generationPrompt: 'test',
        seed: 123,
        metadata: { width: 512, height: 512 }
      });

      // Get the inserted image ID
      const allImages = await generatedImage.getAllGeneratedImages();
      const imageId = allImages.images[0].id;

      // Act
      const updateResult = await generatedImage.updateMetadataById(imageId, { quality: 95 });

      // Assert
      expect(updateResult.success).toBe(true);
    });

    it('should use legacy bulkDeleteGeneratedImages when feature flag is OFF', async () => {
      // Arrange: Insert test images
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'legacy-delete-1',
        executionId: 1,
        generationPrompt: 'test 1',
        seed: 123
      });
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'legacy-delete-2',
        executionId: 1,
        generationPrompt: 'test 2',
        seed: 456
      });

      // Get all image IDs
      const allImages = await generatedImage.getAllGeneratedImages();
      const imageIds = allImages.images.map((img: any) => img.id);

      // Act
      const deleteResult = await generatedImage.bulkDeleteGeneratedImages(imageIds);

      // Assert
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.totalImages).toBeGreaterThan(0);
    });
  });

  describe('Modular Path (Feature Flag ON)', () => {
    beforeEach(async () => {
      // Feature flag ON
      process.env.FEATURE_MODULAR_IMAGE_REPOSITORY = 'true';
      
      // Load GeneratedImage
      const module = req('../../../src/database/models/GeneratedImage.js');
      GeneratedImage = module.GeneratedImage;
      generatedImage = new GeneratedImage();
      
      // Override dbPath for testing
      generatedImage.dbPath = testDbPath;
      await generatedImage.init();
    });

    it('should use ImageRepository when feature flag is ON', async () => {
      // Assert: ImageRepository was initialized
      expect(generatedImage.imageRepository).not.toBeNull();
      expect(generatedImage.imageRepository.constructor.name).toBe('ImageRepository');
    });

    it('should route getImageStatistics through ImageRepository (simple test)', async () => {
      // Arrange: Insert test data
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'modular-test-1',
        executionId: 1,
        generationPrompt: 'test prompt',
        seed: 12345,
        qcStatus: 'approved'
      });

      // Spy on ImageRepository method
      const spy = vi.spyOn(generatedImage.imageRepository, 'getImageStatistics');

      // Act
      const result = await generatedImage.getImageStatistics();

      // Assert
      expect(spy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(1);
    });

    it('should route getImageStatistics through ImageRepository', async () => {
      // Arrange: Insert test data
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'modular-stat-1',
        executionId: 1,
        generationPrompt: 'test 1',
        seed: 123,
        qcStatus: 'approved'
      });

      // Spy on ImageRepository method
      const spy = vi.spyOn(generatedImage.imageRepository, 'getImageStatistics');

      // Act
      const result = await generatedImage.getImageStatistics();

      // Assert
      expect(spy).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(1);
    });

    it('should route updateMetadataById through ImageRepository', async () => {
      // Arrange: Insert test image
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'modular-update-1',
        executionId: 1,
        generationPrompt: 'test',
        seed: 123,
        metadata: { width: 512 }
      });

      // Get image ID
      const allImages = await generatedImage.getAllGeneratedImages();
      const imageId = allImages.images[0].id;

      // Spy on ImageRepository method
      const spy = vi.spyOn(generatedImage.imageRepository, 'updateMetadataById');

      // Act
      const updateResult = await generatedImage.updateMetadataById(imageId, { quality: 95 });

      // Assert
      expect(spy).toHaveBeenCalledWith(imageId, { quality: 95 });
      expect(updateResult.success).toBe(true);
    });

    it('should route bulkDeleteGeneratedImages through ImageRepository', async () => {
      // Arrange: Insert test images
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'modular-delete-1',
        executionId: 1,
        generationPrompt: 'test 1',
        seed: 123
      });

      // Get image IDs
      const allImages = await generatedImage.getAllGeneratedImages();
      const imageIds = allImages.images.map((img: any) => img.id);

      // Spy on ImageRepository method
      const spy = vi.spyOn(generatedImage.imageRepository, 'bulkDeleteGeneratedImages');

      // Act
      const deleteResult = await generatedImage.bulkDeleteGeneratedImages(imageIds);

      // Assert
      expect(spy).toHaveBeenCalledWith(imageIds);
      expect(deleteResult.success).toBe(true);
    });
  });

  describe('Fallback Behavior', () => {
    beforeEach(async () => {
      // Feature flag ON
      process.env.FEATURE_MODULAR_IMAGE_REPOSITORY = 'true';
      
      // Load GeneratedImage
      const module = req('../../../src/database/models/GeneratedImage.js');
      GeneratedImage = module.GeneratedImage;
      generatedImage = new GeneratedImage();
      
      // Override dbPath for testing
      generatedImage.dbPath = testDbPath;
      await generatedImage.init();
    });

    it('should fall back to legacy when ImageRepository.getImageStatistics throws error', async () => {
      // Arrange: Insert test data
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'fallback-test-1',
        executionId: 1,
        generationPrompt: 'test',
        seed: 123
      });

      // Mock ImageRepository to throw error
      vi.spyOn(generatedImage.imageRepository, 'getImageStatistics').mockRejectedValue(
        new Error('Repository error')
      );

      // Act
      const result = await generatedImage.getImageStatistics();

      // Assert: Should still succeed via fallback
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(1);
    });

    it('should fall back to legacy when ImageRepository.updateMetadataById throws error', async () => {
      // Arrange
      await generatedImage.saveGeneratedImage({
        imageMappingId: 'fallback-update-1',
        executionId: 1,
        generationPrompt: 'test',
        seed: 123,
        metadata: { width: 512 }
      });

      // Get image ID
      const allImages = await generatedImage.getAllGeneratedImages();
      const imageId = allImages.images[0].id;

      // Mock ImageRepository to throw error
      vi.spyOn(generatedImage.imageRepository, 'updateMetadataById').mockRejectedValue(
        new Error('Repository error')
      );

      // Act
      const result = await generatedImage.updateMetadataById(imageId, { quality: 95 });

      // Assert: Should still succeed via fallback
      expect(result.success).toBe(true);
    });
  });

  describe('Behavioral Parity (Legacy vs Modular)', () => {
    it('should produce identical results for getImageStatistics in both modes', async () => {
      // Test 1: Legacy mode
      delete process.env.FEATURE_MODULAR_IMAGE_REPOSITORY;
      const legacyModule = req('../../../src/database/models/GeneratedImage.js');
      const legacyInstance = new legacyModule.GeneratedImage();
      const legacyDbPath = path.join(process.cwd(), 'tests', 'integration', `test-legacy-${Date.now()}.db`);
      legacyInstance.dbPath = legacyDbPath;
      await legacyInstance.init();

      await legacyInstance.saveGeneratedImage({
        imageMappingId: 'parity-test-1',
        executionId: 1,
        generationPrompt: 'test prompt',
        seed: 12345,
        qcStatus: 'approved'
      });
      await legacyInstance.saveGeneratedImage({
        imageMappingId: 'parity-test-2',
        executionId: 1,
        generationPrompt: 'test prompt 2',
        seed: 67890,
        qcStatus: 'failed'
      });

      const legacyResult = await legacyInstance.getImageStatistics();

      // Test 2: Modular mode
      process.env.FEATURE_MODULAR_IMAGE_REPOSITORY = 'true';
      delete req.cache[req.resolve('../../../src/database/models/GeneratedImage.js')];
      const modularModule = req('../../../src/database/models/GeneratedImage.js');
      const modularInstance = new modularModule.GeneratedImage();
      const modularDbPath = path.join(process.cwd(), 'tests', 'integration', `test-modular-${Date.now()}.db`);
      modularInstance.dbPath = modularDbPath;
      await modularInstance.init();

      await modularInstance.saveGeneratedImage({
        imageMappingId: 'parity-test-1',
        executionId: 1,
        generationPrompt: 'test prompt',
        seed: 12345,
        qcStatus: 'approved'
      });
      await modularInstance.saveGeneratedImage({
        imageMappingId: 'parity-test-2',
        executionId: 1,
        generationPrompt: 'test prompt 2',
        seed: 67890,
        qcStatus: 'failed'
      });

      const modularResult = await modularInstance.getImageStatistics();

      // Assert: Results should be identical
      expect(legacyResult.success).toBe(modularResult.success);
      expect(legacyResult.statistics.totalImages).toBe(modularResult.statistics.totalImages);
      expect(legacyResult.statistics.approvedImages).toBe(modularResult.statistics.approvedImages);
      expect(legacyResult.statistics.failedImages).toBe(modularResult.statistics.failedImages);

      // Cleanup
      await new Promise<void>((resolve) => {
        legacyInstance.db.close(() => {
          if (fs.existsSync(legacyDbPath)) fs.unlinkSync(legacyDbPath);
          resolve();
        });
      });
      await new Promise<void>((resolve) => {
        modularInstance.db.close(() => {
          if (fs.existsSync(modularDbPath)) fs.unlinkSync(modularDbPath);
          resolve();
        });
      });
    });
  });
});
