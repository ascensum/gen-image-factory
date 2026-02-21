import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

class MockDb {
  constructor(_path, modeOrCb, maybeCb) {
    this.path = _path;
    const cb = typeof modeOrCb === 'function' ? modeOrCb : maybeCb;
    // Defer to avoid TDZ issues with `const db = new Database(..., cb)`
    queueMicrotask(() => cb && cb(null));
  }
  backup(_targetDb, cb) {
    try {
      // Simulate SQLite backup by copying the underlying file.
      if (this.path && _targetDb?.path) {
        fs.copyFileSync(this.path, _targetDb.path);
      }
      cb && cb(null);
    } catch (e) {
      cb && cb(e);
    }
  }
  close(cb) {
    cb && cb(null);
  }
  run(_sql, cb) {
    cb && cb(null);
  }
  get(_sql, _params, cb) {
    if (typeof _params === 'function') cb = _params;
    if (String(this.path).includes('corrupt')) {
      cb && cb(new Error('SQLITE_CORRUPT'), null);
      return;
    }
    cb && cb(null, { name: 'dummy', integrity_check: 'ok' });
  }
  serialize(fn) {
    fn();
  }
}
MockDb.OPEN_READONLY = 1;

const installSqlite3Mock = () => {
  const sqlite3Id = require.resolve('sqlite3');
  require.cache[sqlite3Id] = {
    id: sqlite3Id,
    filename: sqlite3Id,
    loaded: true,
    exports: {
      verbose: () => ({ Database: MockDb, OPEN_READONLY: MockDb.OPEN_READONLY }),
      Database: MockDb,
      OPEN_READONLY: MockDb.OPEN_READONLY,
    },
  };

  const sutId = require.resolve('../../../src/database/backupManager');
  delete require.cache[sutId];
};

installSqlite3Mock();
const { BackupManager } = require('../../../src/database/backupManager');

const mkTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'backup-unit-'));

describe('BackupManager (unit with sqlite3 mock)', () => {
  const tmp = mkTempDir();
  const dbPath = path.join(tmp, 'settings.db');
  const backupDir = path.join(tmp, 'backups');

  beforeEach(() => {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(dbPath, 'data', 'utf8');
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('adds backup metadata with checksum', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;

    await mgr.init();
    const backup = await mgr.createBackup();
    const meta = JSON.parse(fs.readFileSync(`${backup.path}.meta`, 'utf8'));

    expect(meta.originalPath).toBe(dbPath);
    expect(meta.checksum).toBeTruthy();
  });

  it('verifyBackupIntegrity reports ok for mock db', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;

    await mgr.init();
    const backup = await mgr.createBackup();

    const integrity = await mgr.verifyBackupIntegrity(backup.path);
    // Current implementation returns the first sqlite_master row (truthy) rather than a boolean.
    expect(integrity).toMatchObject({ name: 'dummy' });
  });

  it('createBackup rejects when source database file is missing', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = path.join(tmp, 'missing.db');
    mgr.backupDir = backupDir;

    await mgr.init();
    await expect(mgr.createBackup()).rejects.toBeDefined();
  });

  it('restoreBackup rejects when backup integrity check fails (corrupt backup)', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;

    await mgr.init();

    const corruptBackupPath = path.join(backupDir, 'corrupt-backup.db');
    fs.writeFileSync(corruptBackupPath, 'not-a-real-sqlite', 'utf8');

    await expect(mgr.restoreBackup(corruptBackupPath)).rejects.toThrow('Backup integrity check failed');
  });
});
