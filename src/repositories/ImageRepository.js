/**
 * ImageRepository - Persistence layer for generated images (ADR-009)
 * Extracted from: GeneratedImage.js | Feature: FEATURE_MODULAR_IMAGE_REPOSITORY
 * Related ADRs: 001 (< 400 lines), 003 (DI), 006 (Shadow Bridge), 009 (Repository)
 * Handles all DB operations for generated_images table
 */
class ImageRepository {
  /**
   * @param {Object} generatedImageModel - GeneratedImage model instance (provides db connection)
   */
  constructor(generatedImageModel) {
    this.model = generatedImageModel;
    this.db = generatedImageModel.db;
  }

  /** Get image metadata with LEFT JOIN - Extracted from: GeneratedImage.js lines 747-779 */
  async getImageMetadata(executionId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT gi.*, je.configuration_id, je.status as job_status
        FROM generated_images gi
        LEFT JOIN job_executions je ON gi.execution_id = je.id
        WHERE gi.execution_id = ?
        ORDER BY gi.created_at DESC
      `;
      
      this.db.all(sql, [executionId], (err, rows) => {
        if (err) {
          console.error('Error getting image metadata:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          }));
          resolve({ success: true, images });
        }
      });
    });
  }

  /** Get image statistics - Extracted from: GeneratedImage.js lines 781-805 */
  async getImageStatistics() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as totalImages,
          SUM(CASE WHEN qc_status = 'approved' THEN 1 ELSE 0 END) as approvedImages,
          SUM(CASE WHEN qc_status = 'failed' THEN 1 ELSE 0 END) as failedImages
        FROM generated_images
      `;
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error getting image statistics:', err);
          reject(err);
        } else {
          const stats = {
            totalImages: row.totalImages || 0,
            approvedImages: row.approvedImages || 0,
            failedImages: row.failedImages || 0
          };
          resolve({ success: true, statistics: stats });
        }
      });
    });
  }

  /** Update metadata with JSON merge - Extracted from: GeneratedImage.js lines 720-745 */
  async updateMetadataById(id, newMetadata) {
    return new Promise((resolve, reject) => {
      const selectSql = 'SELECT metadata FROM generated_images WHERE id = ?';
      this.db.get(selectSql, [id], (err, row) => {
        if (err) {
          console.error('Error getting existing image metadata by id:', err);
          reject(err);
          return;
        }
        let existing = {};
        if (row && row.metadata) {
          try { existing = JSON.parse(row.metadata); } catch (_) { existing = {}; }
        }
        const merged = { ...existing, ...newMetadata };
        const updateSql = 'UPDATE generated_images SET metadata = ? WHERE id = ?';
        this.db.run(updateSql, [JSON.stringify(merged), id], function(err2) {
          if (err2) {
            console.error('Error updating image metadata by id:', err2);
            reject(err2);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        });
      });
    });
  }

  /** Bulk delete with file cleanup - Extracted from: GeneratedImage.js lines 807-869 */
  async bulkDeleteGeneratedImages(imageIds) {
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return { success: false, error: 'No image IDs provided' };
    }

    return new Promise((resolve, reject) => {
      // First, get all image data to find file paths
      const getPromises = imageIds.map(id => this.model.getGeneratedImage(id));
      
      Promise.all(getPromises).then(results => {
        const imagesToDelete = results
          .filter(res => res.success && res.image)
          .map(res => res.image);

        // Delete the database records
        const placeholders = imageIds.map(() => '?').join(',');
        const sql = `DELETE FROM generated_images WHERE id IN (${placeholders})`;
        
        this.db.run(sql, imageIds, (err) => {
          if (err) {
            console.error('Error bulk deleting generated images from database:', err);
            reject(err);
          } else {
            const changes = this.changes;
            console.log(`Bulk deleted ${changes} generated images from database`);
            
            // Now delete all the actual files
            const fsP = require('fs').promises;
            let filesDeleted = 0;
            const unlinkPromises = imagesToDelete.map(image => {
              const filePath = image.finalImagePath || image.tempImagePath;
              if (filePath) {
                return fsP.unlink(filePath).then(() => {
                  filesDeleted++;
                }).catch(_e => {
                  console.warn(`️ Failed to delete file ${filePath}:`, _e.message);
                });
              }
              return Promise.resolve();
            });
            
            Promise.all(unlinkPromises).then(() => {
              resolve({
                success: true,
                deletedRows: changes,
                filesDeleted,
                totalImages: imagesToDelete.length
              });
            }).catch(_err => {
              // Even if unlinks fail, we resolve success because DB records are gone
              resolve({
                success: true,
                deletedRows: changes,
                filesDeleted,
                totalImages: imagesToDelete.length,
                warning: 'Some files could not be deleted'
              });
            });
          }
        });
      }).catch(reject);
    });
  }

  /**
   * Find images by QC status with optional pagination
   * 
   * @param {string} qcStatus - QC status ('approved', 'failed', 'pending', etc.)
   * @param {Object} [opts] - Optional { limit, offset } for pagination
   * @returns {Promise<Object>} { success: true, images: [...] }
   */
  async findByQcStatus(qcStatus, opts = {}) {
    const limit = opts.limit != null ? Math.max(0, parseInt(opts.limit, 10)) : null;
    const offset = opts.offset != null ? Math.max(0, parseInt(opts.offset, 10)) : 0;
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM generated_images WHERE qc_status = ? ORDER BY created_at DESC';
      const params = [qcStatus];
      if (limit != null && limit > 0) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error getting images by QC status:', err);
          reject(err);
        } else {
          // Parse JSON fields and convert timestamps
          const images = rows.map(row => ({
            id: row.id,
            imageMappingId: row.image_mapping_id,
            executionId: row.execution_id,
            generationPrompt: row.generation_prompt,
            seed: row.seed,
            qcStatus: row.qc_status,
            qcReason: row.qc_reason,
            finalImagePath: row.final_image_path,
            tempImagePath: row.temp_image_path,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null,
            createdAt: row.created_at ? new Date(row.created_at) : null
          }));
          resolve({ success: true, images });
        }
      });
    });
  }

  /**
   * Bulk update QC status by mapping ID
   * 
   * Extracted from: GeneratedImage.js (bulk update logic)
   * Logic: Update qc_status and qc_reason for multiple images
   * 
   * @param {Array<Object>} mappings - Array of { mappingId, status, reason }
   * @returns {Promise<Object>} { success: true, updated: number }
   */
  async bulkUpdateQcStatus(mappings) {
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return { success: false, error: 'No mappings provided' };
    }

    return new Promise((resolve, reject) => {
      const updatePromises = mappings.map(mapping => {
        return new Promise((res, rej) => {
          const sql = 'UPDATE generated_images SET qc_status = ?, qc_reason = ? WHERE image_mapping_id = ?';
          this.db.run(sql, [mapping.status, mapping.reason || null, mapping.mappingId], function(err) {
            if (err) {
              console.error('Error updating QC status by mapping ID:', err);
              rej(err);
            } else {
              res(this.changes);
            }
          });
        });
      });

      Promise.all(updatePromises).then(results => {
        const totalUpdated = results.reduce((sum, changes) => sum + changes, 0);
        resolve({ success: true, updated: totalUpdated });
      }).catch(reject);
    });
  }

  /** Delete images by execution ID - Extracted from: GeneratedImage.js (cascade delete) */
  async deleteByExecution(executionId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM generated_images WHERE execution_id = ?', [executionId], function(err) {
        if (err) { console.error('Error deleting images by execution ID:', err); reject(err); }
        else { console.log(`Deleted ${this.changes} images for execution ${executionId}`); resolve({ success: true, deletedRows: this.changes }); }
      });
    });
  }

  /** Save generated image - Extracted from: GeneratedImage.js lines 391-424 */
  async saveGeneratedImage(image) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO generated_images (image_mapping_id, execution_id, generation_prompt, seed, qc_status, qc_reason, final_image_path, temp_image_path, metadata, processing_settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [image.imageMappingId, image.executionId, image.generationPrompt, image.seed || null, image.qcStatus || 'qc_failed', image.qcReason || null, image.finalImagePath || null, image.tempImagePath || null, image.metadata ? JSON.stringify(image.metadata) : null, image.processingSettings ? JSON.stringify(image.processingSettings) : null];
      this.db.run(sql, params, function(err) {
        if (err) { console.error('Error saving generated image:', err); reject(err); }
        else { console.log('Generated image saved successfully'); resolve({ success: true, id: this.lastID }); }
      });
    });
  }

  /** Get single generated image by ID - Extracted from: GeneratedImage.js lines 426-456 */
  async getGeneratedImage(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM generated_images WHERE id = ?', [id], (err, row) => {
        if (err) { console.error('Error getting generated image:', err); reject(err); }
        else if (row) {
          const image = { id: row.id, imageMappingId: row.image_mapping_id, executionId: row.execution_id, generationPrompt: row.generation_prompt, seed: row.seed, qcStatus: row.qc_status, qcReason: row.qc_reason, finalImagePath: row.final_image_path, tempImagePath: row.temp_image_path, metadata: row.metadata ? JSON.parse(row.metadata) : null, processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null, createdAt: row.created_at ? new Date(row.created_at) : null };
          resolve({ success: true, image });
        } else { resolve({ success: false, error: 'Generated image not found' }); }
      });
    });
  }

  /** Get images by execution ID - Extracted from: GeneratedImage.js lines 458-488 */
  async getGeneratedImagesByExecution(executionId) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM generated_images WHERE execution_id = ? ORDER BY created_at DESC', [executionId], (err, rows) => {
        if (err) { console.error('Error getting generated images by execution:', err); reject(err); }
        else {
          const images = rows.map(row => ({ id: row.id, imageMappingId: row.image_mapping_id, executionId: row.execution_id, generationPrompt: row.generation_prompt, seed: row.seed, qcStatus: row.qc_status, qcReason: row.qc_reason, finalImagePath: row.final_image_path, tempImagePath: row.temp_image_path, metadata: row.metadata ? JSON.parse(row.metadata) : null, processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null, createdAt: row.created_at ? new Date(row.created_at) : null }));
          resolve({ success: true, images });
        }
      });
    });
  }

  /** Get all generated images with limit - Extracted from: GeneratedImage.js lines 490-518 */
  async getAllGeneratedImages(limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM generated_images ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
        if (err) { console.error('Error getting all generated images:', err); reject(err); }
        else {
          const images = rows.map(row => ({ id: row.id, imageMappingId: row.image_mapping_id, executionId: row.execution_id, generationPrompt: row.generation_prompt, seed: row.seed, qcStatus: row.qc_status, qcReason: row.qc_reason, finalImagePath: row.final_image_path, tempImagePath: row.temp_image_path, metadata: row.metadata ? JSON.parse(row.metadata) : null, processingSettings: row.processing_settings ? JSON.parse(row.processing_settings) : null, createdAt: row.created_at ? new Date(row.created_at) : null }));
          resolve({ success: true, images });
        }
      });
    });
  }

  /** Update generated image - Extracted from: GeneratedImage.js lines 520-551 */
  async updateGeneratedImage(id, image) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE generated_images SET execution_id = ?, generation_prompt = ?, seed = ?, qc_status = ?, qc_reason = ?, final_image_path = ?, metadata = ?, processing_settings = ? WHERE id = ?`;
      const params = [image.executionId, image.generationPrompt, image.seed || null, image.qcStatus, image.qcReason || null, image.finalImagePath || null, image.metadata ? JSON.stringify(image.metadata) : null, image.processingSettings ? JSON.stringify(image.processingSettings) : null, id];
      this.db.run(sql, params, function(err) {
        if (err) { console.error('Error updating generated image:', err); reject(err); }
        else { console.log('Generated image updated successfully'); resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Delete generated image by ID with file cleanup - Extracted from: GeneratedImage.js lines 578-609 */
  async deleteGeneratedImage(id) {
    return new Promise((resolve, reject) => {
      this.getGeneratedImage(id).then(imageResult => {
        if (!imageResult.success || !imageResult.image) { reject(new Error(`Image ${id} not found`)); return; }
        const filePath = imageResult.image.finalImagePath || imageResult.image.tempImagePath;
        this.db.run('DELETE FROM generated_images WHERE id = ?', [id], function(err) {
          if (err) { reject(err); }
          else {
            if (filePath) { require('fs').promises.unlink(filePath).catch(fileErr => console.warn(`Failed to delete image file ${filePath}:`, fileErr.message)); }
            resolve({ success: true, changes: this.changes });
          }
        });
      }).catch(reject);
    });
  }

  /** Update QC status by ID - Extracted from: GeneratedImage.js lines 641-655 */
  async updateQCStatus(id, status, reason = null) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE generated_images SET qc_status = ?, qc_reason = ? WHERE id = ?', [status, reason, id], function(err) {
        if (err) { console.error('Error updating QC status:', err); reject(err); }
        else { resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Update QC status by mapping ID - Extracted from: GeneratedImage.js lines 657-671 */
  async updateQCStatusByMappingId(mappingId, status, reason = null) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE generated_images SET qc_status = ?, qc_reason = ? WHERE image_mapping_id = ?', [status, reason, mappingId], function(err) {
        if (err) { console.error('Error updating QC status by mapping ID:', err); reject(err); }
        else { resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Update image by mapping ID - Extracted from: GeneratedImage.js lines 673-735 */
  async updateGeneratedImageByMappingId(mappingId, image) {
    return new Promise((resolve, reject) => {
      // First, get existing image data to merge metadata properly
      const selectSql = 'SELECT metadata FROM generated_images WHERE image_mapping_id = ?';
      this.db.get(selectSql, [mappingId], (err, row) => {
        if (err) { console.error('Error getting existing image data:', err); reject(err); return; }
        if (!row) { reject(new Error(`Image with mapping ID ${mappingId} not found`)); return; }
        // Parse existing metadata and merge with new metadata
        let existingMetadata = {};
        if (row.metadata) {
          try { existingMetadata = JSON.parse(row.metadata); }
          catch (parseError) { console.warn(`Failed to parse existing metadata for ${mappingId}:`, parseError); existingMetadata = {}; }
        }
        // Merge existing metadata with new metadata
        const mergedMetadata = { ...existingMetadata, ...image.metadata };
        console.log(`Merging metadata for ${mappingId}:`, { existing: existingMetadata, new: image.metadata, merged: mergedMetadata });
        const updateSql = `UPDATE generated_images SET metadata = ? WHERE image_mapping_id = ?`;
        const params = [JSON.stringify(mergedMetadata), mappingId];
        this.db.run(updateSql, params, function(err) {
          if (err) { console.error('Error updating generated image by mapping ID:', err); reject(err); }
          else { console.log(`Generated image metadata updated successfully for mapping ID: ${mappingId}`); resolve({ success: true, changes: this.changes }); }
        });
      });
    });
  }

  /** Update image paths by mapping ID - Extracted from: GeneratedImage.js lines 1037-1056 */
  async updateImagePathsByMappingId(mappingId, tempImagePath, finalImagePath) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE generated_images SET temp_image_path = ?, final_image_path = ? WHERE image_mapping_id = ?';
      const params = [tempImagePath, finalImagePath, mappingId];
      this.db.run(sql, params, function(err) {
        if (err) { console.error('Error updating image paths by mapping ID:', err); reject(err); }
        else { resolve({ success: true, changes: this.changes }); }
      });
    });
  }

  /** Update image paths by id - Extracted from: GeneratedImage.js lines 1059-1077 */
  async updateImagePathsById(id, tempImagePath, finalImagePath) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE generated_images SET temp_image_path = ?, final_image_path = ? WHERE id = ?';
      const params = [tempImagePath, finalImagePath, id];
      this.db.run(sql, params, function(err) {
        if (err) { console.error('Error updating image paths by id:', err); reject(err); }
        else { resolve({ success: true, changes: this.changes }); }
      });
    });
  }
}

module.exports = { ImageRepository };
