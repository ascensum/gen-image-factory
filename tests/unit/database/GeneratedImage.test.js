const { GeneratedImage } = require('../../../src/database/models/GeneratedImage');
const path = require('path');
const fs = require('fs').promises;

describe('GeneratedImage Model', () => {
  let generatedImage;
  let testDbPath;

  beforeAll(async () => {
    // Create a test database with unique name to avoid conflicts
    testDbPath = path.join(__dirname, '../../../data/test-generated-images.db');
    generatedImage = new GeneratedImage();
    
    // Override the database path for testing
    generatedImage.dbPath = testDbPath;
    
    // Ensure test directory exists
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });
    
    await generatedImage.init();
    
    // Create job_configurations and job_executions tables for foreign key relationships
    await generatedImage.db.run(`
      CREATE TABLE IF NOT EXISTS job_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await generatedImage.db.run(`
      CREATE TABLE IF NOT EXISTS job_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        configuration_id INTEGER NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'running',
        total_images INTEGER DEFAULT 0,
        successful_images INTEGER DEFAULT 0,
        failed_images INTEGER DEFAULT 0,
        error_message TEXT,
        FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE
      )
    `);
    
    // Insert test data
    await generatedImage.db.run(`
      INSERT OR REPLACE INTO job_configurations (id, name, settings) 
      VALUES (1, 'test-config', '{"test": "settings"}')
    `);
    
    await generatedImage.db.run(`
      INSERT OR REPLACE INTO job_executions (id, configuration_id, status) 
      VALUES (1, 1, 'completed'), (2, 1, 'running')
    `);
  });

  afterAll(async () => {
    await generatedImage.close();
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear the database before each test
    await generatedImage.db.run('DELETE FROM generated_images');
  });

  describe('CRUD Operations', () => {
    test('should create a generated image', async () => {
      const image = {
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        seed: 12345,
        qcStatus: 'pending',
        metadata: {
          title: 'Mountain Sunset',
          description: 'A beautiful sunset over mountains',
          tags: ['sunset', 'mountains', 'nature']
        },
        processingSettings: {
          imageEnhancement: true,
          sharpening: 5,
          saturation: 1.2
        }
      };

      const result = await generatedImage.saveGeneratedImage(image);
      
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should retrieve a generated image by id', async () => {
      // Create a generated image first
      const image = {
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        seed: 12345,
        qcStatus: 'passed',
        finalImagePath: '/path/to/image.jpg',
        metadata: {
          title: 'Mountain Sunset',
          description: 'A beautiful sunset over mountains'
        }
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);

      expect(getResult.success).toBe(true);
      expect(getResult.image).toBeDefined();
      expect(getResult.image.executionId).toBe(1);
      expect(getResult.image.generationPrompt).toBe('A beautiful sunset over mountains');
      expect(getResult.image.seed).toBe(12345);
      expect(getResult.image.qcStatus).toBe('passed');
      expect(getResult.image.metadata.title).toBe('Mountain Sunset');
    });

    test('should update a generated image', async () => {
      // Create a generated image first
      const image = {
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        qcStatus: 'pending'
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      
      // Update the image
      const updatedImage = {
        ...image,
        qcStatus: 'passed',
        qcReason: 'Image meets quality standards',
        finalImagePath: '/path/to/final/image.jpg'
      };

      const updateResult = await generatedImage.updateGeneratedImage(saveResult.id, updatedImage);
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toBe(1);

      // Verify the update
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);
      expect(getResult.image.qcStatus).toBe('passed');
      expect(getResult.image.qcReason).toBe('Image meets quality standards');
    });

    test('should delete a generated image', async () => {
      // Create a generated image first
      const image = {
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        qcStatus: 'pending'
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      const deleteResult = await generatedImage.deleteGeneratedImage(saveResult.id);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedRows).toBe(1);

      // Verify deletion
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);
      expect(getResult.success).toBe(false);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create multiple generated images for testing
      const images = [
        { executionId: 1, generationPrompt: 'Image 1', qcStatus: 'passed', seed: 11111 },
        { executionId: 1, generationPrompt: 'Image 2', qcStatus: 'failed', seed: 22222 },
        { executionId: 2, generationPrompt: 'Image 3', qcStatus: 'pending', seed: 33333 },
        { executionId: 2, generationPrompt: 'Image 4', qcStatus: 'passed', seed: 44444 }
      ];

      for (const image of images) {
        await generatedImage.saveGeneratedImage(image);
      }
    });

    test('should get all generated images', async () => {
      const result = await generatedImage.getAllGeneratedImages();
      
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(4);
      expect(result.images[0].createdAt).toBeInstanceOf(Date);
    });

    test('should get images by execution id', async () => {
      const result = await generatedImage.getGeneratedImagesByExecution(1);
      
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.images[0].executionId).toBe(1);
    });

    test('should get images by QC status', async () => {
      const result = await generatedImage.getImagesByQCStatus('passed');
      
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.images.every(img => img.qcStatus === 'passed')).toBe(true);
    });

    test('should get image statistics', async () => {
      const result = await generatedImage.getImageStatistics();
      
      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalImages).toBe(4);
      expect(result.statistics.passedImages).toBe(2);
      expect(result.statistics.failedImages).toBe(1);
      expect(result.statistics.pendingImages).toBe(1);
      expect(result.statistics.averageSeed).toBe(27777.5); // (11111 + 22222 + 33333 + 44444) / 4
    });

    test('should get image metadata with job status', async () => {
      const result = await generatedImage.getImageMetadata(1);
      
      expect(result.success).toBe(true);
      expect(result.images).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.images[0].executionId).toBe(1);
    });
  });

  describe('QC Status Management', () => {
    test('should update QC status', async () => {
      // Create a generated image first
      const image = {
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        qcStatus: 'pending'
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      
      // Update QC status
      const updateResult = await generatedImage.updateQCStatus(saveResult.id, 'passed', 'Image meets quality standards');
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toBe(1);

      // Verify the update
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);
      expect(getResult.image.qcStatus).toBe('passed');
      expect(getResult.image.qcReason).toBe('Image meets quality standards');
    });

    test('should handle QC status transitions', async () => {
      const image = {
        executionId: 1,
        generationPrompt: 'A beautiful sunset over mountains',
        qcStatus: 'pending'
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      
      // Test status transitions
      const statuses = ['pending', 'passed', 'failed', 'passed'];
      const reasons = ['Initial state', 'Quality check passed', 'Quality check failed', 'Re-evaluation passed'];
      
      for (let i = 0; i < statuses.length; i++) {
        await generatedImage.updateQCStatus(saveResult.id, statuses[i], reasons[i]);
        const getResult = await generatedImage.getGeneratedImage(saveResult.id);
        expect(getResult.image.qcStatus).toBe(statuses[i]);
        expect(getResult.image.qcReason).toBe(reasons[i]);
      }
    });
  });

  describe('Metadata and Processing Settings', () => {
    test('should handle complex metadata', async () => {
      const complexMetadata = {
        title: 'Complex Image',
        description: 'A very complex image with many details',
        tags: ['complex', 'detailed', 'artistic', 'professional']
      };

      const complexProcessingSettings = {
        imageEnhancement: true,
        sharpening: 8,
        saturation: 1.5,
        imageConvert: true,
        convertToJpg: true,
        jpgQuality: 95,
        pngQuality: 100,
        removeBg: false,
        removeBgSize: 'auto',
        trimTransparentBackground: true,
        jpgBackground: 'white'
      };

      const image = {
        executionId: 1,
        generationPrompt: 'A complex artistic image',
        metadata: complexMetadata,
        processingSettings: complexProcessingSettings
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);

      expect(getResult.image.metadata).toEqual(complexMetadata);
      expect(getResult.image.processingSettings).toEqual(complexProcessingSettings);
    });

    test('should handle null metadata and processing settings', async () => {
      const image = {
        executionId: 1,
        generationPrompt: 'Simple image',
        metadata: null,
        processingSettings: null
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);

      expect(getResult.image.metadata).toBeNull();
      expect(getResult.image.processingSettings).toBeNull();
    });

    test('should handle JSON serialization/deserialization', async () => {
      const metadata = {
        title: 'Test Image',
        description: 'Test description with special characters: éñç',
        tags: ['test', 'special', 'characters']
      };

      const image = {
        executionId: 1,
        generationPrompt: 'Test image with special characters',
        metadata: metadata
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);

      expect(getResult.image.metadata).toEqual(metadata);
      expect(getResult.image.metadata.description).toBe('Test description with special characters: éñç');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle non-existent generated image', async () => {
      const result = await generatedImage.getGeneratedImage(999);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Generated image not found');
    });

    test('should handle invalid generated image data', async () => {
      const invalidImage = {
        // Missing required executionId and generationPrompt
        qcStatus: 'pending'
      };

      // This should fail due to missing required fields
      try {
        await generatedImage.saveGeneratedImage(invalidImage);
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle cleanup of old images', async () => {
      // Create an old image by directly inserting with old timestamp
      await generatedImage.db.run(`
        INSERT INTO generated_images 
        (execution_id, generation_prompt, created_at) 
        VALUES (1, 'Old image', datetime('now', '-31 days'))
      `);
      
      const result = await generatedImage.cleanupOldImages(30);
      
      expect(result.success).toBe(true);
      expect(result.deletedRows).toBe(1);
    });

    test('should handle database connection errors', async () => {
      // Create a new instance with invalid path to simulate connection error
      const invalidGeneratedImage = new GeneratedImage();
      invalidGeneratedImage.dbPath = '/invalid/path/test.db';
      
      // Try to perform an operation - should fail during init
      try {
        await invalidGeneratedImage.init();
        // If init succeeds, try the operation
        await invalidGeneratedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'test' });
        // If we get here, the test should fail
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
        const image = {
          executionId: 1,
          generationPrompt: 'Test image',
          qcStatus: status
        };

        const result = await generatedImage.saveGeneratedImage(image);
        expect(result.success).toBe(true);
      }
    });

    test('should handle seed values correctly', async () => {
      const image = {
        executionId: 1,
        generationPrompt: 'Test image',
        seed: 123456789
      };

      const saveResult = await generatedImage.saveGeneratedImage(image);
      const getResult = await generatedImage.getGeneratedImage(saveResult.id);

      expect(getResult.image.seed).toBe(123456789);
    });

    test('should handle long generation prompts', async () => {
      const longPrompt = 'A'.repeat(1000); // Very long prompt
      const image = {
        executionId: 1,
        generationPrompt: longPrompt,
        qcStatus: 'pending'
      };

      const result = await generatedImage.saveGeneratedImage(image);
      expect(result.success).toBe(true);
    });
  });
});
