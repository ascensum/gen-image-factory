/**
 * ExportService - Excel and ZIP Export Generation
 * 
 * Extracted from: BackendAdapter (lines ~1803-2032, ~2579-2832)
 * Responsibility: Pure functional transformation of Job/Image Data → Excel/ZIP Files
 * 
 * ADR-001: File Size Guardrail (< 400 lines)
 * ADR-003: Dependency Injection (constructor-based)
 * ADR-006: Shadow Bridge Pattern (feature toggle: FEATURE_MODULAR_EXPORT)
 * 
 * CRITICAL: This is a SURGICAL EXTRACTION - logic copied VERBATIM from backendAdapter.js
 * NO OPTIMIZATIONS, NO RESTYLING, NO LOGIC CHANGES - 1:1 behavioral parity required
 */

const path = require('path');
const ExcelJS = require('exceljs');

class ExportService {
  constructor(jobExecution, generatedImage, jobConfig) {
    this.jobExecution = jobExecution;
    this.generatedImage = generatedImage;
    this.jobConfig = jobConfig;
  }

  _formatSettingLabel(key) {
    const mapping = {
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
    if (mapping[key]) return mapping[key];
    const last = key.split('.').pop();
    return last.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  _flattenSettings(obj, prefix = '') {
    const result = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result.push(...this._flattenSettings(value, fullKey));
      } else {
        result.push([fullKey, value]);
      }
    }
    return result;
  }

  _createJobSummaryData(job, jobConfig) {
    const jobSummaryData = [
      ['Job ID', 'Label', 'Status', 'Started At', 'Completed At', 'Total Images', 'Successful Images', 'Failed Images', 'Error Message', 'Configuration ID'],
      [
        job.id,
        job.label || 'No label',
        job.status,
        job.startedAt ? new Date(job.startedAt).toLocaleString() : 'N/A',
        job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A',
        job.totalImages || 0,
        job.successfulImages || 0,
        job.failedImages || 0,
        job.errorMessage || 'None',
        job.configurationId || 'None'
      ]
    ];

    if (jobConfig) {
      jobSummaryData[0].push('Configuration Name', 'Created At', 'Updated At');
      jobSummaryData[1].push(
        jobConfig.name || 'Unknown',
        jobConfig.createdAt ? new Date(jobConfig.createdAt).toLocaleString() : 'N/A',
        jobConfig.updatedAt ? new Date(jobConfig.updatedAt).toLocaleString() : 'N/A'
      );
    }

    const effectiveSettings = job.configurationSnapshot || (jobConfig && jobConfig.settings) || null;
    if (effectiveSettings) {
      const flattenedSettings = this._flattenSettings(effectiveSettings)
        .filter(([key]) => !key.startsWith('apiKeys.'))
        .filter(([key]) => !['parameters.mjVersion', 'parameters.aspectRatios', 'parameters.openaiModel', 'parameters.processMode'].includes(key))
        .filter(([key]) => key !== 'parameters.label');
      flattenedSettings.forEach(([key, value]) => {
        jobSummaryData[0].push(this._formatSettingLabel(key));
        jobSummaryData[1].push(value);
      });
    }

    return jobSummaryData;
  }

  _createImagesData(images) {
    const imagesData = [
      ['Image ID', 'Execution ID', 'Generation Prompt', 'Seed', 'QC Status', 'QC Reason', 'Final Image Path', 'Created At']
    ];
    
    images.forEach(image => {
      imagesData.push([
        image.id,
        image.executionId,
        image.generationPrompt || 'N/A',
        image.seed || 'N/A',
        image.qcStatus || 'N/A',
        image.qcReason || 'N/A',
        image.finalImagePath || 'N/A',
        image.createdAt ? new Date(image.createdAt).toLocaleString() : 'N/A'
      ]);
    });

    return imagesData;
  }

  _resolveExportPath(job, options, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const shortId = (job && job.id) ? String(job.id).slice(-6) : '';
    const baseLabel = (job && job.label && String(job.label).trim() !== '')
      ? String(job.label)
      : (shortId || (job && job.configurationName) || 'Job');
    const jobLabel = baseLabel.replace(/[^a-zA-Z0-9-_]/g, '_');
    const defaultFilename = `${jobLabel}_${job.id}_${timestamp}.${extension}`;
    const ensureExt = (name) => name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
    const sanitize = (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '_');

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
          try { fsSync.unlinkSync(full); } catch {
            // Ignore errors when deleting existing file
          }
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

  async exportJobToExcel(jobId, options = {}) {
    try {
      const jobResult = await this.jobExecution.getJobExecution(jobId);
      if (!jobResult.success) {
        return { success: false, error: 'Failed to get job execution' };
      }
      
      const job = jobResult.execution;
      
      const imagesResult = await this.generatedImage.getGeneratedImagesByExecution(jobId);
      const images = imagesResult.success ? imagesResult.images || [] : [];
      
      let jobConfig = null;
      if (job.configurationId) {
        try {
          const configResult = await this.jobConfig.getConfigurationById(job.configurationId);
          if (configResult.success) {
            jobConfig = configResult.configuration;
          }
        } catch (error) {
          console.warn('Could not load job configuration:', error);
        }
      }
      
      const workbook = new ExcelJS.Workbook();
      
      const jobSummaryData = this._createJobSummaryData(job, jobConfig);
      const jobSummarySheet = workbook.addWorksheet('Job Summary');
      jobSummarySheet.addRows(jobSummaryData);
      
      if (images.length > 0) {
        const imagesData = this._createImagesData(images);
        const imagesSheet = workbook.addWorksheet('Images');
        imagesSheet.addRows(imagesData);
      }
      
      const filePath = this._resolveExportPath(job, options, 'xlsx');
      
      await workbook.xlsx.writeFile(filePath);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const fsSync = require('fs');
      if (!fsSync.existsSync(filePath)) {
        throw new Error('Export file was not created successfully');
      }
      
      const stats = fsSync.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('Export file is empty');
      }
      
      console.log('Excel export created successfully:', filePath);
      
      return { success: true, filePath, filename: path.basename(filePath), message: `Export created successfully: ${path.basename(filePath)}` };
      
    } catch (error) {
      console.error('Error exporting job to Excel:', error);
      return { success: false, error: error.message };
    }
  }

