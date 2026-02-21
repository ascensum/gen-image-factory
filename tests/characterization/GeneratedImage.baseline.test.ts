/**
 * CHARACTERIZATION TEST: GeneratedImage.js Baseline
 * 
 * Purpose: Capture CURRENT behavior of GeneratedImage model BEFORE extraction to ImageRepository.
 * This test establishes a behavioral baseline to ensure 1:1 parity during refactoring.
 * 
 * CRITICAL: These tests verify the EXACT current behavior (including quirks).
 * DO NOT modify these tests to "fix" behavior - they document what EXISTS, not what SHOULD exist.
 * 
 * Related: Story 3.2 Phase 0 Task 0.2
 * ADR: ADR-009 (Persistence Repository Layer), ADR-011 (Modular Testing Standard)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import * as fs from 'fs';
import * as path from 'path';

const req = createRequire(import.meta.url);

// Module-level mutable ref so the hoisted vi.mock factory reads the current value at call time
let _currentTestUserDataDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => _currentTestUserDataDir)
  }
}));

describe('GeneratedImage.js Characterization Tests (Baseline)', () => {
  let GeneratedImage: any;
  let generatedImage: any;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a unique directory per test so each test gets its own gen-image-factory.db
    _currentTestUserDataDir = path.join(process.cwd(), 'data', `.test-char-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    testDbPath = path.join(_currentTestUserDataDir, 'gen-image-factory.db');

    // Ensure unique directory exists
    if (!fs.existsSync(_currentTestUserDataDir)) {
      fs.mkdirSync(_currentTestUserDataDir, { recursive: true });
    }

    // Clear module cache and load fresh
    delete req.cache[req.resolve('../../src/database/models/GeneratedImage.js')];
    const module = req('../../src/database/models/GeneratedImage.js');
    GeneratedImage = module.GeneratedImage;

    // Create instance and wait for initialization
    generatedImage = new GeneratedImage();
    await generatedImage.init();

    // createRequire bypasses Vitest mocks so electron mock never applies and all tests
    // share data/gen-image-factory.db. Truncate for isolation.
    await new Promise<void>((resolve, reject) => {
      generatedImage.db.run('DELETE FROM generated_images', (err: Error | null) => {
        if (err) reject(err); else resolve();
      });
    });
    await new Promise<void>((resolve) => {
      generatedImage.db.run('DELETE FROM job_executions', () => resolve());
    });
  });

  afterEach(async () => {
    // Cleanup: close database and delete test file
    if (generatedImage && generatedImage.close) {
      await generatedImage.close();
    }

    // Delete the unique test directory and its contents
    try {
      const testDir = path.dirname(testDbPath);
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('Failed to cleanup test database directory:', e);
    }

    vi.clearAllMocks();
  });

  describe('getImageMetadata() - Complex JOIN query', () => {
    it('should return images with job execution data via LEFT JOIN', async () => {
      // Arrange: Insert test data
      const executionId = 'test-exec-123';
      const imageData = {
        imageMappingId: 'mapping-001',  // Required NOT NULL field
        executionId,
        generationPrompt: 'test prompt',
        seed: 12345,
        qcStatus: 'approved',
        qcReason: null,
        finalImagePath: '/test/path/image.png',
        metadata: JSON.stringify({ width: 1024, height: 1024 }),
        processingSettings: JSON.stringify({ format: 'png' }),
        createdAt: new Date().toISOString()
      };

      await generatedImage.saveGeneratedImage(imageData);

      // Act: Get metadata
      const result = await generatedImage.getImageMetadata(executionId);

      // Assert: Verify structure and data transformation
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(Array.isArray(result.images)).toBe(true);
      expect(result.images.length).toBe(1);

      const image = result.images[0];
      expect(image.id).toBeDefined();  // Auto-generated ID
      expect(typeof image.id).toBe('number');
      expect(image.executionId).toBe(executionId);
      expect(image.generationPrompt).toBe('test prompt');
      expect(image.seed).toBe(12345);
      expect(image.qcStatus).toBe('approved');
      expect(image.finalImagePath).toBe('/test/path/image.png');
      
      // Verify JSON parsing
      expect(image.metadata).toEqual({ width: 1024, height: 1024 });
      expect(image.processingSettings).toEqual({ format: 'png' });
      
      // Verify timestamp conversion
      expect(image.createdAt).toBeInstanceOf(Date);
    });

    it('should return empty array for non-existent executionId', async () => {
      // Act
      const result = await generatedImage.getImageMetadata('non-existent-id');

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toEqual([]);
    });

    it('should handle NULL metadata and processingSettings', async () => {
      // Arrange
      const executionId = 'test-exec-null';
      const imageData = {
        id: 'img-null',
        imageMappingId: 'mapping-null',  // Required NOT NULL field
        executionId,
        generationPrompt: 'test',
        seed: 123,
        qcStatus: 'pending',
        qcReason: null,
        finalImagePath: '/test/null.png',
        metadata: null,
        processingSettings: null,
        createdAt: new Date().toISOString()
      };

      await generatedImage.saveGeneratedImage(imageData);

      // Act
      const result = await generatedImage.getImageMetadata(executionId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.images[0].metadata).toBeNull();
      expect(result.images[0].processingSettings).toBeNull();
    });
  });

  describe('getImageStatistics() - Aggregation query', () => {
    it('should return correct statistics with COUNT and SUM aggregations', async () => {
      // Arrange: Insert multiple images with different QC statuses
      const images = [
        { id: 'img-1', imageMappingId: 'map-1', executionId: 'exec-1', qcStatus: 'approved', generationPrompt: 'test', seed: 1, finalImagePath: '/test/1.png' },
        { id: 'img-2', imageMappingId: 'map-2', executionId: 'exec-1', qcStatus: 'approved', generationPrompt: 'test', seed: 2, finalImagePath: '/test/2.png' },
        { id: 'img-3', imageMappingId: 'map-3', executionId: 'exec-2', qcStatus: 'failed', generationPrompt: 'test', seed: 3, finalImagePath: '/test/3.png' },
        { id: 'img-4', imageMappingId: 'map-4', executionId: 'exec-2', qcStatus: 'pending', generationPrompt: 'test', seed: 4, finalImagePath: '/test/4.png' }
      ];

      for (const img of images) {
        await generatedImage.saveGeneratedImage(img);
      }

      // Act
      const result = await generatedImage.getImageStatistics();

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalImages).toBe(4);
      expect(result.statistics.approvedImages).toBe(2);
      expect(result.statistics.failedImages).toBe(1);
    });

    it('should return zero statistics for empty database', async () => {
      // Act
      const result = await generatedImage.getImageStatistics();

      // Assert
      expect(result.success).toBe(true);
      expect(result.statistics.totalImages).toBe(0);
      expect(result.statistics.approvedImages).toBe(0);
      expect(result.statistics.failedImages).toBe(0);
    });
  });

  describe('updateMetadataById() - JSON merge logic', () => {
    it('should merge new metadata with existing metadata', async () => {
      // Arrange: Insert image with initial metadata - use object (not pre-stringified)
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-merge',
        executionId: 'exec-merge',
        generationPrompt: 'test',
        seed: 123,
        qcStatus: 'pending',
        finalImagePath: '/test/merge.png',
        metadata: { width: 512, height: 512, format: 'png' }
      });
      const imageId = saveResult.id; // auto-generated integer id (saveGeneratedImage returns { success, id })

      // Act: Update with partial metadata
      const newMetadata = { width: 1024, quality: 95 };
      const result = await generatedImage.updateMetadataById(imageId, newMetadata);

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      // Verify merged metadata (getGeneratedImage already parses metadata)
      const imageResult = await generatedImage.getGeneratedImage(imageId);
      expect(imageResult.success).toBe(true);
      const metadata = imageResult.image.metadata;
      expect(metadata).toEqual({
        width: 1024,      // Updated
        height: 512,      // Preserved
        format: 'png',    // Preserved
        quality: 95       // Added
      });
    });

    it('should handle NULL existing metadata', async () => {
      // Arrange
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-null-meta',
        executionId: 'exec-null',
        generationPrompt: 'test',
        seed: 456,
        qcStatus: 'pending',
        finalImagePath: '/test/null-meta.png',
        metadata: null
      });
      const imageId = saveResult.id; // auto-generated integer id

      // Act
      const newMetadata = { quality: 90 };
      const result = await generatedImage.updateMetadataById(imageId, newMetadata);

      // Assert
      expect(result.success).toBe(true);
      const imageResult = await generatedImage.getGeneratedImage(imageId);
      const metadata = imageResult.image.metadata; // already parsed by getGeneratedImage
      expect(metadata).toEqual({ quality: 90 });
    });

    it('should handle non-existent image ID gracefully', async () => {
      // Act & Assert: Should not throw, but may return success: false
      const result = await generatedImage.updateMetadataById('non-existent', { test: 'value' });
      
      // Note: Current implementation may succeed with 0 changes
      expect(result.changes).toBe(0);
    });
  });

  describe('bulkDeleteGeneratedImages() - Batch operations', () => {
    it('should delete multiple images and return correct counts', async () => {
      // Arrange: Insert multiple images and collect auto-generated integer IDs
      const imageIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const saveResult = await generatedImage.saveGeneratedImage({
          imageMappingId: `map-bulk-${i}`,
          executionId: 'exec-bulk',
          generationPrompt: 'test',
          seed: 123,
          qcStatus: 'pending',
          finalImagePath: `/test/bulk-${i}.png`
        });
        imageIds.push(saveResult.id); // auto-generated integer id
      }

      // Act
      const result = await generatedImage.bulkDeleteGeneratedImages(imageIds);

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(3);
      expect(result.totalImages).toBe(3);

      // Verify images are deleted
      for (const id of imageIds) {
        const getResult = await generatedImage.getGeneratedImage(id);
        expect(getResult.success).toBe(false);
      }
    });

    it('should handle empty array input', async () => {
      // Act
      const result = await generatedImage.bulkDeleteGeneratedImages([]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No image IDs provided');
    });

    it('should handle non-array input', async () => {
      // Act
      const result = await generatedImage.bulkDeleteGeneratedImages(null as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No image IDs provided');
    });
  });

  describe('CRUD Operations - Baseline behavior', () => {
    it('saveGeneratedImage() should insert and return success', async () => {
      // Arrange
      const imageData = {
        id: 'crud-save',
        imageMappingId: 'map-crud-save',
        executionId: 'exec-crud',
        generationPrompt: 'test prompt',
        seed: 789,
        qcStatus: 'pending',
        finalImagePath: '/test/crud.png'
      };

      // Act
      const result = await generatedImage.saveGeneratedImage(imageData);

      // Assert
      expect(result.success).toBe(true);
    });

    it('getGeneratedImage() should retrieve by ID', async () => {
      // Arrange: save and capture auto-generated integer id
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-crud-get',
        executionId: 'exec-get',
        generationPrompt: 'test',
        seed: 111,
        qcStatus: 'approved',
        finalImagePath: '/test/get.png'
      });
      const imageId = saveResult.id; // auto-generated integer id

      // Act
      const result = await generatedImage.getGeneratedImage(imageId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.image).toBeDefined();
      expect(result.image.id).toBe(imageId);
      expect(result.image.qcStatus).toBe('approved');
    });

    it('updateGeneratedImage() should modify existing record', async () => {
      // Arrange: save and capture auto-generated integer id
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-crud-update',
        executionId: 'exec-update',
        generationPrompt: 'original',
        seed: 222,
        qcStatus: 'pending',
        finalImagePath: '/test/update.png'
      });
      const imageId = saveResult.id; // auto-generated integer id

      // Act: updateGeneratedImage requires all fields (full update, not partial)
      const updateData = {
        executionId: 'exec-update',
        generationPrompt: 'original',
        seed: 222,
        qcStatus: 'approved',
        qcReason: 'looks good',
        finalImagePath: '/test/update.png'
      };
      const result = await generatedImage.updateGeneratedImage(imageId, updateData);

      // Assert
      expect(result.success).toBe(true);
      
      const getResult = await generatedImage.getGeneratedImage(imageId);
      expect(getResult.image.qcStatus).toBe('approved');
      expect(getResult.image.qcReason).toBe('looks good');
    });

    it('deleteGeneratedImage() should remove record', async () => {
      // Arrange: save and capture auto-generated integer id
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-crud-delete',
        executionId: 'exec-delete',
        generationPrompt: 'test',
        seed: 333,
        qcStatus: 'pending',
        finalImagePath: '/test/delete.png'
      });
      const imageId = saveResult.id; // auto-generated integer id

      // Act
      const result = await generatedImage.deleteGeneratedImage(imageId);

      // Assert
      expect(result.success).toBe(true);
      
      const getResult = await generatedImage.getGeneratedImage(imageId);
      expect(getResult.success).toBe(false);
    });
  });

  describe('Edge Cases - NULL values, invalid IDs, orphaned records', () => {
    it('should handle image with all NULL optional fields', async () => {
      // Arrange: save and capture auto-generated integer id
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-edge-null',
        executionId: 'exec-edge',
        generationPrompt: 'test',
        seed: 444,
        qcStatus: 'pending',
        qcReason: null,
        finalImagePath: null,
        tempImagePath: null,
        metadata: null,
        processingSettings: null
      });
      const imageId = saveResult.id; // auto-generated integer id

      // Act
      const getResult = await generatedImage.getGeneratedImage(imageId);

      // Assert (getGeneratedImage returns camelCase fields)
      expect(saveResult.success).toBe(true);
      expect(getResult.success).toBe(true);
      expect(getResult.image.qcReason).toBeNull();
      expect(getResult.image.finalImagePath).toBeNull();
      expect(getResult.image.metadata).toBeNull();
    });

    it('should return success: false for non-existent image ID', async () => {
      // Act: use a very large integer that won't exist
      const result = await generatedImage.getGeneratedImage(999999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle orphaned images (executionId with no job_execution)', async () => {
      // Arrange: Insert image with non-existent executionId
      const saveResult = await generatedImage.saveGeneratedImage({
        imageMappingId: 'map-orphan',
        executionId: 'non-existent-exec',
        generationPrompt: 'test',
        seed: 555,
        qcStatus: 'pending',
        finalImagePath: '/test/orphan.png'
      });
      const imageId = saveResult.id; // auto-generated integer id

      // Act: getImageMetadata should still work (LEFT JOIN)
      const result = await generatedImage.getImageMetadata('non-existent-exec');

      // Assert: Image is returned even though job_execution doesn't exist
      expect(result.success).toBe(true);
      expect(result.images.length).toBe(1);
      expect(result.images[0].id).toBe(imageId); // auto-generated integer id
      // configuration_id and job_status will be NULL from LEFT JOIN
    });
  });
});
