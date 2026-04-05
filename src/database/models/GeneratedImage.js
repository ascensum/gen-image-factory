const path = require('path');
const fs = require('fs');

let sqlite3;

/**
 * GeneratedImage Database Model
 *
 * Schema-only: Provides SQLite table definition, init, and close.
 * All query logic lives in ImageRepository (ADR-009).
 * Story 5.2: Stripped from 1,082 lines — removed all query methods, Shadow Bridge routing,
 * and feature-flag-gated repository lazy-initialization.
 * imageRepository is always initialized in init() so backendAdapter.js (deleted in Story 5.3)
 * continues to route all operations through the repository.
 */
class GeneratedImage {
  constructor() {
    this.dbPath = this.resolveDatabasePath();
    this.imageRepository = null;
    if (process.env.SMOKE_TEST === 'true') {
      console.log(' [GeneratedImage] Skipping init() during SMOKE_TEST');
      return;
    }
    this.init().catch((err) => {
      console.error('GeneratedImage init failed:', err?.message || err);
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
          // Always initialize ImageRepository — flag removed per ADR-015 (Story 5.2)
          try {
            const { ImageRepository } = require('../../repositories/ImageRepository');
            this.imageRepository = new ImageRepository(this);
            console.log(' ImageRepository initialized');
          } catch (err) {
            console.warn('Failed to initialize ImageRepository:', err.message);
          }
          resolve();
        }).catch(reject);
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const sql = `CREATE TABLE IF NOT EXISTS generated_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_mapping_id VARCHAR(50) UNIQUE NOT NULL,
          execution_id INTEGER,
          generation_prompt TEXT NOT NULL,
          seed INTEGER,
          qc_status VARCHAR(20) DEFAULT 'failed',
          qc_reason TEXT,
          final_image_path VARCHAR(500),
          temp_image_path VARCHAR(500),
          metadata TEXT,
          processing_settings TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
        )`;
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_generated_images_execution_id ON generated_images(execution_id)',
        'CREATE INDEX IF NOT EXISTS idx_generated_images_image_mapping_id ON generated_images(image_mapping_id)',
        'CREATE INDEX IF NOT EXISTS idx_generated_images_qc_status ON generated_images(qc_status)',
        'CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at)'
      ];

