import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sqlite3 from 'sqlite3';

import { DatabaseMigration } from '../../../src/database/migrations';

const mkTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'app-mig-'));

const openReadonly = dbPath =>
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) reject(err);
      else resolve(db);
    });
  });

const getPragmaTableInfo = async (dbPath, table) => {
  const db = await openReadonly(dbPath);
  try {
    return await new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(${table});`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  } finally {
    db.close();
  }
};

const countSchemaVersions = async dbPath => {
  const db = await openReadonly(dbPath);
  try {
    return await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as c FROM schema_versions', (err, row) => {
        if (err) reject(err);
        else resolve(row.c);
      });
    });
  } finally {
    db.close();
  }
};

describe('DatabaseMigration - app migrations folder', () => {
  const tmp = mkTempDir();
  const dbPath = path.join(tmp, 'settings.db');

  beforeAll(() => {
    fs.mkdirSync(tmp, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('applies real app migrations and exposes expected schema (idempotent rerun)', async () => {
    const mig = new DatabaseMigration();
    mig.dbPath = dbPath;
    await mig.init();

    await mig.migrate();

    // 001, 002, 003 should be recorded
    expect(await countSchemaVersions(dbPath)).toBeGreaterThanOrEqual(3);

    const jobExecCols = await getPragmaTableInfo(dbPath, 'job_executions');
    const jobExecColNames = jobExecCols.map(c => c.name);
    expect(jobExecColNames).toContain('label');

    const genCols = await getPragmaTableInfo(dbPath, 'generated_images');
    const genColNames = genCols.map(c => c.name);
    expect(genColNames).toContain('temp_image_path');

    // rerun should be no-op
    await mig.migrate();
    expect(await countSchemaVersions(dbPath)).toBeGreaterThanOrEqual(3);

    mig.close();
  });
});

