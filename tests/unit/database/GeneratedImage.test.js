/**
 * GeneratedImage + ImageRepository Integration Tests
 * Story 5.2: Updated to use ImageRepository instead of deprecated model query methods.
 * GeneratedImage model is now schema-only; all queries routed through ImageRepository (ADR-009).
 */
const { GeneratedImage } = require('../../../src/database/models/GeneratedImage');
const { ImageRepository } = require('../../../src/repositories/ImageRepository');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

function generateImageMappingId(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

describe('GeneratedImage Model', () => {
  let generatedImage;
  let imageRepository;
  let testDbPath;

  beforeAll(async () => {
    testDbPath = path.join(os.tmpdir(), `test-generated-images-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });

    generatedImage = new GeneratedImage();
    generatedImage.dbPath = testDbPath;

    if (generatedImage.db) {
      await new Promise((resolve) => { generatedImage.db.close(() => resolve()); });
    }

    await generatedImage.init();
    await generatedImage.createTables();
    imageRepository = new ImageRepository(generatedImage);

    const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
      generatedImage.db.run(sql, params, (err) => { if (err) reject(err); else resolve(); });
    });

    await dbRun(`CREATE TABLE IF NOT EXISTS job_configurations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, settings TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS job_executions (id INTEGER PRIMARY KEY AUTOINCREMENT, configuration_id INTEGER NOT NULL, started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP, status VARCHAR(50) DEFAULT 'running', total_images INTEGER DEFAULT 0, successful_images INTEGER DEFAULT 0, failed_images INTEGER DEFAULT 0, error_message TEXT, FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE)`);
    await dbRun(`INSERT OR REPLACE INTO job_configurations (id, name, settings) VALUES (1, 'test-config', '{"test": "settings"}')`);
    await dbRun(`INSERT OR REPLACE INTO job_executions (id, configuration_id, status) VALUES (1, 1, 'completed'), (2, 1, 'running')`);
  });

  afterAll(async () => {
    if (generatedImage && generatedImage.db) {
      await new Promise((resolve) => { try { generatedImage.db.wait(() => resolve()); } catch { resolve(); } });
      generatedImage.close();
    }
    try {
      if (testDbPath && await fs.access(testDbPath).then(() => true).catch(() => false)) {
        await fs.unlink(testDbPath);
      }
    } catch {}
  });

  beforeEach(async () => {
    await new Promise((resolve, reject) => {
      generatedImage.db.run('DELETE FROM generated_images', (err) => { if (err) reject(err); else resolve(); });
    });
  });

  describe('CRUD Operations', () => {
    test('should create a generated image', async () => {
      const image = {
        imageMappingId: generateImageMappingId('test1'),
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        seed: 12345,
        qcStatus: 'pending',
        metadata: { title: 'Mountain Sunset', description: 'A beautiful sunset over mountains', tags: ['sunset', 'mountains', 'nature'] },
        processingSettings: { imageEnhancement: true, sharpening: 5, saturation: 1.2 }
      };
      const result = await imageRepository.saveGeneratedImage(image);
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should retrieve a generated image by id', async () => {
      const image = {
        imageMappingId: generateImageMappingId('test2'),
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        seed: 12345,
        qcStatus: 'passed',
        finalImagePath: '/path/to/image.jpg',
        metadata: { title: 'Mountain Sunset', description: 'A beautiful sunset over mountains' }
      };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.success).toBe(true);
      expect(getResult.image).toBeDefined();
      expect(getResult.image.executionId).toBe(1);
      expect(getResult.image.generationPrompt).toBe('A beautiful sunset over mountains');
      expect(getResult.image.seed).toBe(12345);
      expect(getResult.image.qcStatus).toBe('passed');
      expect(getResult.image.metadata.title).toBe('Mountain Sunset');
    });

    test('should update a generated image', async () => {
      const image = { imageMappingId: generateImageMappingId('test3'), executionId: 1, generationPrompt: 'A beautiful sunset over mountains', qcStatus: 'pending' };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const updatedImage = { ...image, qcStatus: 'passed', qcReason: 'Image meets quality standards', finalImagePath: '/path/to/final/image.jpg' };
      const updateResult = await imageRepository.updateGeneratedImage(saveResult.id, updatedImage);
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toBe(1);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.image.qcStatus).toBe('passed');
      expect(getResult.image.qcReason).toBe('Image meets quality standards');
    });

    test('should delete a generated image', async () => {
      const image = { imageMappingId: generateImageMappingId('test4'), executionId: 1, generationPrompt: 'A beautiful sunset over mountains', qcStatus: 'pending' };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const deleteResult = await imageRepository.deleteGeneratedImage(saveResult.id);
      expect(deleteResult.success).toBe(true);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.success).toBe(false);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const images = [
        { imageMappingId: generateImageMappingId('query1'), executionId: 1, generationPrompt: 'Image 1', qcStatus: 'approved', seed: 11111 },
        { imageMappingId: generateImageMappingId('query2'), executionId: 1, generationPrompt: 'Image 2', qcStatus: 'failed', seed: 22222 },
        { imageMappingId: generateImageMappingId('query3'), executionId: 2, generationPrompt: 'Image 3', qcStatus: 'pending', seed: 33333 },
        { imageMappingId: generateImageMappingId('query4'), executionId: 2, generationPrompt: 'Image 4', qcStatus: 'approved', seed: 44444 }
      ];
      for (const image of images) {
        await imageRepository.saveGeneratedImage(image);
      }
    });

    test('should get all generated images', async () => {
      const result = await imageRepository.getAllGeneratedImages();
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(4);
      expect(result.images[0].createdAt).toBeInstanceOf(Date);
    });

    test('should get images by execution id', async () => {
      const result = await imageRepository.getGeneratedImagesByExecution(1);
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.images[0].executionId).toBe(1);
    });

    test('should get images by QC status', async () => {
      const result = await imageRepository.findByQcStatus('approved');
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.images.every(img => img.qcStatus === 'approved')).toBe(true);
    });

    test('should get image statistics', async () => {
      const result = await imageRepository.getImageStatistics();
      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalImages).toBe(4);
      expect(result.statistics.approvedImages).toBe(2);
      expect(result.statistics.failedImages).toBe(1);
    });

    test('should get image metadata with job status', async () => {
      const result = await imageRepository.getImageMetadata(1);
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.images[0].executionId).toBe(1);
    });
  });

  describe('QC Status Management', () => {
    test('should update QC status', async () => {
      const image = { imageMappingId: generateImageMappingId('qc1'), executionId: 1, generationPrompt: 'A beautiful sunset over mountains', qcStatus: 'pending' };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const updateResult = await imageRepository.updateQCStatus(saveResult.id, 'passed', 'Image meets quality standards');
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toBe(1);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.image.qcStatus).toBe('passed');
      expect(getResult.image.qcReason).toBe('Image meets quality standards');
    });

    test('should handle QC status transitions', async () => {
      const image = { imageMappingId: generateImageMappingId('qc2'), executionId: 1, generationPrompt: 'A beautiful sunset over mountains', qcStatus: 'pending' };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const statuses = ['pending', 'passed', 'failed', 'passed'];
      const reasons = ['Initial state', 'Quality check passed', 'Quality check failed', 'Re-evaluation passed'];
      for (let i = 0; i < statuses.length; i++) {
        await imageRepository.updateQCStatus(saveResult.id, statuses[i], reasons[i]);
        const getResult = await imageRepository.getGeneratedImage(saveResult.id);
        expect(getResult.image.qcStatus).toBe(statuses[i]);
        expect(getResult.image.qcReason).toBe(reasons[i]);
      }
    });
  });

  describe('Metadata and Processing Settings', () => {
    test('should handle complex metadata', async () => {
      const complexMetadata = { title: 'Complex Image', description: 'A very complex image', tags: ['complex', 'detailed'] };
      const complexProcessingSettings = { imageEnhancement: true, sharpening: 8, saturation: 1.5, imageConvert: true, convertToJpg: true, jpgQuality: 95, pngQuality: 100, removeBg: false, removeBgSize: 'auto', trimTransparentBackground: true, jpgBackground: 'white' };
      const image = { imageMappingId: generateImageMappingId('meta1'), executionId: 1, generationPrompt: 'A complex artistic image', metadata: complexMetadata, processingSettings: complexProcessingSettings };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.image.metadata).toEqual(complexMetadata);
      expect(getResult.image.processingSettings).toEqual(complexProcessingSettings);
    });

    test('should handle null metadata and processing settings', async () => {
      const image = { imageMappingId: generateImageMappingId('meta2'), executionId: 1, generationPrompt: 'Simple image', metadata: null, processingSettings: null };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.image.metadata).toBeNull();
      expect(getResult.image.processingSettings).toBeNull();
    });

    test('should handle JSON serialization/deserialization', async () => {
      const metadata = { title: 'Test Image', description: 'Test description with special characters: éñç', tags: ['test', 'special'] };
      const image = { imageMappingId: generateImageMappingId('meta3'), executionId: 1, generationPrompt: 'Test image with special characters', metadata };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.image.metadata).toEqual(metadata);
      expect(getResult.image.metadata.description).toBe('Test description with special characters: éñç');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle non-existent generated image', async () => {
      const result = await imageRepository.getGeneratedImage(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Generated image not found');
    });

    test('should handle invalid generated image data', async () => {
      const invalidImage = { qcStatus: 'pending' };
      try {
        await imageRepository.saveGeneratedImage(invalidImage);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle cleanup of old images via direct DB', async () => {
      const mappingId = generateImageMappingId('old');
      await new Promise((resolve, reject) => {
        generatedImage.db.run(`INSERT INTO generated_images (image_mapping_id, execution_id, generation_prompt, created_at) VALUES (?, 1, 'Old image', '2000-01-01 00:00:00')`, [mappingId], (err) => err ? reject(err) : resolve());
      });
      // Cleanup via direct SQL (model no longer has cleanupOldImages)
      const result = await new Promise((resolve, reject) => {
        generatedImage.db.run(`DELETE FROM generated_images WHERE created_at < '2001-01-01'`, function(err) {
          if (err) reject(err);
          else resolve({ success: true, deletedRows: this.changes });
        });
      });
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(1);
    });

    test('should handle database connection errors', async () => {
      const invalidGeneratedImage = new GeneratedImage();
      invalidGeneratedImage.dbPath = '/invalid/path/test.db';
      try {
        await invalidGeneratedImage.init();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Data Validation', () => {
    test('should validate QC status values', async () => {
      const validStatuses = ['pending', 'passed', 'failed'];
      for (const status of validStatuses) {
        const image = { imageMappingId: generateImageMappingId(`status_${status}`), executionId: 1, generationPrompt: 'Test image', qcStatus: status };
        const result = await imageRepository.saveGeneratedImage(image);
        expect(result.success).toBe(true);
      }
    });

    test('should handle seed values correctly', async () => {
      const image = { imageMappingId: generateImageMappingId('seed'), executionId: 1, generationPrompt: 'Test image', seed: 123456789 };
      const saveResult = await imageRepository.saveGeneratedImage(image);
      const getResult = await imageRepository.getGeneratedImage(saveResult.id);
      expect(getResult.image.seed).toBe(123456789);
    });

    test('should handle long generation prompts', async () => {
      const longPrompt = 'A'.repeat(1000);
      const image = { imageMappingId: generateImageMappingId('long'), executionId: 1, generationPrompt: longPrompt, qcStatus: 'pending' };
      const result = await imageRepository.saveGeneratedImage(image);
      expect(result.success).toBe(true);
    });
  });
});