      this.db.serialize(() => {
        this.db.run(sql, (err) => {
          if (err) { console.error('Error creating generated_images table:', err); reject(err); return; }
          console.log('Generated images table ensured (created if missing)');

          this.checkAndMigrateTable().then(() => {
            if (!this.db || this.db.open === false) { resolve(); return; }
            indexes.forEach((idx, i) => {
              if (!this.db || this.db.open === false) return;
              try { this.db.run(idx, (e) => { if (e) console.error(`Error creating index ${i}:`, e); else console.log(`Index ${i} created`); }); } catch (e) { console.warn(`Skipped index ${i}:`, e?.message); }
            });
            if (!this.db || this.db.open === false) { resolve(); return; }
            try {
              this.db.wait((err) => {
                if (err && err.code === 'SQLITE_MISUSE') { resolve(); return; }
                if (err) reject(err); else resolve();
              });
            } catch (e) { console.warn('Skipped wait; DB likely closed:', e?.message); resolve(); }
          }).catch((error) => { console.error('Migration failed:', error); reject(error); });
        });
      });
    });
  }

  async checkAndMigrateTable() {
    return new Promise((resolve, reject) => {
      this.db.all("PRAGMA table_info(generated_images)", (err, columns) => {
        if (err || !columns) { resolve(); return; }
        const executionIdColumn = columns.find(c => c.name === 'execution_id');
        const mappingIdColumn = columns.find(c => c.name === 'image_mapping_id');
        const tempPathColumn = columns.find(c => c.name === 'temp_image_path');

        if ((executionIdColumn && executionIdColumn.notnull === 1) || !mappingIdColumn) {
          console.log(' Migrating generated_images table...');
          this.migrateTable().then(resolve).catch(reject);
        } else if (!tempPathColumn) {
          this.db.run("ALTER TABLE generated_images ADD COLUMN temp_image_path VARCHAR(500)", (alterErr) => {
            if (alterErr) { console.error(' Failed to add temp_image_path column:', alterErr); resolve(); }
            else { console.log(' temp_image_path column added'); resolve(); }
          });
        } else {
          resolve();
        }
      });
    });
  }

  async migrateTable() {
    const newSQL = `CREATE TABLE generated_images_new (id INTEGER PRIMARY KEY AUTOINCREMENT, image_mapping_id VARCHAR(50) UNIQUE NOT NULL, execution_id INTEGER, generation_prompt TEXT NOT NULL, seed INTEGER, qc_status VARCHAR(20) DEFAULT 'failed', qc_reason TEXT, final_image_path VARCHAR(500), metadata TEXT, processing_settings TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE)`;
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DROP TABLE IF EXISTS generated_images_new', () => {});
        this.db.run(newSQL, (e) => { if (e) { reject(e); return; } });
        this.db.run(`INSERT INTO generated_images_new SELECT id, 'legacy_' || id, execution_id, generation_prompt, seed, qc_status, qc_reason, final_image_path, metadata, processing_settings, created_at FROM generated_images`, (e) => { if (e) { reject(e); return; } });
        this.db.run('DROP TABLE generated_images', (e) => { if (e) { reject(e); return; } });
        this.db.run('ALTER TABLE generated_images_new RENAME TO generated_images', (e) => { if (e) reject(e); else { console.log(' Migration complete'); resolve(); } });
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('GeneratedImage database connection closed');
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TEMPORARY PROXIES — backendAdapter.js compatibility (delete in Story 5.3)
  // backendAdapter.js (frozen monolith) calls these methods directly on the
  // model instance, bypassing Shadow Bridge routing. These thin proxies delegate
  // to ImageRepository so backendAdapter.js continues to work until it is deleted.
  // ---------------------------------------------------------------------------

  _requireImageRepository() {
    if (!this.imageRepository) throw new Error('ImageRepository not initialized');
    return this.imageRepository;
  }

  async getGeneratedImage(id) {
    return this._requireImageRepository().getGeneratedImage(id);
  }

  async getGeneratedImagesByExecution(executionId) {
    return this._requireImageRepository().getGeneratedImagesByExecution(executionId);
  }

  async saveGeneratedImage(image) {
    return this._requireImageRepository().saveGeneratedImage(image);
  }

  async updateGeneratedImage(id, data) {
    return this._requireImageRepository().updateGeneratedImage(id, data);
  }

  async deleteGeneratedImage(id) {
    return this._requireImageRepository().deleteGeneratedImage(id);
  }

  async bulkDeleteGeneratedImages(imageIds) {
    return this._requireImageRepository().bulkDeleteGeneratedImages(imageIds);
  }

  async getImagesByQCStatus(qcStatus, options) {
    return this._requireImageRepository().findByQcStatus(qcStatus, options);
  }

  async updateQCStatus(id, qcStatus, qcReason) {
    return this._requireImageRepository().updateQCStatus(id, qcStatus, qcReason);
  }

  async updateQCStatusByMappingId(mappingId, qcStatus, qcReason) {
    return this._requireImageRepository().updateQCStatusByMappingId(mappingId, qcStatus, qcReason);
  }

  async updateGeneratedImageByMappingId(mappingId, image) {
    return this._requireImageRepository().updateGeneratedImageByMappingId(mappingId, image);
  }

  async updateMetadataById(id, newMetadata) {
    return this._requireImageRepository().updateMetadataById(id, newMetadata);
  }

  async updateImagePathsByMappingId(mappingId, tempImagePath, finalImagePath) {
    return this._requireImageRepository().updateImagePathsByMappingId(mappingId, tempImagePath, finalImagePath);
  }

  async updateImagePathsById(id, tempImagePath, finalImagePath) {
    return this._requireImageRepository().updateImagePathsById(id, tempImagePath, finalImagePath);
  }

  async getImageMetadata(executionId) {
    return this._requireImageRepository().getImageMetadata(executionId);
  }

  async getImageStatistics() {
    return this._requireImageRepository().getImageStatistics();
  }

  async getAllGeneratedImages(limit) {
    return this._requireImageRepository().getAllGeneratedImages(limit);
  }
}

module.exports = { GeneratedImage };
