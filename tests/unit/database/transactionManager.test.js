import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, require.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
  originalCache.clear();
};

class FakeDb {
  constructor(_dbPath, cb) {
    this._runs = [];
    this._gets = [];
    this._alls = [];
    this._closed = false;
    queueMicrotask(() => cb && cb(null));
  }

  serialize(cb) {
    cb();
  }

  run(sql, paramsOrCb, maybeCb) {
    const params = Array.isArray(paramsOrCb) ? paramsOrCb : [];
    const cb = typeof paramsOrCb === 'function' ? paramsOrCb : maybeCb;
    this._runs.push({ sql, params });

    if (typeof cb === 'function') {
      // Simulate a failure for SQL containing the marker.
      if (String(sql).includes('FAIL_ME')) {
        queueMicrotask(() => cb(new Error('fail')));
        return;
      }
      // sqlite3 exposes lastID/changes via `this` inside callback
      queueMicrotask(() => cb.call({ lastID: 7, changes: 1 }, null));
    }
  }

  get(sql, params, cb) {
    this._gets.push({ sql, params });
    queueMicrotask(() => cb(null, { ok: 1 }));
  }

  all(sql, params, cb) {
    this._alls.push({ sql, params });
    queueMicrotask(() => cb(null, [{ ok: 1 }, { ok: 2 }]));
  }

  close(cb) {
    this._closed = true;
    queueMicrotask(() => cb && cb(null));
  }
}

const installSqliteMock = () => {
  const sqliteId = require.resolve('sqlite3');
  rememberCache(sqliteId);
  require.cache[sqliteId] = {
    id: sqliteId,
    filename: sqliteId,
    loaded: true,
    exports: {
      verbose: () => ({
        Database: FakeDb,
      }),
    },
  };

  const sutId = require.resolve('../../../src/database/transactionManager.js');
  rememberCache(sutId);
  delete require.cache[sutId];
};

const loadSut = () => {
  installSqliteMock();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TransactionManager } = require('../../../src/database/transactionManager.js');
  return TransactionManager;
};

describe('TransactionManager (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    restoreCache();
  });

  it('getConnection reuses pooled connections', async () => {
    const TransactionManager = loadSut();
    const tm = new TransactionManager();
    const pooled = new FakeDb(':memory:', () => {});
    tm.connectionPool.push(pooled);

    const conn = await tm.getConnection();
    expect(conn).toBe(pooled);
  });

  it('getConnection enforces maxConnections', async () => {
    const TransactionManager = loadSut();
    const tm = new TransactionManager();
    tm.maxConnections = 0;

    await expect(tm.getConnection()).rejects.toThrow('Connection pool exhausted');
  });

  it('executeQuery and executeQueryAll log performance and return results', async () => {
    const TransactionManager = loadSut();
    const tm = new TransactionManager();

    const row = await tm.executeQuery('SELECT 1', []);
    expect(row).toEqual({ ok: 1 });

    const rows = await tm.executeQueryAll('SELECT 1 UNION ALL SELECT 2', []);
    expect(rows).toEqual([{ ok: 1 }, { ok: 2 }]);

    const metrics = tm.getPerformanceMetrics();
    expect(metrics.totalQueries).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(metrics.recentQueries)).toBe(true);
  });

  it('executeTransaction commits and returns per-operation results; failures rollback', async () => {
    const TransactionManager = loadSut();
    const tm = new TransactionManager();

    const ok = await tm.executeTransaction([
      { sql: 'CREATE TABLE t(id INTEGER)', params: [] },
      { sql: 'INSERT INTO t(id) VALUES (?)', params: [1] },
    ]);
    expect(ok.success).toBe(true);
    expect(ok.results).toHaveLength(2);
    expect(ok.results[1]).toMatchObject({ success: true, lastID: 7, changes: 1 });

    await expect(
      tm.executeTransaction([
        { sql: 'INSERT INTO t(id) VALUES (1)', params: [] },
        { sql: 'FAIL_ME', params: [] },
      ]),
    ).rejects.toBeInstanceOf(Error);
  });

  it('optimizeDatabase runs maintenance statements and releases connection', async () => {
    const TransactionManager = loadSut();
    const tm = new TransactionManager();
    const releaseSpy = vi.spyOn(tm, 'releaseConnection');

    await tm.optimizeDatabase();
    expect(releaseSpy).toHaveBeenCalled();
  });
});