  async bulkExportJobExecutions(ids, options = {}) {
    try {
      const jobs = await this.jobExecution.getJobExecutionsByIds(ids);
      if (!jobs.success) {
        return { success: false, error: 'Failed to retrieve jobs for export' };
      }
      
      if (jobs.executions.length === 0) {
        return { success: false, error: 'No jobs found for export' };
      }
      
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      const electronMod = require('electron');
      const app = electronMod && electronMod.app ? electronMod.app : undefined;
      const exportDir = app && typeof app.getPath === 'function'
        ? path.join(app.getPath('userData'), 'exports')
        : path.join(require('os').tmpdir(), 'gen-image-factory-exports');
      const fsSync_bulk = require('fs');
      if (!fsSync_bulk.existsSync(exportDir)) {
        fsSync_bulk.mkdirSync(exportDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sanitize = (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '_');
      const ensureZipExt = (name) => name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`;

      let zipPath;
      if (options && options.outputPath) {
        const dir = path.dirname(options.outputPath);
        const base = ensureZipExt(sanitize(path.basename(options.outputPath)));
        if (!fsSync_bulk.existsSync(dir)) fsSync_bulk.mkdirSync(dir, { recursive: true });
        const full = path.join(dir, base);
        const policy = options.duplicatePolicy || 'append';
        if (fsSync_bulk.existsSync(full)) {
          if (policy === 'overwrite') {
            try { fsSync_bulk.unlinkSync(full); } catch {
              // Ignore errors when deleting existing file
            }
            zipPath = full;
          } else {
            const nameNoExt = base.replace(/\.zip$/i, '');
            let n = 1;
            let candidate = path.join(dir, `${nameNoExt} (${n}).zip`);
            while (fsSync_bulk.existsSync(candidate) && n < 1000) {
              n += 1;
              candidate = path.join(dir, `${nameNoExt} (${n}).zip`);
            }
            zipPath = candidate;
          }
        } else {
          zipPath = full;
        }
      } else {
        const zipFilename = `bulk_export_${timestamp}.zip`;
        zipPath = path.join(exportDir, zipFilename);
      }
      const output = fsSync_bulk.createWriteStream(zipPath);
      archive.pipe(output);
      
      const exportedFiles = [];
      
      for (const job of jobs.executions) {
        try {
          const jobData = job;
          
          const imagesResult = await this.generatedImage.getGeneratedImagesByExecution(job.id);
          const images = imagesResult.success ? imagesResult.images || [] : [];
          
          let jobConfig = null;
          if (jobData.configurationId) {
            try {
              const configResult = await this.jobConfig.getConfigurationById(jobData.configurationId);
              if (configResult.success) {
                jobConfig = configResult.configuration;
              }
            } catch (error) {
              console.warn('Could not load job configuration:', error);
            }
          }
          
          const workbook = new ExcelJS.Workbook();
          
          const jobSummaryData = this._createJobSummaryData(jobData, jobConfig);
          const jobSummarySheet = workbook.addWorksheet('Job Summary');
          jobSummarySheet.addRows(jobSummaryData);
          
          if (images.length > 0) {
            const imagesData = this._createImagesData(images);
            const imagesSheet = workbook.addWorksheet('Images');
            imagesSheet.addRows(imagesData);
          }
          
          const jobLabel = jobData.label && jobData.label.trim() !== '' ? jobData.label.replace(/[^a-zA-Z0-9]/g, '_') : 'Job';
          const filename = `${jobLabel}_${jobData.id}_${timestamp}.xlsx`;
          
          const excelBuffer = await workbook.xlsx.writeBuffer();
          archive.append(excelBuffer, { name: filename });
          
          exportedFiles.push({
            jobId: jobData.id,
            label: jobData.label || 'No label',
            filename: filename
          });
        } catch (error) {
          console.warn(`Error exporting job ${job.id}:`, error);
        }
      }
      
      if (exportedFiles.length === 0) {
        return { success: false, error: 'Failed to export any jobs' };
      }
      
      const summaryContent = `Bulk Export Summary\nGenerated: ${new Date().toISOString()}\nTotal Jobs: ${jobs.executions.length}\nSuccessfully Exported: ${exportedFiles.length}\n\nExported Jobs:\n${exportedFiles.map(file => `- ${file.label} (ID: ${file.jobId}): ${file.filename}`).join('\n')}\n`;
      
      archive.append(summaryContent, { name: 'export_summary.txt' });
      
      await archive.finalize();
      
      return { 
        success: true, 
        exportedFiles: exportedFiles,
        zipPath,
        totalJobs: jobs.executions.length,
        successfulExports: exportedFiles.length,
        message: `Successfully exported ${exportedFiles.length} out of ${jobs.executions.length} jobs to ZIP file`
      };
      
    } catch (error) {
      console.error('Error bulk exporting job executions:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ExportService;
