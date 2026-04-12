/**
 * QC-status image query with job_executions / job_configurations JOIN for per-image display labels.
 * Keeps ImageRepository.findByQcStatus thin (ADR-001).
 */
const { resolveExecutionDisplayLabel, formatRerunExecutionLabel } = require('../utils/resolveExecutionDisplayLabel');

function mapRowToImage(row) {
  const baseLabel = resolveExecutionDisplayLabel({
    label: row.je_label,
    configurationName: row.jc_configuration_name,
    configurationSnapshotJson: row.je_configuration_snapshot,
    startedAt: row.je_started_at,
    executionId: row.execution_id,
  });
  const jobDisplayLabel = formatRerunExecutionLabel(baseLabel, row.execution_id);

  return {
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
    createdAt: row.created_at ? new Date(row.created_at) : null,
    jobDisplayLabel,
  };
}

/**
 * @param {import('sqlite3').Database} db
 * @param {string} qcStatus
 * @param {{ limit?: number, offset?: number }} [opts]
 */
function findImagesByQcStatus(db, qcStatus, opts = {}) {
  const limit = opts.limit != null ? Math.max(0, parseInt(String(opts.limit), 10)) : null;
  const offset = opts.offset != null ? Math.max(0, parseInt(String(opts.offset), 10)) : 0;

  return new Promise((resolve, reject) => {
    let sql = `
      SELECT
        gi.*,
        je.label AS je_label,
        je.started_at AS je_started_at,
        je.configuration_snapshot AS je_configuration_snapshot,
        jc.name AS jc_configuration_name
      FROM generated_images gi
      LEFT JOIN job_executions je ON gi.execution_id = je.id
      LEFT JOIN job_configurations jc ON je.configuration_id = jc.id
      WHERE gi.qc_status = ?
      ORDER BY gi.created_at DESC
    `;
    const params = [qcStatus];
    if (limit != null && limit > 0) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error getting images by QC status:', err);
        reject(err);
        return;
      }
      let images;
      try {
        images = rows.map(mapRowToImage);
      } catch (e) {
        reject(e);
        return;
      }
      resolve({ success: true, images });
    });
  });
}

module.exports = { findImagesByQcStatus };
