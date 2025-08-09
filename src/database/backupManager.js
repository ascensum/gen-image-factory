const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Database Backup and Recovery Manager
 * 
 * Handles database backup, recovery, integrity checking, and maintenance
 */
class BackupManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/settings.db');
    this.backupDir = path.join(__dirname, '../data/backups');
    this.maxBackups = 10;
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  async init() {
    try {
      // Create backup directory if it doesn't exist
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log('Backup directory initialized');
    } catch (error) {
      console.error('Error initializing backup directory:', error);
      throw error;
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}.db`);
    
    return new Promise((resolve, reject) => {
      // Check if source database exists
      fs.access(this.dbPath).then(() => {
        // Create backup using SQLite backup API
        const sourceDb = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        const backupDb = new sqlite3.Database(backupPath, (err) => {
          if (err) {
            sourceDb.close();
            reject(err);
            return;
          }
        });

        // Perform backup
        sourceDb.backup(backupDb, (err) => {
          sourceDb.close();
          backupDb.close();
          
          if (err) {
            reject(err);
          } else {
            this.addBackupMetadata(backupPath, timestamp).then(() => {
              console.log(`Backup created successfully: ${backupPath}`);
              resolve({
                success: true,
                path: backupPath,
                timestamp: timestamp,
                size: fs.statSync(backupPath).size
              });
            }).catch(reject);
          }
        });
      }).catch(reject);
    });
  }

  async addBackupMetadata(backupPath, timestamp) {
    const metadata = {
      timestamp: timestamp,
      originalPath: this.dbPath,
      version: '1.0',
      checksum: await this.calculateChecksum(backupPath)
    };

    const metadataPath = backupPath + '.meta';
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async calculateChecksum(filePath) {
    const data = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.db')) {
          const backupPath = path.join(this.backupDir, file);
          const metadataPath = backupPath + '.meta';
          
          let metadata = null;
          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (error) {
            // Metadata file doesn't exist, create basic info
            const stats = await fs.stat(backupPath);
            metadata = {
              timestamp: file.replace('backup-', '').replace('.db', ''),
              size: stats.size,
              checksum: await this.calculateChecksum(backupPath)
            };
          }

          backups.push({
            file: file,
            path: backupPath,
            metadata: metadata
          });
        }
      }

      return backups.sort((a, b) => 
        new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp)
      );
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  async restoreBackup(backupPath) {
    return new Promise((resolve, reject) => {
      // Verify backup integrity
      this.verifyBackupIntegrity(backupPath).then((isValid) => {
        if (!isValid) {
          reject(new Error('Backup integrity check failed'));
          return;
        }

        // Create temporary backup of current database
        const currentBackupPath = this.dbPath + '.restore-backup';
        
        fs.copyFile(this.dbPath, currentBackupPath).then(() => {
          // Restore from backup
          const sourceDb = new sqlite3.Database(backupPath, (err) => {
            if (err) {
              reject(err);
              return;
            }
          });

          const targetDb = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
              sourceDb.close();
              reject(err);
              return;
            }
          });

          // Perform restore
          sourceDb.backup(targetDb, (err) => {
            sourceDb.close();
            targetDb.close();
            
            if (err) {
              // Restore failed, try to restore from temporary backup
              fs.copyFile(currentBackupPath, this.dbPath).then(() => {
                reject(err);
              }).catch(() => {
                reject(new Error('Restore failed and rollback failed'));
              });
            } else {
              // Clean up temporary backup
              fs.unlink(currentBackupPath).catch(() => {});
              console.log('Database restored successfully');
              resolve({ success: true });
            }
          });
        }).catch(reject);
      }).catch(reject);
    });
  }

  async verifyBackupIntegrity(backupPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          resolve(false);
          return;
        }

        // Check if database is valid
        db.get("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
          db.close();
          resolve(!err && row);
        });
      });
    });
  }

  async checkDatabaseIntegrity() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
      });

      db.get("PRAGMA integrity_check", (err, row) => {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          const isIntegrityOk = row && row.integrity_check === 'ok';
          resolve({
            success: isIntegrityOk,
            result: row ? row.integrity_check : 'unknown'
          });
        }
      });
    });
  }

  async getDatabaseSize() {
    try {
      const stats = await fs.stat(this.dbPath);
      return {
        size: stats.size,
        sizeInMB: (stats.size / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting database size:', error);
      return { size: 0, sizeInMB: '0.00' };
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      
      if (backups.length > this.maxBackups) {
        const backupsToDelete = backups.slice(this.maxBackups);
        
        for (const backup of backupsToDelete) {
          try {
            await fs.unlink(backup.path);
            const metadataPath = backup.path + '.meta';
            await fs.unlink(metadataPath).catch(() => {});
            console.log(`Deleted old backup: ${backup.file}`);
          } catch (error) {
            console.error(`Error deleting backup ${backup.file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  async performMaintenance() {
    try {
      console.log('Starting database maintenance...');
      
      // Create backup before maintenance
      await this.createBackup();
      
      // Check integrity
      const integrityResult = await this.checkDatabaseIntegrity();
      if (!integrityResult.success) {
        throw new Error(`Database integrity check failed: ${integrityResult.result}`);
      }
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      // Get database size
      const sizeInfo = await this.getDatabaseSize();
      
      console.log('Database maintenance completed successfully');
      return {
        success: true,
        integrityCheck: integrityResult,
        databaseSize: sizeInfo,
        backupCount: (await this.listBackups()).length
      };
    } catch (error) {
      console.error('Database maintenance failed:', error);
      throw error;
    }
  }

  async scheduleBackup() {
    // This would be called periodically by the application
    try {
      const lastBackup = await this.getLastBackupTime();
      const now = Date.now();
      
      if (!lastBackup || (now - lastBackup) > this.backupInterval) {
        await this.createBackup();
        return { success: true, message: 'Scheduled backup completed' };
      } else {
        return { success: true, message: 'Backup not due yet' };
      }
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getLastBackupTime() {
    try {
      const backups = await this.listBackups();
      if (backups.length > 0) {
        return new Date(backups[0].metadata.timestamp).getTime();
      }
      return null;
    } catch (error) {
      console.error('Error getting last backup time:', error);
      return null;
    }
  }
}

module.exports = { BackupManager };
