import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GeneratedImage } = require('../../../src/database/models/GeneratedImage');

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

  it('updateQCStatusByMappingId updates qc_status + reason', async () => {
    const model = Object.create(GeneratedImage.prototype);

    const run = vi.fn((sql, params, cb) => cb.call({ changes: 1 }, null));
    model.db = { run };

    const res = await model.updateQCStatusByMappingId('m1', 'qc_failed', 'blurry');

    expect(res).toEqual({ success: true, changes: 1 });
    expect(run.mock.calls[0][0]).toContain('WHERE image_mapping_id = ?');
    expect(run.mock.calls[0][1]).toEqual(['qc_failed', 'blurry', 'm1']);
  });

  it('getImagesByQCStatus returns list (and handles DB errors)', async () => {
    const model = Object.create(GeneratedImage.prototype);

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

    model.db = { all };

    const res = await model.getImagesByQCStatus('approved');

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
    model.db = { all: vi.fn((_sql, _params, cb) => cb(new Error('db'), null)) };
    await expect(model.getImagesByQCStatus('approved')).rejects.toThrow('db');
  });

  it('cleanupOldImages returns 0 when nothing to delete and deletes files when rows exist', async () => {
    const model = Object.create(GeneratedImage.prototype);

    // First: no rows
    model.db = {
      all: vi.fn((_sql, _params, cb) => cb(null, [])),
      run: vi.fn(),
    };

    const empty = await model.cleanupOldImages(30);
    expect(empty).toEqual({ success: true, deletedRows: 0, filesDeleted: 0 });

    // Second: rows exist
    const rows = [
      { id: 1, final_image_path: '/tmp/a.png', temp_image_path: null },
      { id: 2, final_image_path: null, temp_image_path: '/tmp/b.png' },
    ];

    model.deleteImageFile = vi.fn().mockResolvedValue(true);
    model.db = {
      all: vi.fn((_sql, _params, cb) => cb(null, rows)),
      run: vi.fn((_sql, _params, cb) => cb.call({ changes: 2 }, null)),
    };

    const res = await model.cleanupOldImages(30);

    expect(model.deleteImageFile).toHaveBeenCalledTimes(2);
    expect(res).toEqual(
      expect.objectContaining({
        success: true,
        filesDeleted: 2,
        totalImages: 2,
      }),
    );
  });
});
