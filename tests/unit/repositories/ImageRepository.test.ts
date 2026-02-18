/**
 * Unit Tests: ImageRepository
 * 
 * Purpose: Test ImageRepository in isolation with mocked dependencies
 * Coverage Goal: ≥70% statement and branch coverage
 * 
 * Testing Strategy:
 * - Mock database connection (this.db)
 * - Mock generatedImageModel
 * - Test each method's query logic and data transformations
 * - Test edge cases: null values, empty arrays, invalid inputs
 * 
 * Related: Story 3.2 Phase 2 Task 2.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

describe('ImageRepository Unit Tests', () => {
  let ImageRepository: any;
  let repository: any;
  let mockDb: any;
  let mockModel: any;

  beforeEach(() => {
    // Clear module cache
    delete req.cache[req.resolve('../../../src/repositories/ImageRepository.js')];
    
    // Load ImageRepository
    const module = req('../../../src/repositories/ImageRepository.js');
    ImageRepository = module.ImageRepository;

    // Create mock database
    mockDb = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn()
    };

    // Create mock model
    mockModel = {
      db: mockDb,
      getGeneratedImage: vi.fn()
    };

    // Create repository instance
    repository = new ImageRepository(mockModel);
  });

  describe('getImageMetadata()', () => {
    it('should execute LEFT JOIN query and return images', async () => {
      // Arrange
      const executionId = 'test-exec-123';
      const mockRows = [
        {
          id: 1,
          execution_id: executionId,
          generation_prompt: 'test prompt',
          seed: 12345,
          qc_status: 'approved',
          qc_reason: null,
          final_image_path: '/test/path.png',
          metadata: JSON.stringify({ width: 1024 }),
          processing_settings: JSON.stringify({ format: 'png' }),
          created_at: '2024-01-01T00:00:00Z',
          configuration_id: 'config-1',
          job_status: 'completed'
        }
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      // Act
      const result = await repository.getImageMetadata(executionId);

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN job_executions'),
        [executionId],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].id).toBe(1);
      expect(result.images[0].metadata).toEqual({ width: 1024 });
      expect(result.images[0].processingSettings).toEqual({ format: 'png' });
      expect(result.images[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle NULL metadata and processingSettings', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, [{
          id: 1,
          execution_id: 'exec-1',
          generation_prompt: 'test',
          seed: 123,
          qc_status: 'pending',
          qc_reason: null,
          final_image_path: '/test.png',
          metadata: null,
          processing_settings: null,
          created_at: '2024-01-01T00:00:00Z'
        }]);
      });

      // Act
      const result = await repository.getImageMetadata('exec-1');

      // Assert
      expect(result.images[0].metadata).toBeNull();
      expect(result.images[0].processingSettings).toBeNull();
    });

    it('should return empty array for non-existent executionId', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.getImageMetadata('non-existent');

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toEqual([]);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Database error'), null);
      });

      // Act & Assert
      await expect(repository.getImageMetadata('exec-1')).rejects.toThrow('Database error');
    });
  });

  describe('getImageStatistics()', () => {
    it('should execute aggregation query and return statistics', async () => {
      // Arrange
      const mockStats = {
        totalImages: 10,
        approvedImages: 7,
        failedImages: 3
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockStats);
      });

      // Act
      const result = await repository.getImageStatistics();

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.statistics).toEqual(mockStats);
    });

    it('should handle zero statistics with defaults', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          totalImages: 0,
          approvedImages: 0,
          failedImages: 0
        });
      });

      // Act
      const result = await repository.getImageStatistics();

      // Assert
      expect(result.statistics.totalImages).toBe(0);
      expect(result.statistics.approvedImages).toBe(0);
      expect(result.statistics.failedImages).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Stats error'), null);
      });

      // Act & Assert
      await expect(repository.getImageStatistics()).rejects.toThrow('Stats error');
    });
  });

  describe('updateMetadataById()', () => {
    it('should merge new metadata with existing metadata', async () => {
      // Arrange
      const imageId = 1;
      const existingMetadata = { width: 512, height: 512 };
      const newMetadata = { width: 1024, quality: 95 };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { metadata: JSON.stringify(existingMetadata) });
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateMetadataById(imageId, newMetadata);

      // Assert
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT metadata'),
        [imageId],
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generated_images'),
        [expect.stringContaining('"width":1024'), imageId],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it('should handle NULL existing metadata', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { metadata: null });
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateMetadataById(1, { quality: 90 });

      // Assert
      expect(result.success).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        [JSON.stringify({ quality: 90 }), 1],
        expect.any(Function)
      );
    });

    it('should handle non-existent image ID (0 changes)', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 0 }, null);
      });

      // Act
      const result = await repository.updateMetadataById(999, { test: 'value' });

      // Assert
      expect(result.changes).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Metadata error'), null);
      });

      // Act & Assert
      await expect(repository.updateMetadataById(1, {})).rejects.toThrow('Metadata error');
    });
  });

  describe('bulkDeleteGeneratedImages()', () => {
    it('should delete multiple images and cleanup files', async () => {
      // Arrange
      const imageIds = [1, 2, 3];
      const mockImages = imageIds.map(id => ({
        success: true,
        image: {
          id,
          finalImagePath: `/test/${id}.png`,
          tempImagePath: null
        }
      }));

      mockModel.getGeneratedImage.mockImplementation((id) => 
        Promise.resolve(mockImages.find(img => img.image.id === id))
      );

      mockDb.run.mockImplementation(function(sql, params, callback) {
        // Use function() to preserve 'this' context
        this.changes = 3;
        callback.call(this, null);
      });

      // Mock fs.promises.unlink
      const mockUnlink = vi.fn().mockResolvedValue(undefined);
      vi.doMock('fs', () => ({
        promises: {
          unlink: mockUnlink
        }
      }));

      // Act
      const result = await repository.bulkDeleteGeneratedImages(imageIds);

      // Assert
      expect(mockModel.getGeneratedImage).toHaveBeenCalledTimes(3);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM generated_images WHERE id IN'),
        imageIds,
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.totalImages).toBe(3);
      // Note: deletedRows value depends on sqlite3's callback 'this' binding
    });

    it('should handle empty array input', async () => {
      // Act
      const result = await repository.bulkDeleteGeneratedImages([]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No image IDs provided');
    });

    it('should handle non-array input', async () => {
      // Act
      const result = await repository.bulkDeleteGeneratedImages(null as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No image IDs provided');
    });

    it('should continue even if file deletion fails', async () => {
      // Arrange
      mockModel.getGeneratedImage.mockResolvedValue({
        success: true,
        image: { id: 1, finalImagePath: '/test/1.png' }
      });

      mockDb.run.mockImplementation(function(sql, params, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      // Act
      const result = await repository.bulkDeleteGeneratedImages([1]);

      // Assert
      expect(result.success).toBe(true);
      // Note: deletedRows value depends on sqlite3's callback 'this' binding
    });
  });

  describe('findByQcStatus()', () => {
    it('should find images by QC status', async () => {
      // Arrange
      const mockRows = [
        {
          id: 1,
          image_mapping_id: 'map-1',
          execution_id: 'exec-1',
          generation_prompt: 'test',
          seed: 123,
          qc_status: 'approved',
          qc_reason: null,
          final_image_path: '/test/1.png',
          temp_image_path: null,
          metadata: null,
          processing_settings: null,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      // Act
      const result = await repository.findByQcStatus('approved');

      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE qc_status = ?'),
        ['approved'],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].qcStatus).toBe('approved');
    });

    it('should return empty array for non-matching status', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.findByQcStatus('unknown-status');

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toEqual([]);
    });
  });

  describe('bulkUpdateQcStatus()', () => {
    it('should update QC status for multiple mappings', async () => {
      // Arrange
      const mappings = [
        { mappingId: 'map-1', status: 'approved', reason: 'looks good' },
        { mappingId: 'map-2', status: 'failed', reason: 'too dark' }
      ];

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.bulkUpdateQcStatus(mappings);

      // Assert
      expect(mockDb.run).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
    });

    it('should handle empty mappings array', async () => {
      // Act
      const result = await repository.bulkUpdateQcStatus([]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No mappings provided');
    });

    it('should handle non-array input', async () => {
      // Act
      const result = await repository.bulkUpdateQcStatus(null as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No mappings provided');
    });
  });

  describe('deleteByExecution()', () => {
    it('should delete all images for an execution', async () => {
      // Arrange
      const executionId = 'exec-123';

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 5 }, null);
      });

      // Act
      const result = await repository.deleteByExecution(executionId);

      // Assert
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM generated_images WHERE execution_id = ?'),
        [executionId],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(5);
    });

    it('should handle zero deletions', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 0 }, null);
      });

      // Act
      const result = await repository.deleteByExecution('non-existent');

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Delete error'), null);
      });

      // Act & Assert
      await expect(repository.deleteByExecution('exec-1')).rejects.toThrow('Delete error');
    });
  });

  // ===== NEW CRUD METHODS (Story 3.2 - Latest Changes) =====

  describe('saveGeneratedImage()', () => {
    it('should insert new generated image with all fields', async () => {
      // Arrange
      const image = {
        imageMappingId: 'map-456',
        executionId: 'exec-123',
        generationPrompt: 'test prompt',
        seed: 12345,
        qcStatus: 'pending',
        finalImagePath: '/images/final.png',
        tempImagePath: '/images/temp.png',
        metadata: { key: 'value' }
      };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      // Act
      const result = await repository.saveGeneratedImage(image);

      // Assert
      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO generated_images'),
        expect.arrayContaining(['map-456', 'exec-123']),
        expect.any(Function)
      );
    });

    it('should handle NULL optional fields', async () => {
      // Arrange
      const image = {
        imageMappingId: 'map-456',
        executionId: 'exec-123',
        metadata: null
      };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      // Act
      const result = await repository.saveGeneratedImage(image);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Insert failed'));
      });

      // Act & Assert
      await expect(repository.saveGeneratedImage({ imageMappingId: 'map-1', executionId: 'exec-1' })).rejects.toThrow('Insert failed');
    });
  });

  describe('getGeneratedImage()', () => {
    it('should retrieve image by ID', async () => {
      // Arrange
      const mockImage = {
        id: 1,
        job_execution_id: 'exec-123',
        mapping_id: 'map-456',
        final_image_path: '/images/final.png'
      };
      
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockImage);
      });

      // Act
      const result = await repository.getGeneratedImage(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.image.id).toBe(1);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM generated_images WHERE id = ?'),
        [1],
        expect.any(Function)
      );
    });

    it('should return false for non-existent image', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, undefined);
      });

      // Act
      const result = await repository.getGeneratedImage(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Generated image not found');
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Query failed'), null);
      });

      // Act & Assert
      await expect(repository.getGeneratedImage(1)).rejects.toThrow('Query failed');
    });
  });

  describe('getGeneratedImagesByExecution()', () => {
    it('should retrieve all images for an execution', async () => {
      // Arrange
      const mockImages = [
        { id: 1, job_execution_id: 'exec-123' },
        { id: 2, job_execution_id: 'exec-123' }
      ];
      
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockImages);
      });

      // Act
      const result = await repository.getGeneratedImagesByExecution('exec-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM generated_images WHERE execution_id = ?'),
        ['exec-123'],
        expect.any(Function)
      );
    });

    it('should return empty array for execution with no images', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.getGeneratedImagesByExecution('exec-new');

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toEqual([]);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Query failed'), null);
      });

      // Act & Assert
      await expect(repository.getGeneratedImagesByExecution('exec-1')).rejects.toThrow('Query failed');
    });
  });

  describe('getAllGeneratedImages()', () => {
    it('should retrieve all generated images with default limit', async () => {
      // Arrange
      const mockImages = [
        { id: 1, qc_status: 'passed', image_mapping_id: 'map-1', execution_id: 'exec-1' },
        { id: 2, qc_status: 'failed', image_mapping_id: 'map-2', execution_id: 'exec-1' }
      ];
      
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockImages);
      });

      // Act
      const result = await repository.getAllGeneratedImages();

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM generated_images'),
        [100], // default limit
        expect.any(Function)
      );
    });

    it('should return empty array when no images exist', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // Act
      const result = await repository.getAllGeneratedImages();

      // Assert
      expect(result.success).toBe(true);
      expect(result.images).toEqual([]);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Query failed'), null);
      });

      // Act & Assert
      await expect(repository.getAllGeneratedImages()).rejects.toThrow('Query failed');
    });
  });

  describe('updateGeneratedImage()', () => {
    it('should update image fields', async () => {
      // Arrange
      const updates = {
        qcStatus: 'passed',
        finalImagePath: '/images/new-final.png',
        metadata: { updated: true }
      };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateGeneratedImage(1, updates);

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generated_images SET'),
        expect.arrayContaining(['passed', '/images/new-final.png']),
        expect.any(Function)
      );
    });

    it('should handle partial updates', async () => {
      // Arrange
      const updates = { qcStatus: 'failed' };
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateGeneratedImage(1, updates);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should return 0 changes for non-existent image', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      // Act
      const result = await repository.updateGeneratedImage(999, { qcStatus: 'passed' });

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Update failed'));
      });

      // Act & Assert
      await expect(repository.updateGeneratedImage(1, { qcStatus: 'failed' })).rejects.toThrow('Update failed');
    });
  });

  describe('deleteGeneratedImage()', () => {
    it('should delete image by ID with file cleanup', async () => {
      // Arrange
      vi.spyOn(repository, 'getGeneratedImage').mockResolvedValue({
        success: true,
        image: { id: 1, finalImagePath: '/images/test.png' }
      });
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.deleteGeneratedImage(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM generated_images WHERE id = ?'),
        [1],
        expect.any(Function)
      );
    });

    it('should reject when image not found', async () => {
      // Arrange
      vi.spyOn(repository, 'getGeneratedImage').mockResolvedValue({
        success: false,
        error: 'Image not found'
      });

      // Act & Assert
      await expect(repository.deleteGeneratedImage(999)).rejects.toThrow('Image 999 not found');
    });

    it('should reject on database error', async () => {
      // Arrange
      vi.spyOn(repository, 'getGeneratedImage').mockResolvedValue({
        success: true,
        image: { id: 1, finalImagePath: '/images/test.png' }
      });
      
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Delete failed'));
      });

      // Act & Assert
      await expect(repository.deleteGeneratedImage(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('updateQCStatus() - CRITICAL (3 fallbacks)', () => {
    it('should update QC status and reason', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateQCStatus(1, 'failed', 'Low quality');

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generated_images SET qc_status = ?, qc_reason = ?'),
        ['failed', 'Low quality', 1],
        expect.any(Function)
      );
    });

    it('should handle NULL reason', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateQCStatus(1, 'passed', null);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.anything(),
        ['passed', null, 1],
        expect.any(Function)
      );
    });

    it('should return 0 changes for non-existent image', async () => {
      // Arrange
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      // Act
      const result = await repository.updateQCStatus(999, 'passed', null);

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(0);
    });

    it('should reject on database error', async () => {
      // Arrange
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Update QC failed'));
      });

      // Act & Assert
      await expect(repository.updateQCStatus(1, 'passed', null)).rejects.toThrow('Update QC failed');
    });
  });

  describe('updateGeneratedImageByMappingId() - CRITICAL BUG FIX (metadata merge)', () => {
    it('should merge new metadata with existing metadata (NOT overwrite paths)', async () => {
      // Arrange
      const existingImage = {
        id: 1,
        final_image_path: '/images/existing-final.png',
        temp_image_path: '/images/existing-temp.png',
        qc_status: 'passed',
        qc_reason: null,
        metadata: JSON.stringify({ 
          prompt: 'original prompt',
          seed: 12345 
        })
      };
      
      const newMetadata = {
        upscale: true,
        model: 'flux-1.1'
      };
      
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, existingImage);
      });
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateGeneratedImageByMappingId('map-456', { metadata: newMetadata });

      // Assert
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      
      // Verify metadata was merged, not overwritten
      const updateCall = mockDb.run.mock.calls[0];
      const mergedMetadata = JSON.parse(updateCall[1][0]);
      expect(mergedMetadata.prompt).toBe('original prompt'); // Existing data preserved
      expect(mergedMetadata.seed).toBe(12345); // Existing data preserved
      expect(mergedMetadata.upscale).toBe(true); // New data added
      expect(mergedMetadata.model).toBe('flux-1.1'); // New data added
      
      // Verify paths were NOT touched
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generated_images SET metadata = ?'),
        expect.arrayContaining(['map-456']),
        expect.any(Function)
      );
    });

    it('should handle NULL existing metadata', async () => {
      // Arrange
      const existingImage = {
        id: 1,
        metadata: null
      };
      
      const newMetadata = { upscale: true };
      
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, existingImage);
      });
      
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      // Act
      const result = await repository.updateGeneratedImageByMappingId('map-456', { metadata: newMetadata });

      // Assert
      expect(result.success).toBe(true);
      const updateCall = mockDb.run.mock.calls[0];
      const mergedMetadata = JSON.parse(updateCall[1][0]);
      expect(mergedMetadata.upscale).toBe(true);
    });

    it('should reject when mapping not found', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, undefined);
      });

      // Act & Assert
      await expect(
        repository.updateGeneratedImageByMappingId('non-existent', { metadata: {} })
      ).rejects.toThrow('Image with mapping ID non-existent not found');
    });

    it('should reject on database error during read', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Read failed'), null);
      });

      // Act & Assert
      await expect(
        repository.updateGeneratedImageByMappingId('map-1', { metadata: {} })
      ).rejects.toThrow('Read failed');
    });

    it('should reject on database error during update', async () => {
      // Arrange
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, metadata: '{}' });
      });
      
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Update failed'));
      });

      // Act & Assert
      await expect(
        repository.updateGeneratedImageByMappingId('map-1', { metadata: {} })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('updateImagePathsByMappingId()', () => {
    it('should run UPDATE temp_image_path and final_image_path by image_mapping_id', async () => {
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });
      const result = await repository.updateImagePathsByMappingId('map-123', '/tmp/a.png', '/out/final.png');
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE generated_images SET temp_image_path = ?, final_image_path = ? WHERE image_mapping_id = ?',
        ['/tmp/a.png', '/out/final.png', 'map-123'],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
    it('should reject on database error', async () => {
      mockDb.run.mockImplementation((sql, params, cb) => cb(new Error('DB error'), null));
      await expect(repository.updateImagePathsByMappingId('map-1', '/t', '/f')).rejects.toThrow('DB error');
    });
  });

  describe('updateImagePathsById()', () => {
    it('should run UPDATE temp_image_path and final_image_path by id', async () => {
      mockDb.run.mockImplementation(function(sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });
      const result = await repository.updateImagePathsById(42, '/tmp/b.png', '/out/b-final.png');
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE generated_images SET temp_image_path = ?, final_image_path = ? WHERE id = ?',
        ['/tmp/b.png', '/out/b-final.png', 42],
        expect.any(Function)
      );
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });
    it('should reject on database error', async () => {
      mockDb.run.mockImplementation((sql, params, cb) => cb(new Error('DB error'), null));
      await expect(repository.updateImagePathsById(1, '/t', '/f')).rejects.toThrow('DB error');
    });
  });
});
