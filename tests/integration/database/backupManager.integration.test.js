import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Use require-cache injection (CJS-safe) to avoid loading native sqlite3 in worker processes.
const fsMod = require('fs');
class MockDb {
  constructor(p, modeOrCb, maybeCb) {
    this.path = p;
    const cb = typeof modeOrCb === 'function' ? modeOrCb : maybeCb;
    // Defer to avoid TDZ issues with `const db = new Database(..., cb)`
    queueMicrotask(() => cb && cb(null));
  }
  backup(targetDb, cb) {
    try {
      if (this.path && targetDb?.path) {
        fsMod.copyFileSync(this.path, targetDb.path);
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
    cb && cb(null, { integrity_check: 'ok', name: 'notes' });
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

import fs from 'fs';
import path from 'path';
import os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
installSqlite3Mock();
const { BackupManager } = require('../../../src/database/backupManager');

const mkTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));

const writeSampleDb = (dbPath, value) => fs.writeFileSync(dbPath, value, 'utf8');
const readNote = dbPath => fs.readFileSync(dbPath, 'utf8');

describe.sequential('BackupManager (isolated paths)', () => {
  const tmp = mkTempDir();
  const dbPath = path.join(tmp, 'settings.db');
  const backupDir = path.join(tmp, 'backups');

  beforeAll(async () => {
    await writeSampleDb(dbPath, 'original');
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('creates backup with metadata and restores previous data', async () => {
    const mgr = new BackupManager();
    mgr.dbPath = dbPath;
    mgr.backupDir = backupDir;

    await mgr.init();
    const backup = await mgr.createBackup();

    expect(backup.success).toBe(true);
    expect(fs.existsSync(backup.path)).toBe(true);
    expect(fs.existsSync(`${backup.path}.meta`)).toBe(true);

    // mutate live db
    await writeSampleDb(dbPath, 'mutated');
    expect(await readNote(dbPath)).toBe('mutated');

    // restore from backup
    const restoreResult = await mgr.restoreBackup(backup.path);
    expect(restoreResult.success).toBe(true);
    expect(await readNote(dbPath)).toBe('original');
  });
});
