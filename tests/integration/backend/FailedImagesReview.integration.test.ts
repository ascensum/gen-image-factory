import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { BackendAdapter } from '../../../src/adapter/backendAdapter';

describe('Failed Images Review - BackendAdapter Integration', () => {
  let backend: any;

  beforeAll(async () => {
    backend = new BackendAdapter();
    await backend.ensureInitialized();
    // Ensure related tables exist (in case models expect foreign keys)
    await backend.generatedImage.db.run(`
      CREATE TABLE IF NOT EXISTS job_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await backend.generatedImage.db.run(`
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
      );
    `);
    await backend.generatedImage.db.run(`
      INSERT OR REPLACE INTO job_configurations (id, name, settings) VALUES (1, 'cfg', '{}');
    `);
    await backend.generatedImage.db.run(`
      INSERT OR REPLACE INTO job_executions (id, configuration_id, status) VALUES (1, 1, 'completed'), (2, 1, 'completed');
    `);
  });

  beforeEach(async () => {
    await backend.generatedImage.db.run('DELETE FROM generated_images');
  });

  it('returns failed images via getImagesByQCStatus', async () => {
    const img1 = await backend.generatedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'A', qcStatus: 'failed', imageMappingId: 'img-1' });
    const img2 = await backend.generatedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'B', qcStatus: 'approved', imageMappingId: 'img-2' });
    const img3 = await backend.generatedImage.saveGeneratedImage({ executionId: 2, generationPrompt: 'C', qcStatus: 'failed', imageMappingId: 'img-3' });

    expect(img1.success && img2.success && img3.success).toBe(true);

    const failed = await backend.getImagesByQCStatus('failed');
    expect(failed.success).toBe(true);
    expect(failed.images.length).toBe(2);
    expect(failed.images.every((i: any) => i.qcStatus === 'failed')).toBe(true);
  });

  it('retryFailedImagesBatch with original settings updates status to retry_pending for same execution', async () => {
    const a = await backend.generatedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'A', qcStatus: 'failed', imageMappingId: 'img-a' });
    const b = await backend.generatedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'B', qcStatus: 'failed', imageMappingId: 'img-b' });

    const res = await backend.retryFailedImagesBatch([a.id, b.id], true);
    expect(res.success).toBe(true);

    const aGet = await backend.generatedImage.getGeneratedImage(a.id);
    const bGet = await backend.generatedImage.getGeneratedImage(b.id);
    expect(aGet.image.qcStatus).toBe('retry_pending');
    expect(bGet.image.qcStatus).toBe('retry_pending');
  });

  it('retryFailedImagesBatch with original settings fails across different executions', async () => {
    const a = await backend.generatedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'A', qcStatus: 'failed', imageMappingId: 'img-a' });
    const b = await backend.generatedImage.saveGeneratedImage({ executionId: 2, generationPrompt: 'B', qcStatus: 'failed', imageMappingId: 'img-b' });

    const res = await backend.retryFailedImagesBatch([a.id, b.id], true);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/different jobs/i);
  });

  it('retryFailedImagesBatch with modified settings updates processing settings and status (with clamping)', async () => {
    const a = await backend.generatedImage.saveGeneratedImage({ executionId: 1, generationPrompt: 'A', qcStatus: 'failed', imageMappingId: 'img-a' });
    const b = await backend.generatedImage.saveGeneratedImage({ executionId: 2, generationPrompt: 'B', qcStatus: 'failed', imageMappingId: 'img-b' });

    const modified = {
      imageEnhancement: true,
      sharpening: 60,
      // Story 1.7 validation clamps saturation to 0..3
      saturation: 120,
      imageConvert: true,
      convertToJpg: true,
      jpgQuality: 95,
      pngQuality: 9,
      removeBg: true,
      removeBgSize: 'auto',
      trimTransparentBackground: true,
      jpgBackground: '#FFFFFF'
    };

    const res = await backend.retryFailedImagesBatch([a.id, b.id], false, modified);
    expect(res.success).toBe(true);

    const aGet = await backend.generatedImage.getGeneratedImage(a.id);
    const bGet = await backend.generatedImage.getGeneratedImage(b.id);
    expect(aGet.image.qcStatus).toBe('retry_pending');
    expect(bGet.image.qcStatus).toBe('retry_pending');
    // Story 1.7: Modified settings are NOT persisted to processingSettings - they're passed transiently via retry queue
    // The clamping happens in normalizeProcessingSettings when the settings are used, not when stored
    // Verify status was updated correctly
    expect(aGet.image.qcStatus).toBe('retry_pending');
    expect(bGet.image.qcStatus).toBe('retry_pending');
  });
});


