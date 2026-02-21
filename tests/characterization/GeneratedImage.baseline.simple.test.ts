/**
 * CHARACTERIZATION TEST: GeneratedImage.js Baseline (Simplified)
 * 
 * Purpose: Capture CURRENT behavior of key GeneratedImage methods BEFORE extraction.
 * Focused on the methods that will be moved to ImageRepository.
 * 
 * CRITICAL: These tests document EXISTING behavior - do NOT "fix" anything.
 * 
 * Related: Story 3.2 Phase 0 Task 0.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import * as fs from 'fs';
import * as path from 'path';

const req = createRequire(import.meta.url);

const BASE_TEST_IMAGES = [
  { imageMappingId: 'smap-1', executionId: 'sexec-1', generationPrompt: 'test 1', seed: 1, qcStatus: 'approved', finalImagePath: '/test/1.png' },
  { imageMappingId: 'smap-2', executionId: 'sexec-1', generationPrompt: 'test 2', seed: 2, qcStatus: 'approved', finalImagePath: '/test/2.png' },
  { imageMappingId: 'smap-3', executionId: 'sexec-2', generationPrompt: 'test 3', seed: 3, qcStatus: 'failed', finalImagePath: '/test/3.png' },
  { imageMappingId: 'smap-4', executionId: 'sexec-2', generationPrompt: 'test 4', seed: 4, qcStatus: 'pending', finalImagePath: '/test/4.png' }
];

describe('GeneratedImage.js Characterization Tests (Baseline - Simplified)', () => {
  let GeneratedImage: any;
  let generatedImage: any;
  let testDbPath: string;

  beforeEach(async () => {
    // createRequire bypasses vi.mock; all instances share data/gen-image-factory.db
    testDbPath = path.join(process.cwd(), 'data', 'gen-image-factory.db');

    delete req.cache[req.resolve('../../src/database/models/GeneratedImage.js')];
    const module = req('../../src/database/models/GeneratedImage.js');
    GeneratedImage = module.GeneratedImage;

    generatedImage = new GeneratedImage();
    await generatedImage.init();

    // Truncate for isolation (shared DB with baseline.test.ts running in parallel)
    await new Promise<void>((resolve) => {
      generatedImage.db.run('DELETE FROM generated_images', () => resolve());
    });
    await new Promise<void>((resolve) => {
      generatedImage.db.run('DELETE FROM job_executions', () => resolve());
    });

    // Insert fresh test data before each test
    for (const img of BASE_TEST_IMAGES) {
      await generatedImage.saveGeneratedImage(img);
    }
  });

  afterEach(async () => {
    if (generatedImage && generatedImage.close) {
      await generatedImage.close();
    }
  });

  it('getImageMetadata() returns images with LEFT JOIN structure', async () => {
    const result = await generatedImage.getImageMetadata('sexec-1');
    
    expect(result.success).toBe(true);
    expect(Array.isArray(result.images)).toBe(true);
    expect(result.images.length).toBe(2);
    
    // Verify data structure
    const img = result.images[0];
    expect(img).toHaveProperty('id');
    expect(img).toHaveProperty('executionId');
    expect(img).toHaveProperty('generationPrompt');
    expect(img).toHaveProperty('seed');
    expect(img).toHaveProperty('qcStatus');
    expect(img).toHaveProperty('finalImagePath');
  });

  it('getImageStatistics() returns correct aggregations', async () => {
    const result = await generatedImage.getImageStatistics();
    
    expect(result.success).toBe(true);
    expect(result.statistics.totalImages).toBeGreaterThanOrEqual(4);
    expect(result.statistics.approvedImages).toBeGreaterThanOrEqual(2);
    expect(result.statistics.failedImages).toBeGreaterThanOrEqual(1);
  });

  it('updateMetadataById() merges JSON metadata', async () => {
    // Get first image ID
    const allResult = await generatedImage.getImageMetadata('sexec-1');
    const imageId = allResult.images[0].id;

    // Update metadata
    const newMeta = { testKey: 'testValue' };
    const updateResult = await generatedImage.updateMetadataById(imageId, newMeta);
    
    expect(updateResult.success).toBe(true);
    expect(updateResult.changes).toBeGreaterThan(0);
  });

  it('bulkDeleteGeneratedImages() deletes multiple records', async () => {
    // Insert test images for deletion
    await generatedImage.saveGeneratedImage({
      imageMappingId: 'bulk-del-1',
      executionId: 'exec-bulk',
      generationPrompt: 'bulk test',
      seed: 999,
      qcStatus: 'pending',
      finalImagePath: '/test/bulk1.png'
    });
    
    await generatedImage.saveGeneratedImage({
      imageMappingId: 'bulk-del-2',
      executionId: 'exec-bulk',
      generationPrompt: 'bulk test',
      seed: 1000,
      qcStatus: 'pending',
      finalImagePath: '/test/bulk2.png'
    });

    // Get their IDs
    const bulkResult = await generatedImage.getImageMetadata('exec-bulk');
    const ids = bulkResult.images.map((img: any) => img.id);

    // Delete
    const deleteResult = await generatedImage.bulkDeleteGeneratedImages(ids);
    
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.deletedRows).toBe(ids.length);
  });
});
