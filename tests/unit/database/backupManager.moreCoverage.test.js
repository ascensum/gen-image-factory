import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

class MockDb {
  constructor(dbPath, modeOrCb, maybeCb) {
    this.path = dbPath;
    const cb = typeof modeOrCb === 'function' ? modeOrCb : maybeCb;
    queueMicrotask(() => {
      if (String(this.path).includes('openfail')) cb && cb(new Error('open fail'));
      else cb && cb(null);
    });
  }
  backup(targetDb, cb) {
    try {
      if (this.path && targetDb?.path) fs.copyFileSync(this.path, targetDb.path);
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }
  close(cb) {
    cb && cb(null);
  }
  get(sql, paramsOrCb, maybeCb) {
    const cb = typeof paramsOrCb === 'function' ? paramsOrCb : maybeCb;
    if (String(sql).includes('PRAGMA integrity_check')) {
      if (String(this.path).includes('pragmafail')) {
        cb && cb(new Error('pragma fail'), null);
        return;
      }
      cb && cb(null, { integrity_check: 'ok' });
      return;
    }
    cb && cb(null, { name: 'dummy' });
  }
  run(_sql, _paramsOrCb, maybeCb) {
    const cb = typeof _paramsOrCb === 'function' ? _paramsOrCb : maybeCb;
    cb && cb(null);
  }
  serialize(fn) {
    fn();
  }
}
MockDb.OPEN_READONLY = 1;

const originalCache = new Map();
const rememberCache = (id) => {
  if (!originalCache.has(id)) originalCache.set(id, req.cache[id]);
};
const restoreCache = () => {
  for (const [id, entry] of originalCache.entries()) {
    if (entry) req.cache[id] = entry;
    else delete req.cache[id];
  }
  originalCache.clear();
};

const installSqliteMockAndReload = () => {
  const sqlite3Id = req.resolve('sqlite3');
  rememberCache(sqlite3Id);
  req.cache[sqlite3Id] = {
    id: sqlite3Id,
    filename: sqlite3Id,
    loaded: true,
    exports: {
      verbose: () => ({ Database: MockDb, OPEN_READONLY: MockDb.OPEN_READONLY }),
      Database: MockDb,
      OPEN_READONLY: MockDb.OPEN_READONLY,
    },
  };

  const sutId = req.resolve('../../../src/database/backupManager');
  rememberCache(sutId);
  delete req.cache[sutId];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return req('../../../src/database/backupManager');
};

const mkTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'backup-more-'));

describe('BackupManager (more coverage)', () => {
  const tmp = mkTempDir();
  const dbPath = path.join(tmp, 'settings.db');
  const backupDir = path.join(tmp, 'backups');

  let BackupManager;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ BackupManager } = installSqliteMockAndReload());
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(dbPath, 'data', 'utf8');
  });

  afterEach(() => {
    restoreCache();
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('listBackups falls back to stat+checksum when .meta is missing', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;
    await mgr.init();

    const backup = await mgr.createBackup();
    // remove meta to force fallback path
    fs.rmSync(`${backup.path}.meta`, { force: true });

    const list = await mgr.listBackups();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toEqual(expect.objectContaining({
      file: expect.stringMatching(/backup-.*\.db/),
      metadata: expect.objectContaining({
        checksum: expect.any(String),
        size: expect.any(Number),
      }),
    }));
  });

  it('checkDatabaseIntegrity returns success=true when PRAGMA integrity_check is ok', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;
    await mgr.init();

    const res = await mgr.checkDatabaseIntegrity();
    expect(res).toEqual({ success: true, result: 'ok' });
  });

  it('checkDatabaseIntegrity rejects when PRAGMA query fails', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = path.join(tmp, 'pragmafail.db');
    mgr.backupDir = backupDir;
    fs.writeFileSync(mgr.dbPath, 'x', 'utf8');
    await mgr.init();

    await expect(mgr.checkDatabaseIntegrity()).rejects.toBeDefined();
  });

  it('getDatabaseSize returns zeros when stat fails', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = path.join(tmp, 'missing.db');
    mgr.backupDir = backupDir;
    await mgr.init();

    const res = await mgr.getDatabaseSize();
    expect(res).toEqual({ size: 0, sizeInMB: '0.00' });
  });

  it('cleanupOldBackups deletes backups exceeding maxBackups', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;
    mgr.maxBackups = 1;
    await mgr.init();

    // Create 3 backups
    const b1 = await mgr.createBackup();
    // Ensure timestamps differ
    await new Promise((r) => setTimeout(r, 2));
    const b2 = await mgr.createBackup();
    await new Promise((r) => setTimeout(r, 2));
    const b3 = await mgr.createBackup();

    expect(fs.existsSync(b1.path)).toBe(true);
    expect(fs.existsSync(b2.path)).toBe(true);
    expect(fs.existsSync(b3.path)).toBe(true);

    await mgr.cleanupOldBackups();

    // should keep only 1 newest; others should be deleted (best-effort)
    const remaining = (await mgr.listBackups()).map((x) => x.path);
    expect(remaining.length).toBeLessThanOrEqual(1);
  });

  it('scheduleBackup runs createBackup when last backup is older than interval, otherwise returns not due', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;
    await mgr.init();

    const createSpy = vi.spyOn(mgr, 'createBackup').mockResolvedValue({ success: true, path: '/tmp/b', timestamp: 't', size: 1 });

    vi.spyOn(mgr, 'getLastBackupTime').mockResolvedValueOnce(Date.now() - mgr.backupInterval - 1);
    await expect(mgr.scheduleBackup()).resolves.toEqual({ success: true, message: 'Scheduled backup completed' });
    expect(createSpy).toHaveBeenCalledTimes(1);

    vi.spyOn(mgr, 'getLastBackupTime').mockResolvedValueOnce(Date.now());
    await expect(mgr.scheduleBackup()).resolves.toEqual({ success: true, message: 'Backup not due yet' });
  });

  it('getLastBackupTime returns null when listBackups throws', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;
    await mgr.init();

    vi.spyOn(mgr, 'listBackups').mockRejectedValueOnce(new Error('boom'));
    await expect(mgr.getLastBackupTime()).resolves.toBeNull();
  });

  it('performMaintenance reports backupCount and throws when integrity fails', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;
    await mgr.init();

    vi.spyOn(mgr, 'createBackup').mockResolvedValue({ success: true, path: '/tmp/b', timestamp: 't', size: 1 });
    vi.spyOn(mgr, 'cleanupOldBackups').mockResolvedValue(undefined);
    vi.spyOn(mgr, 'getDatabaseSize').mockResolvedValue({ size: 1, sizeInMB: '0.00' });
    vi.spyOn(mgr, 'listBackups').mockResolvedValue([{ path: '/tmp/b', file: 'b', metadata: { timestamp: 't' } }]);

    vi.spyOn(mgr, 'checkDatabaseIntegrity').mockResolvedValueOnce({ success: false, result: 'bad' });
    await expect(mgr.performMaintenance()).rejects.toThrow(/integrity/i);
  });
});

