import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('JobConfiguration - init() error paths and DB path resolution', () => {
  let existsSpy;
  let mkdirSpy;
  let cwdSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    existsSpy = vi.spyOn(fs, 'existsSync');
    mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    cwdSpy = vi.spyOn(process, 'cwd');
  });

  afterEach(() => {
    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  const installModuleMocks = ({ electronUserDataPath, sqliteOpenError, createTableError } = {}) => {
    const electronId = require.resolve('electron');
    require.cache[electronId] = {
      id: electronId,
      filename: electronId,
      loaded: true,
      exports: electronUserDataPath
        ? { app: { getPath: () => electronUserDataPath } }
        : { app: undefined },
    };

    const sqlite3Id = require.resolve('sqlite3');
    require.cache[sqlite3Id] = {
      id: sqlite3Id,
      filename: sqlite3Id,
      loaded: true,
      exports: {
        verbose: () => ({
          Database: function FakeDatabase(dbPath, cb) {
            this._dbPath = dbPath;
            this.run = (sql, runCb) => {
              if (typeof runCb === 'function') runCb(createTableError || null);
            };
            this.get = (_sql, _params, getCb) => getCb(null, null);
            this.all = (_sql, _params, allCb) => allCb(null, []);
            this.close = (closeCb) => (typeof closeCb === 'function' ? closeCb(null) : undefined);
            // Defer callback so `this.db = new Database(...)` assignment completes first.
            queueMicrotask(() => cb(sqliteOpenError || null));
          },
        }),
      },
    };

    // Ensure the SUT is reloaded with the fresh dependency mocks
    const sutId = require.resolve('../../../src/database/models/JobConfiguration.js');
    delete require.cache[sutId];
  };

  it('prefers Electron userData path when available and ensures directory exists', async () => {
    installModuleMocks({ electronUserDataPath: '/tmp/userdata' });

    existsSpy.mockReturnValue(false);

    const { JobConfiguration } = require('../../../src/database/models/JobConfiguration');

    // Avoid relying on constructor side effects; exercise the path resolver directly.
    const instance = Object.create(JobConfiguration.prototype);
    const resolved = instance.resolveDatabasePath();

    expect(resolved).toBe(path.join('/tmp/userdata', 'gen-image-factory.db'));
    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/userdata', { recursive: true });
  });

  it('falls back to project ./data when Electron userData not available', async () => {
    installModuleMocks({ electronUserDataPath: null });

    cwdSpy.mockReturnValue('/proj');
    existsSpy.mockReturnValue(false);

    const { JobConfiguration } = require('../../../src/database/models/JobConfiguration');

    const instance = Object.create(JobConfiguration.prototype);
    const resolved = instance.resolveDatabasePath();

    expect(resolved).toBe(path.join('/proj', 'data', 'gen-image-factory.db'));
    expect(mkdirSpy).toHaveBeenCalledWith(path.join('/proj', 'data'), { recursive: true });
  });

  it('init() rejects when sqlite cannot open database', async () => {
    installModuleMocks({ electronUserDataPath: '/tmp/userdata', sqliteOpenError: new Error('SQLITE_CANTOPEN') });

    const { JobConfiguration } = require('../../../src/database/models/JobConfiguration');

    const instance = Object.create(JobConfiguration.prototype);
    instance.dbPath = '/tmp/userdata/gen-image-factory.db';

    await expect(instance.init()).rejects.toThrow('SQLITE_CANTOPEN');
  });

  it('init() rejects when createTables fails', async () => {
    installModuleMocks({ electronUserDataPath: '/tmp/userdata', createTableError: new Error('CREATE_TABLE_FAILED') });

    const { JobConfiguration } = require('../../../src/database/models/JobConfiguration');

    const instance = Object.create(JobConfiguration.prototype);
    instance.dbPath = '/tmp/userdata/gen-image-factory.db';

    await expect(instance.init()).rejects.toThrow('CREATE_TABLE_FAILED');
  });
});

