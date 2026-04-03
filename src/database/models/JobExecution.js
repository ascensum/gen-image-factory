const path = require('path');
const fs = require('fs');

let sqlite3;

/**
 * JobExecution Database Model
 *
 * Schema-only: Provides SQLite table definition, init, and close.
 * All query logic lives in JobRepository (ADR-009).
 * Story 5.2: Stripped from 1,119 lines — removed all query methods and Shadow Bridge routing.
 */
class JobExecution {
  constructor() {
    this.dbPath = this.resolveDatabasePath();
    this.jobRepository = null;
    if (process.env.SMOKE_TEST === 'true') {
      console.log(' [JobExecution] Skipping init() during SMOKE_TEST');
      return;
    }
    this.init().catch((err) => {
      console.error('JobExecution init failed:', err?.message || err);
    });
  }

  resolveDatabasePath() {
    let primaryPath = null;
    let usedElectron = false;
    try {
      const { app } = require('electron');
      if (app && app.getPath) {
        primaryPath = path.join(app.getPath('userData'), 'gen-image-factory.db');
        usedElectron = true;
      }
    } catch (_) {}
    if (!primaryPath) primaryPath = path.join(process.cwd(), 'data', 'gen-image-factory.db');

    const primaryDir = path.dirname(primaryPath);
    try { if (!fs.existsSync(primaryDir)) fs.mkdirSync(primaryDir, { recursive: true }); } catch (e) { console.warn('️ Could not ensure primary DB directory:', e.message); }

    // One-time migration from legacy paths
    if (!fs.existsSync(primaryPath)) {
      const legacyPaths = [];
      try { const os = require('os'); legacyPaths.push(path.join(os.homedir(), '.gen-image-factory', 'gen-image-factory.db')); } catch (_) {}
      legacyPaths.push(path.join(__dirname, '..', '..', '..', 'data', 'gen-image-factory.db'));
      const projectData = path.join(process.cwd(), 'data', 'gen-image-factory.db');
      if (projectData !== primaryPath) legacyPaths.push(projectData);
      for (const legacy of legacyPaths) {
        try { if (legacy && fs.existsSync(legacy)) { fs.copyFileSync(legacy, primaryPath); console.log(` Migrated DB: ${legacy} -> ${primaryPath}`); break; } } catch (e) { console.warn(`️ Migration failed ${legacy}:`, e.message); }
      }
    }

    // Move legacy DB files to backup folder
    try {
      const backupsDir = path.join(primaryDir, 'legacy-db-backups');
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      const candidates = [];
      try { const os = require('os'); candidates.push(path.join(os.homedir(), '.gen-image-factory', 'gen-image-factory.db')); } catch (_) {}
      candidates.push(path.join(__dirname, '..', '..', '..', 'data', 'gen-image-factory.db'));
      const pd = path.join(process.cwd(), 'data', 'gen-image-factory.db');
      if (pd !== primaryPath) candidates.push(pd);
      for (const legacy of candidates) {
        if (!legacy || legacy === primaryPath || !fs.existsSync(legacy)) continue;
        const dest = path.join(backupsDir, `${path.basename(legacy)}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`);
        try {
          fs.renameSync(legacy, dest);
          ['-wal', '-shm'].forEach(s => { try { if (fs.existsSync(legacy + s)) fs.renameSync(legacy + s, dest + s); } catch {} });
          console.log(` Moved legacy DB: ${legacy} -> ${dest}`);
        } catch (e) { console.warn(`️ Could not move legacy DB ${legacy}:`, e.message); }
      }
    } catch (e) { console.warn('️ Legacy DB cleanup skipped:', e.message); }

    console.log(` Database path resolved (pinned${usedElectron ? ' userData' : ' project-data'}): ${primaryPath}`);
    return primaryPath;
  }

  async init() {
    if (!sqlite3) sqlite3 = require('sqlite3').verbose();
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) { console.error('Error opening database:', err); reject(err); return; }
        try { this.db.configure('busyTimeout', 5000); } catch (_) {}
        this.createTables().then(() => {
          // Always initialize JobRepository — flag removed per ADR-015 (Story 5.2)
          try {
            const { JobRepository } = require('../../repositories/JobRepository');
            this.jobRepository = new JobRepository(this);
            console.log(' JobRepository initialized');
          } catch (err) {
            console.warn('Failed to initialize JobRepository:', err.message);
          }
          resolve();
        }).catch(reject);
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const sql = `CREATE TABLE IF NOT EXISTS job_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          configuration_id INTEGER,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          status VARCHAR(50) DEFAULT 'running',
          total_images INTEGER DEFAULT 0,
          successful_images INTEGER DEFAULT 0,
          failed_images INTEGER DEFAULT 0,
          error_message TEXT,
          label TEXT,
          configuration_snapshot TEXT,
          FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE
        )`;
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_job_executions_configuration_id ON job_executions(configuration_id)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_started_at ON job_executions(started_at)',
        'CREATE INDEX IF NOT EXISTS idx_job_executions_label ON job_executions(label)'
      ];

      this.db.serialize(() => {
        this.db.run(sql, (err) => { if (err) { console.error('Error creating job_executions table:', err); reject(err); return; } console.log('Job executions table created successfully'); });
        indexes.forEach((idx, i) => this.db.run(idx, (err) => { if (err) console.log(`Index ${i} skipped:`, err.message); else console.log(`Index ${i} created`); }));
        this.migrateTable().then(() => {
          this.db.wait((err) => { if (err) reject(err); else resolve(); });
        }).catch(reject);
      });
    });
  }

  async migrateTable() {
    return new Promise((resolve) => {
      this.db.all("PRAGMA table_info(job_executions)", (err, columns) => {
        if (err || !columns) { resolve(); return; }
        const configCol = columns.find(c => c.name === 'configuration_id');
        if (configCol && configCol.notnull === 1) {
          console.log('Migrating job_executions to allow nullable configuration_id...');
          const newTableSQL = `CREATE TABLE job_executions_new (id INTEGER PRIMARY KEY AUTOINCREMENT, configuration_id INTEGER, started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP, status VARCHAR(50) DEFAULT 'running', total_images INTEGER DEFAULT 0, successful_images INTEGER DEFAULT 0, failed_images INTEGER DEFAULT 0, error_message TEXT, label TEXT, configuration_snapshot TEXT, FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE)`;
          this.db.serialize(() => {
            this.db.run(newTableSQL, (e) => { if (e) { resolve(); return; } });
            this.db.run('INSERT INTO job_executions_new SELECT id, configuration_id, started_at, completed_at, status, total_images, successful_images, failed_images, error_message, label, NULL FROM job_executions', (e) => { if (e) { resolve(); return; } });
            this.db.run('DROP TABLE job_executions', (e) => { if (e) { resolve(); return; } });
            this.db.run('ALTER TABLE job_executions_new RENAME TO job_executions', (e) => { if (e) console.error('Rename failed:', e); else console.log('Migration complete'); resolve(); });
          });
        } else {
          const hasSnapshot = columns.some(c => c.name === 'configuration_snapshot');
          if (!hasSnapshot) {
            this.db.run('ALTER TABLE job_executions ADD COLUMN configuration_snapshot TEXT', (e) => { if (e) console.warn('Add column skipped:', e.message); resolve(); });
          } else {
            resolve();
          }
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('JobExecution database connection closed');
      });
    }
  }
}

module.exports = { JobExecution };
