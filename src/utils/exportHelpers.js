/**
 * Export Helpers - Shared utilities for ExportService
 * Extracted from ExportService to keep services < 400 lines (ADR-001)
 */

const path = require('path');

const SETTING_LABEL_MAP = {
  'parameters.processMode': 'Process Mode',
  'parameters.runwareModel': 'Runware Model',
  'parameters.runwareDimensionsCsv': 'Dimensions (CSV)',
  'parameters.runwareFormat': 'Format',
  'parameters.variations': 'Variations',
  'parameters.runwareAdvanced.CFGScale': 'CFG Scale',
  'parameters.runwareAdvanced.steps': 'Steps',
  'parameters.runwareAdvanced.scheduler': 'Scheduler',
  'parameters.runwareAdvanced.checkNSFW': 'NSFW Check',
  'parameters.openaiModel': 'OpenAI Model',
  'parameters.enablePollingTimeout': 'Enable Generation Timeout',
  'parameters.pollingTimeout': 'Generation Timeout (minutes)',
  'parameters.keywordRandom': 'Keyword Random',
  'processing.removeBg': 'Remove Background',
  'processing.imageConvert': 'Image Convert',
  'processing.imageEnhancement': 'Image Enhancement',
  'processing.sharpening': 'Sharpening Intensity (0-10)',
  'processing.saturation': 'Saturation Level (0-2)',
  'processing.convertToJpg': 'Convert to JPG',
  'processing.trimTransparentBackground': 'Trim Transparent Background',
  'processing.jpgBackground': 'JPG Background',
  'processing.jpgQuality': 'JPG Quality',
  'processing.pngQuality': 'PNG Quality',
  'processing.removeBgSize': 'Remove.bg Size',
  'filePaths.outputDirectory': 'Output Directory',
  'filePaths.tempDirectory': 'Temp Directory',
  'filePaths.systemPromptFile': 'System Prompt File',
  'filePaths.keywordsFile': 'Keywords File',
  'filePaths.qualityCheckPromptFile': 'Quality Check Prompt File',
  'filePaths.metadataPromptFile': 'Metadata Prompt File',
  'ai.runQualityCheck': 'Run Quality Check',
  'ai.runMetadataGen': 'Run Metadata Generation',
  'advanced.debugMode': 'Debug Mode'
};

function formatSettingLabel(key) {
  if (SETTING_LABEL_MAP[key]) return SETTING_LABEL_MAP[key];
  const last = key.split('.').pop();
  return last.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function flattenSettings(obj, prefix = '') {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result.push(...flattenSettings(value, fullKey));
    } else {
      result.push([fullKey, value]);
    }
  }
  return result;
}

/**
 * Resolve export file path with duplicate handling and sanitization.
 * Ported from ExportService._resolveExportPath and backendAdapter ZIP path logic.
 */
function resolveExportPath(options, defaultFilename, extension) {
  const sanitize = (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '_');
  const ensureExt = (name) => name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
  const electronMod = require('electron');
  const app = electronMod && electronMod.app ? electronMod.app : undefined;
  const fsSync = require('fs');

  let filePath;
  if (options && options.outputPath) {
    const dir = path.dirname(options.outputPath);
    const base = ensureExt(sanitize(path.basename(options.outputPath)));
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    const full = path.join(dir, base);
    const policy = options.duplicatePolicy || 'append';
    if (fsSync.existsSync(full)) {
      if (policy === 'overwrite') {
        try { fsSync.unlinkSync(full); } catch { /* ignore */ }
        filePath = full;
      } else {
        const nameNoExt = base.replace(new RegExp(`\\.${extension}$`, 'i'), '');
        let n = 1;
        let candidate = path.join(dir, `${nameNoExt} (${n}).${extension}`);
        while (fsSync.existsSync(candidate) && n < 1000) {
          n += 1;
          candidate = path.join(dir, `${nameNoExt} (${n}).${extension}`);
        }
        filePath = candidate;
      }
    } else {
      filePath = full;
    }
  } else {
    const exportDir = app && typeof app.getPath === 'function'
      ? path.join(app.getPath('userData'), 'exports')
      : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
    if (!fsSync.existsSync(exportDir)) fsSync.mkdirSync(exportDir, { recursive: true });
    filePath = path.join(exportDir, defaultFilename);
  }

  return filePath;
}

module.exports = { formatSettingLabel, flattenSettings, resolveExportPath };
