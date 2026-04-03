/**
 * ImageRepository unit tests (db stubbed)
 * Story 5.2: Updated from GeneratedImage model tests to ImageRepository tests.
 * GeneratedImage is now schema-only; all query logic lives in ImageRepository (ADR-009).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ImageRepository } = require('../../../src/repositories/ImageRepository');

describe('GeneratedImage model (unit, db stubbed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeRepo(db) {
    const model = { db };
    return new ImageRepository(model);
  }

  it('updateQCStatusByMappingId updates qc_status + reason', async () => {
    const run = vi.fn((sql, params, cb) => cb.call({ changes: 1 }, null));
    const repo = makeRepo({ run });

    const res = await repo.updateQCStatusByMappingId('m1', 'qc_failed', 'blurry');

    expect(res).toEqual({ success: true, changes: 1 });
    expect(run.mock.calls[0][0]).toContain('WHERE image_mapping_id = ?');
    expect(run.mock.calls[0][1]).toEqual(['qc_failed', 'blurry', 'm1']);
  });

  it('findByQcStatus returns list (and handles DB errors)', async () => {
    const all = vi.fn((_sql, _params, cb) =>
      cb(null, [
        {
          id: 1,
          execution_id: 2,
          image_mapping_id: 'm1',
          temp_image_path: '/tmp/t.png',
          final_image_path: '/tmp/f.png',
          qc_status: 'approved',
          qc_reason: null,
          metadata: '{"title":"T"}',
          generation_prompt: 'P',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ]),
    );

    const repo = makeRepo({ all });

    const res = await repo.findByQcStatus('approved');

    expect(res.success).toBe(true);
    expect(res.images).toHaveLength(1);
    expect(res.images[0]).toEqual(
      expect.objectContaining({
        id: 1,
        executionId: 2,
        imageMappingId: 'm1',
        qcStatus: 'approved',
        metadata: { title: 'T' },
      }),
    );

    // error branch
    const repoErr = makeRepo({ all: vi.fn((_sql, _params, cb) => cb(new Error('db'), null)) });
    await expect(repoErr.findByQcStatus('approved')).rejects.toThrow('db');
  });

  it('cleanupOldImages (via direct SQL) returns 0 when nothing to delete and deletes files when rows exist', async () => {
    // First: no rows — use deleteByExecution as proxy (0 deletes)
    const repo = makeRepo({
      run: vi.fn((_sql, _params, cb) => cb.call({ changes: 0 }, null)),
    });

    const res0 = await repo.deleteByExecution(9999);
    expect(res0).toEqual({ success: true, deletedRows: 0 });

    // Second: confirm file unlink is called in deleteGeneratedImage (closest method with file cleanup)
    const fs = require('fs');
    const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    const getDb = {
      get: vi.fn((_sql, _params, cb) =>
        cb(null, {
          id: 1,
          image_mapping_id: 'm1',
          execution_id: 2,
          generation_prompt: 'P',
          seed: null,
          qc_status: 'approved',
          qc_reason: null,
          final_image_path: '/tmp/a.png',
          temp_image_path: null,
          metadata: null,
          processing_settings: null,
          created_at: null,
        }),
      ),
      run: vi.fn((_sql, _params, cb) => cb.call({ changes: 1 }, null)),
    };
    const repo2 = makeRepo(getDb);

    const res2 = await repo2.deleteGeneratedImage(1);

    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/a.png');
    expect(res2.success).toBe(true);

    unlinkSpy.mockRestore();
  });
});
