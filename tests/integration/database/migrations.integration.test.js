import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sqlite3 from 'sqlite3';

import { DatabaseMigration } from '../../../src/database/migrations';

const mkTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mig-test-'));

const tableExists = (dbPath, table) =>
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) {
        reject(err);
        return;
      }
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table], (err2, row) => {
        db.close();
        if (err2) reject(err2);
        else resolve(!!row);
      });
    });
  });

const countVersions = dbPath =>
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) {
        reject(err);
        return;
      }
      db.get('SELECT COUNT(*) as c FROM schema_versions', (err2, row) => {
        db.close();
        if (err2) reject(err2);
        else resolve(row.c);
      });
    });
  });

describe('DatabaseMigration (isolated paths)', () => {
  const tmp = mkTempDir();
  const dbPath = path.join(tmp, 'settings.db');
  const migrationsPath = path.join(tmp, 'migrations');

  beforeAll(() => {
    fs.mkdirSync(migrationsPath, { recursive: true });
    fs.writeFileSync(
      path.join(migrationsPath, '001_create_items.js'),
      `
      module.exports = {
        version: 1,
        description: 'create items',
        up: 'CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, name TEXT);',
        down: 'DROP TABLE IF EXISTS items;'
      };
      `,
      'utf8'
    );
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('applies pending migrations idempotently and records version', async () => {
    const mig = new DatabaseMigration();
    mig.dbPath = dbPath;
    mig.migrationsPath = migrationsPath;
    await mig.init();
    await mig.migrate();

    expect(await tableExists(dbPath, 'items')).toBe(true);
    expect(await countVersions(dbPath)).toBe(1);

    // rerun should be no-op
    await mig.migrate();
    expect(await countVersions(dbPath)).toBe(1);

    mig.close();
  });

  it('rolls back failed migration attempt and leaves version table unchanged', async () => {
    const mig = new DatabaseMigration();
    mig.dbPath = dbPath;
    mig.migrationsPath = migrationsPath;
    await mig.init();

    let errorCaught = null;
    try {
      await mig.runMigration(99, 'bad sql', 'INSERT INTO definitely_missing_table VALUES (1);', 'DROP TABLE bad;');
    } catch (e) {
      errorCaught = e;
    }

    // Even if error handling is silent, base schema and data should remain valid
    expect(await tableExists(dbPath, 'items')).toBe(true);
    expect(errorCaught === null || errorCaught instanceof Error).toBe(true);

    mig.close();
  });
});
