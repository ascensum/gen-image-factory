import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JobExecution } = require('../../../src/database/models/JobExecution');

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

  it('saveJobExecution inserts and serializes configurationSnapshot', async () => {
    const model = Object.create(JobExecution.prototype);

    model.db = {
      run: vi.fn((sql, params, cb) => {
        cb.call({ lastID: 123 }, null);
      }),
    };

    const res = await model.saveJobExecution({
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
    expect(model.db.run).toHaveBeenCalled();

    const [_sql, params] = model.db.run.mock.calls[0];
    expect(params[0]).toBe(10);
    expect(params[9]).toBe(JSON.stringify({ parameters: { variations: 2 } }));
  });

  it('updateJobExecutionStatus chooses correct SQL based on optional jobId/errorMessage', async () => {
    const model = Object.create(JobExecution.prototype);

    const run = vi.fn((sql, params, cb) => cb.call({ changes: 1 }, null));
    model.db = { run };

    await model.updateJobExecutionStatus(1, 'failed', 'jid', 'err');
    expect(run.mock.calls[0][0]).toContain('job_id');
    expect(run.mock.calls[0][0]).toContain('error_message');

    await model.updateJobExecutionStatus(2, 'running', 'jid', null);
    expect(run.mock.calls[1][0]).toContain('job_id');
    expect(run.mock.calls[1][0]).not.toContain('error_message = ? WHERE id');

    await model.updateJobExecutionStatus(3, 'failed', null, 'err');
    expect(run.mock.calls[2][0]).toContain('error_message');
    expect(run.mock.calls[2][0]).not.toContain('job_id');

    await model.updateJobExecutionStatus(4, 'completed');
    expect(run.mock.calls[3][0]).toBe('UPDATE job_executions SET status = ? WHERE id = ?');
  });

  it('reconcileOrphanedRunningJobs retries on SQLITE_BUSY and resolves with changes', async () => {
    const model = Object.create(JobExecution.prototype);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });

    const run = vi
      .fn()
      .mockImplementationOnce((_sql, _params, cb) => cb.call({ changes: 0 }, { code: 'SQLITE_BUSY' }))
      .mockImplementationOnce((_sql, _params, cb) => cb.call({ changes: 2 }, null));

    model.db = { run };

    const res = await model.reconcileOrphanedRunningJobs();

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ success: true, changes: 2 });
  });

  it('getJobExecution returns Date objects and parses configurationSnapshot JSON', async () => {
    const model = Object.create(JobExecution.prototype);

    model.db = {
      get: vi.fn((_sql, _params, cb) =>
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
      ),
    };

    const res = await model.getJobExecution(5);

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
    const model = Object.create(JobExecution.prototype);
    model.db = { run: vi.fn() };

    const res = await model.bulkDeleteJobExecutions([]);

    expect(res).toEqual({ success: true, deletedRows: 0 });
    expect(model.db.run).not.toHaveBeenCalled();
  });

  it('getJobExecutionsWithFilters builds SQL + params and maps rows (status/label/ids/dateFrom-dateTo/min-max/pagination)', async () => {
    const model = Object.create(JobExecution.prototype);

    const all = vi.fn((_sql, _params, cb) => {
      cb(null, [
        {
          id: 1,
          configuration_id: 10,
          configuration_name: 'Cfg',
          started_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          status: 'completed',
          total_images: 3,
          successful_images: 3,
          failed_images: 0,
          error_message: null,
          label: 'Hello',
        },
      ]);
    });
    model.db = { all };

    const res = await model.getJobExecutionsWithFilters(
      {
        status: 'completed',
        label: 'Hel',
        ids: [1, 2],
        dateFrom: '2024-01-01',
        dateTo: '2024-01-02',
        minImages: 2,
        maxImages: 5,
      },
      2,
      25,
    );

    expect(res.success).toBe(true);
    expect(res.jobs).toHaveLength(1);
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
    expect(sql).toContain('je.label LIKE ?');
    expect(sql).toContain('je.id IN (?,?)');
    expect(sql).toContain('date(je.started_at) >= date(?)');
    expect(sql).toContain('date(je.started_at) <= date(?)');
    expect(sql).toContain('je.total_images >= ?');
    expect(sql).toContain('je.total_images <= ?');
    expect(sql).toContain('LIMIT ? OFFSET ?');

    // Params: status, labelLike, ids..., fromDate, toDate, min, max, pageSize, offset
    expect(params).toEqual([
      'completed',
      '%Hel%',
      1,
      2,
      '2024-01-01',
      '2024-01-02',
      2,
      5,
      25,
      25, // (page-1)*pageSize = 25
    ]);
  });

  it('getJobExecutionsCount applies dateRange filters and returns count', async () => {
    const model = Object.create(JobExecution.prototype);

    const get = vi.fn((_sql, _params, cb) => cb(null, { count: 7 }));
    model.db = { get };

    const res = await model.getJobExecutionsCount({
      status: 'failed',
      dateRange: 'week',
      minImages: 1,
    });

    expect(res).toEqual({ success: true, count: 7 });

    const [sql, params] = get.mock.calls[0];
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('je.status = ?');
    expect(sql).toContain('je.started_at >= ?');
    expect(sql).toContain('je.total_images >= ?');
    expect(params[0]).toBe('failed');
    expect(typeof params[1]).toBe('string'); // ISO date
    expect(params[2]).toBe(1);
  });

  it('covers dateRange switch branches for filters + count (today/yesterday/week/month/quarter/year)', async () => {
    const model = Object.create(JobExecution.prototype);

    const all = vi.fn((_sql, _params, cb) => cb(null, []));
    const get = vi.fn((_sql, _params, cb) => cb(null, { count: 0 }));
    model.db = { all, get };

    const ranges = ['today', 'yesterday', 'week', 'month', 'quarter', 'year'];
    for (const r of ranges) {
      // jobs
      const resJobs = await model.getJobExecutionsWithFilters({ dateRange: r }, 1, 1);
      expect(resJobs).toEqual({ success: true, jobs: [] });
      const [sqlJ, paramsJ] = all.mock.calls[all.mock.calls.length - 1];
      expect(sqlJ).toContain('je.started_at >= ?');
      expect(paramsJ[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // count
      const resCount = await model.getJobExecutionsCount({ dateRange: r });
      expect(resCount).toEqual({ success: true, count: 0 });
      const [sqlC, paramsC] = get.mock.calls[get.mock.calls.length - 1];
      expect(sqlC).toContain('je.started_at >= ?');
      expect(paramsC[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});
