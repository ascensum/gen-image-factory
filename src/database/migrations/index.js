const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

/**
 * Database Migration System
 * 
 * Handles database schema versioning and migrations for future updates
 */
class DatabaseMigration {
  constructor() {
    this.dbPath = path.join(__dirname, '../../../data/settings.db');
    this.migrationsPath = __dirname;
    this.versionTable = 'schema_versions';
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database for migration:', err);
          reject(err);
        } else {
          this.createVersionTable().then(resolve).catch(reject);
        }
      });
    });
  }

  async createVersionTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS ${this.versionTable} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER UNIQUE NOT NULL,
          description TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checksum TEXT
        )
      `;

      this.db.run(sql, (err) => {
        if (err) {
          console.error('Error creating version table:', err);
          reject(err);
        } else {
          console.log('Version table created successfully');
          resolve();
        }
      });
    });
  }

  async getCurrentVersion() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT MAX(version) as current_version FROM ${this.versionTable}`;
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error getting current version:', err);
          reject(err);
        } else {
          resolve(row ? row.current_version || 0 : 0);
        }
      });
    });
  }

  async getAvailableMigrations() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrations = [];
      
      for (const file of files) {
        if (file.endsWith('.js') && file !== 'index.js') {
          const migration = require(path.join(this.migrationsPath, file));
          migrations.push({
            version: migration.version,
            description: migration.description,
            file: file
          });
        }
      }
      
      return migrations.sort((a, b) => a.version - b.version);
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  async runMigration(version, description, upSQL, downSQL) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Begin transaction
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Run migration
        // NOTE: migrations often contain multiple statements; `run` only executes the first.
        // Use `exec` so multi-statement migrations apply correctly.
        this.db.exec(upSQL, (err) => {
          if (err) {
            this.db.run('ROLLBACK', () => {
              reject(err);
            });
            return;
          }
        });

        // Record migration
        const checksum = this.generateChecksum(upSQL);
        const recordSQL = `
          INSERT INTO ${this.versionTable} (version, description, checksum)
          VALUES (?, ?, ?)
        `;
        
        this.db.run(recordSQL, [version, description, checksum], (err) => {
          if (err) {
            this.db.run('ROLLBACK', () => {
              reject(err);
            });
            return;
          }
        });

        // Commit transaction
        this.db.run('COMMIT', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`Migration ${version} applied successfully: ${description}`);
            resolve();
          }
        });
      });
    });
  }

  async rollbackMigration(version) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Begin transaction
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Get migration details
        const getSQL = `SELECT description FROM ${this.versionTable} WHERE version = ?`;
        this.db.get(getSQL, [version], (err, row) => {
          if (err || !row) {
            this.db.run('ROLLBACK', () => {
              reject(new Error(`Migration ${version} not found`));
            });
            return;
          }

          // Run rollback (down migration)
          const downSQL = this.getDownMigration(version);
          if (!downSQL) {
            this.db.run('ROLLBACK', () => {
              reject(new Error(`No rollback available for migration ${version}`));
            });
            return;
          }

          // Rollbacks can also be multi-statement.
          this.db.exec(downSQL, (err) => {
            if (err) {
              this.db.run('ROLLBACK', () => {
                reject(err);
              });
              return;
            }
          });

          // Remove migration record
          const deleteSQL = `DELETE FROM ${this.versionTable} WHERE version = ?`;
          this.db.run(deleteSQL, [version], (err) => {
            if (err) {
              this.db.run('ROLLBACK', () => {
                reject(err);
              });
              return;
            }
          });

          // Commit transaction
          this.db.run('COMMIT', (err) => {
            if (err) {
              reject(err);
            } else {
              console.log(`Migration ${version} rolled back successfully`);
              resolve();
            }
          });
        });
      });
    });
  }

  async migrate() {
    try {
      const currentVersion = await this.getCurrentVersion();
      const availableMigrations = await this.getAvailableMigrations();
      
      console.log(`Current database version: ${currentVersion}`);
      console.log(`Available migrations: ${availableMigrations.length}`);
      
      const pendingMigrations = availableMigrations.filter(m => m.version > currentVersion);
      
      if (pendingMigrations.length === 0) {
        console.log('Database is up to date');
        return;
      }
      
      console.log(`Applying ${pendingMigrations.length} pending migrations...`);
      
      for (const migration of pendingMigrations) {
        const migrationModule = require(path.join(this.migrationsPath, migration.file));
        await this.runMigration(
          migration.version,
          migration.description,
          migrationModule.up,
          migrationModule.down
        );
      }
      
      console.log('All migrations applied successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  generateChecksum(sql) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(sql).digest('hex');
  }

  getDownMigration(version) {
    // This would be implemented based on the specific migration
    // For now, return null to indicate no rollback available
    return null;
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing migration database:', err);
        } else {
          console.log('Migration database connection closed');
        }
      });
    }
  }
}

module.exports = { DatabaseMigration };
