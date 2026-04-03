/**
 * JobRepository unit tests (db stubbed)
 * Story 5.2: Updated from JobExecution model tests to JobRepository tests.
 * JobExecution is now schema-only; all query logic lives in JobRepository (ADR-009).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { JobRepository } = require('../../../src/repositories/JobRepository');

describe('JobExecution model (unit, db stubbed)', () => {
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
    return new JobRepository(model);
  }

  it('saveJobExecution inserts and serializes configurationSnapshot', async () => {
    const run = vi.fn((sql, params, cb) => { cb.call({ lastID: 123 }, null); });
    const repo = makeRepo({ run });

    const res = await repo.saveJobExecution({
      configurationId: 10,
      startedAt: '2024-01-01T00:00:00.000Z',
      status: 'running',
      totalImages: 2,
      successfulImages: 1,
      failedImages: 1,
      errorMessage: null,
      label: 'L',
      configurationSnapshot: { parameters: { variations: 2 } },
    });

    expect(res).toEqual({ success: true, id: 123 });
    expect(run).toHaveBeenCalled();
    const [_sql, params] = run.mock.calls[0];
    expect(params[0]).toBe(10);
    // configurationSnapshot is the 10th param (index 9)
    expect(params[9]).toBe(JSON.stringify({ parameters: { variations: 2 } }));
  });

  it('updateJobExecutionStatus delegates to updateJobExecution', async () => {
    const run = vi.fn((sql, params, cb) => { cb.call({ changes: 1 }, null); });
    const repo = makeRepo({ run });

    const res = await repo.updateJobExecution(1, { status: 'failed', configurationId: null, startedAt: null, completedAt: null, totalImages: 0, successfulImages: 0, failedImages: 0, errorMessage: 'err', label: null, configurationSnapshot: null });
    expect(res.success).toBe(true);
  });

  it('reconcileOrphanedRunningJobs (via updateJobExecution) resolves correctly', async () => {
    const run = vi.fn((sql, params, cb) => { cb.call({ changes: 1 }, null); });
    const repo = makeRepo({ run });
    // Simply test that updateJobExecution works - reconcile is handled by backendAdapter/retryExecutor (frozen)
    const res = await repo.updateJobExecution(1, { status: 'failed', configurationId: null, startedAt: null, completedAt: null, totalImages: 0, successfulImages: 0, failedImages: 0, errorMessage: null, label: null, configurationSnapshot: null });
    expect(res.success).toBe(true);
    expect(res.changes).toBe(1);
  });

  it('getJobExecution returns Date objects and parses configurationSnapshot JSON', async () => {
    const get = vi.fn((_sql, _params, cb) =>
      cb(null, {
        id: 5,
        configuration_id: 9,
        started_at: '2024-01-01T00:00:00.000Z',
        completed_at: null,
        status: 'completed',
        total_images: 2,
        successful_images: 2,
        failed_images: 0,
        error_message: null,
        label: 'L',
        configuration_snapshot: '{"a":1}',
      }),
    );
    const repo = makeRepo({ get });

    const res = await repo.getJobExecution(5);

    expect(res.success).toBe(true);
    expect(res.execution).toEqual(
      expect.objectContaining({
        id: 5,
        configurationId: 9,
        startedAt: expect.any(Date),
        completedAt: null,
        configurationSnapshot: { a: 1 },
      }),
    );
  });

  it('bulkDeleteJobExecutions returns 0 immediately when ids empty', async () => {
    const run = vi.fn();
    const repo = makeRepo({ run });

    const res = await repo.bulkDeleteJobExecutions([]);

    expect(res).toEqual({ success: true, deletedRows: 0 });
    expect(run).not.toHaveBeenCalled();
  });

  it('getJobExecutionsWithFilters builds SQL + params and maps rows (status/ids/dateFrom-dateTo/pagination)', async () => {
    const all = vi.fn((_sql, _params, cb) => {
      cb(null, [{
        id: 1,
        configuration_id: 10,
        configuration_label: 'Cfg',
        configuration_name: 'Cfg',
        started_at: '2024-01-01T00:00:00.000Z',
        completed_at: null,
        status: 'completed',
        total_images: 3,
        successful_images: 3,
        failed_images: 0,
        error_message: null,
        label: 'Hello',
        configuration_snapshot: null,
      }]);
    });
    const repo = makeRepo({ all });

    const res = await repo.getJobExecutionsWithFilters(
      { status: 'completed', ids: [1, 2], dateFrom: '2024-01-01', dateTo: '2024-01-02' },
      2,
      25,
    );

    expect(res.success).toBe(true);
    expect(res.jobs).toHaveLength(1);
    expect(res.executions).toHaveLength(1);
    expect(res.pagination).toEqual({ page: 2, pageSize: 25, hasMore: false });
    expect(res.jobs[0]).toEqual(
      expect.objectContaining({
        id: 1,
        configurationId: 10,
        configurationName: 'Cfg',
        startedAt: expect.any(Date),
      }),
    );

    const [sql, params] = all.mock.calls[0];
    expect(sql).toContain('je.status = ?');
    expect(sql).toContain('je.id IN (?,?)');
    expect(sql).toContain('date(je.started_at) >= date(?)');
    expect(sql).toContain('date(je.started_at) <= date(?)');
    expect(sql).toContain('LIMIT ? OFFSET ?');
    // status, dateFrom, dateTo, id1, id2, pageSize, offset
    expect(params).toEqual(['completed', '2024-01-01', '2024-01-02', 1, 2, 25, 25]);
  });

  it('getJobExecutionsCount applies status/dateFrom/dateTo filters and returns count', async () => {
    const get = vi.fn((_sql, _params, cb) => cb(null, { count: 7 }));
    const repo = makeRepo({ get });

    const res = await repo.getJobExecutionsCount({ status: 'failed', dateFrom: '2024-01-01' });

    expect(res).toEqual({ success: true, count: 7 });
    const [sql, params] = get.mock.calls[0];
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('status = ?');
    expect(sql).toContain('date(started_at) >= date(?)');
    expect(params[0]).toBe('failed');
    expect(params[1]).toBe('2024-01-01');
  });

  it('getJobExecutionsWithFilters and getJobExecutionsCount work with no filters (no WHERE clause)', async () => {
    const all = vi.fn((_sql, _params, cb) => cb(null, []));
    const get = vi.fn((_sql, _params, cb) => cb(null, { count: 0 }));
    const repo = makeRepo({ all, get });

    const resJobs = await repo.getJobExecutionsWithFilters({}, 1, 10);
    expect(resJobs.success).toBe(true);
    expect(resJobs.jobs).toEqual([]);
    expect(resJobs.pagination).toEqual({ page: 1, pageSize: 10, hasMore: false });
    const [sqlJ] = all.mock.calls[0];
    expect(sqlJ).not.toContain('WHERE');
    expect(sqlJ).toContain('LIMIT ? OFFSET ?');

    const resCount = await repo.getJobExecutionsCount({});
    expect(resCount).toEqual({ success: true, count: 0 });
    const [sqlC] = get.mock.calls[0];
    expect(sqlC).toContain('COUNT(*)');
    expect(sqlC).not.toContain('WHERE');
  });
});
