/**
 * Human-readable job label for UI (Failed Images, gallery, etc.).
 * Mirrors renderer fallbacks: execution label → config name → snapshot parameters.label → started_at stamp → Job <id>.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {object} o
 * @param {string|null|undefined} o.label - job_executions.label
 * @param {string|null|undefined} o.configurationName - job_configurations.name
 * @param {string|null|undefined} o.configurationSnapshotJson - raw JSON string from job_executions.configuration_snapshot
 * @param {string|number|Date|null|undefined} o.startedAt
 * @param {string|number|null|undefined} o.executionId
 * @returns {string}
 */
function resolveExecutionDisplayLabel(o) {
  let snap = '';
  if (o.configurationSnapshotJson) {
    try {
      const raw = o.configurationSnapshotJson;
      const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof s?.parameters?.label === 'string') snap = s.parameters.label.trim();
    } catch (_) {
      /* ignore */
    }
  }
  let out =
    (o.label != null && String(o.label).trim()) ||
    (o.configurationName != null && String(o.configurationName).trim()) ||
    snap ||
    '';
  if (!out && o.startedAt != null) {
    const d = o.startedAt instanceof Date ? o.startedAt : new Date(o.startedAt);
    if (!isNaN(d.getTime())) {
      out = `job_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    }
  }
  if (!out && o.executionId != null && String(o.executionId).trim() !== '') {
    out = `Job ${o.executionId}`;
  }
  return out;
}

/**
 * Match Job Management / Failed Images: "Name (Rerun)" → "Name (Rerun xxxxxx)" using execution id tail.
 * @param {string} base
 * @param {string|number|null|undefined} executionId
 */
function formatRerunExecutionLabel(base, executionId) {
  if (base == null || base === '') return '';
  const s = String(base);
  if (executionId == null) return s;
  if (s.endsWith('(Rerun)')) {
    return s.replace(/\s*\(Rerun\)$/, '') + ` (Rerun ${String(executionId).slice(-6)})`;
  }
  return s;
}

module.exports = { resolveExecutionDisplayLabel, formatRerunExecutionLabel };
