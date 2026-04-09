/**
 * ExportService - Excel, ZIP Export Generation, and push event emission
 * 
 * Extracted from: BackendAdapter (lines ~1803-2032, ~2579-2832, ~3671-3846)
 * Responsibility: Pure functional transformation of Job/Image Data → Excel/ZIP Files
 * 
 * ADR-001: File Size Guardrail (< 400 lines)
 * ADR-003: Dependency Injection (constructor-based)
 */

const path = require('path');
const fs = require('fs').promises;
const ExcelJS = require('exceljs');
const { formatSettingLabel, flattenSettings, resolveExportPath } = require('../utils/exportHelpers');

class ExportService {
  /**
   * @param {Object} jobExecution - JobExecution model or JobRepository
   * @param {Object} generatedImage - GeneratedImage model or ImageRepository
   * @param {Object} jobConfig - JobConfiguration model or JobConfigurationRepository
   * @param {Object} [options]
   * @param {Function} [options.sendToRenderer] - (channel, data) => void for IPC push events
   */
  constructor(jobExecution, generatedImage, jobConfig, options = {}) {
    this.jobExecution = jobExecution;
    this.generatedImage = generatedImage;
    this.jobConfig = jobConfig;
    this.sendToRenderer = typeof options.sendToRenderer === 'function' ? options.sendToRenderer : () => {};
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
      const entries = flattenSettings(effectiveSettings)
        .filter(([key]) => !key.startsWith('apiKeys.'))
        .filter(([key]) => !['parameters.mjVersion', 'parameters.aspectRatios', 'parameters.openaiModel', 'parameters.processMode'].includes(key))
        .filter(([key]) => key !== 'parameters.label');
      entries.forEach(([key, value]) => {
        jobSummaryData[0].push(formatSettingLabel(key));
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
        image.id, image.executionId, image.generationPrompt || 'N/A', image.seed || 'N/A',
        image.qcStatus || 'N/A', image.qcReason || 'N/A', image.finalImagePath || 'N/A',
        image.createdAt ? new Date(image.createdAt).toLocaleString() : 'N/A'
      ]);
    });
    return imagesData;
  }

  _resolveJobExportPath(job, options, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const shortId = (job && job.id) ? String(job.id).slice(-6) : '';
    const baseLabel = (job && job.label && String(job.label).trim() !== '')
      ? String(job.label) : (shortId || (job && job.configurationName) || 'Job');
    const jobLabel = baseLabel.replace(/[^a-zA-Z0-9-_]/g, '_');
    const defaultFilename = `${jobLabel}_${job.id}_${timestamp}.${extension}`;
    return resolveExportPath(options, defaultFilename, extension);
  }

  async exportJobToExcel(jobId, options = {}) {
    try {
      const jobResult = await this.jobExecution.getJobExecution(jobId);
      if (!jobResult.success) return { success: false, error: 'Failed to get job execution' };
      const job = jobResult.execution;

      const imagesResult = await this.generatedImage.getGeneratedImagesByExecution(jobId);
      const images = imagesResult.success ? imagesResult.images || [] : [];

      let jobConfig = null;
      if (job.configurationId) {
        try {
          const configResult = await this.jobConfig.getConfigurationById(job.configurationId);
          if (configResult.success) jobConfig = configResult.configuration;
        } catch (error) { console.warn('Could not load job configuration:', error); }
      }

      const workbook = new ExcelJS.Workbook();
      const jobSummarySheet = workbook.addWorksheet('Job Summary');
      jobSummarySheet.addRows(this._createJobSummaryData(job, jobConfig));

      if (images.length > 0) {
        const imagesSheet = workbook.addWorksheet('Images');
        imagesSheet.addRows(this._createImagesData(images));
      }

      const filePath = this._resolveJobExportPath(job, options, 'xlsx');
      await workbook.xlsx.writeFile(filePath);
      await new Promise(resolve => setTimeout(resolve, 100));

      const fsSync = require('fs');
      if (!fsSync.existsSync(filePath)) throw new Error('Export file was not created successfully');
      const stats = fsSync.statSync(filePath);
      if (stats.size === 0) throw new Error('Export file is empty');

      return { success: true, filePath, filename: path.basename(filePath), message: `Export created successfully: ${path.basename(filePath)}` };
    } catch (error) {
      console.error('Error exporting job to Excel:', error);
      return { success: false, error: error.message };
    }
  }

  async bulkExportJobExecutions(ids, options = {}) {
    try {
      const jobs = await this.jobExecution.getJobExecutionsByIds(ids);
      if (!jobs.success) return { success: false, error: 'Failed to retrieve jobs for export' };
      if (jobs.executions.length === 0) return { success: false, error: 'No jobs found for export' };

      const archiver = require('archiver');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const defaultFilename = `bulk_export_${timestamp}.zip`;
      const zipPath = resolveExportPath(options, defaultFilename, 'zip');

      const fsSync = require('fs');
      const output = fsSync.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);

      const exportedFiles = [];
      for (const job of jobs.executions) {
        try {
          const imagesResult = await this.generatedImage.getGeneratedImagesByExecution(job.id);
          const images = imagesResult.success ? imagesResult.images || [] : [];

          let jobConfig = null;
          if (job.configurationId) {
            try {
              const configResult = await this.jobConfig.getConfigurationById(job.configurationId);
              if (configResult.success) jobConfig = configResult.configuration;
            } catch (error) { console.warn('Could not load job configuration:', error); }
          }

          const workbook = new ExcelJS.Workbook();
          workbook.addWorksheet('Job Summary').addRows(this._createJobSummaryData(job, jobConfig));
          if (images.length > 0) workbook.addWorksheet('Images').addRows(this._createImagesData(images));

          const jobLabel = job.label && job.label.trim() !== '' ? job.label.replace(/[^a-zA-Z0-9]/g, '_') : 'Job';
          const filename = `${jobLabel}_${job.id}_${timestamp}.xlsx`;
          archive.append(await workbook.xlsx.writeBuffer(), { name: filename });
          exportedFiles.push({ jobId: job.id, label: job.label || 'No label', filename });
        } catch (error) { console.warn(`Error exporting job ${job.id}:`, error); }
      }

      if (exportedFiles.length === 0) return { success: false, error: 'Failed to export any jobs' };

      const summaryContent = `Bulk Export Summary\nGenerated: ${new Date().toISOString()}\nTotal Jobs: ${jobs.executions.length}\nSuccessfully Exported: ${exportedFiles.length}\n\nExported Jobs:\n${exportedFiles.map(file => `- ${file.label} (ID: ${file.jobId}): ${file.filename}`).join('\n')}\n`;
      archive.append(summaryContent, { name: 'export_summary.txt' });
      await archive.finalize();

      return { success: true, exportedFiles, zipPath, totalJobs: jobs.executions.length, successfulExports: exportedFiles.length, message: `Successfully exported ${exportedFiles.length} out of ${jobs.executions.length} jobs to ZIP file` };
    } catch (error) {
      console.error('Error bulk exporting job executions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create ZIP export of selected generated images with optional Excel metadata.
   * Ported from backendAdapter.createZipExport (lines 3671-3846).
   * Push events: zip-export:progress, zip-export:completed, zip-export:error (AC: 5)
   */
  async createZipExport(imageIds, includeExcel = true, options = {}) {
    try {
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return { success: false, error: 'No image IDs provided' };
      }

      const archiver = require('archiver');
      const fsSync = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const defaultFilename = `exported-images-${timestamp}.zip`;
      const zipPath = resolveExportPath(options, defaultFilename, 'zip');

      const output = fsSync.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);

      this.sendToRenderer('zip-export:progress', { step: 'gathering-files' });

      const filenameCounts = new Map();
      const metadataRows = [];

      for (const id of imageIds) {
        const res = await this.generatedImage.getGeneratedImage(id);
        if (!res.success || !res.image) continue;
        const img = res.image;
        const filePath = img.finalImagePath || img.tempImagePath;
        if (!filePath) continue;
        try { await fs.access(filePath); } catch { continue; }

        const baseName = path.basename(filePath || '') || `image_${id}`;
        const count = (filenameCounts.get(baseName) || 0) + 1;
        filenameCounts.set(baseName, count);
        const uniqueName = count === 1 ? baseName : `${baseName.replace(/(\.[^.]*)$/, '')}_${count}$1`;
        archive.file(filePath, { name: `images/${uniqueName}` });

        const rawMeta = img.metadata;
        let meta = {};
        if (typeof rawMeta === 'string') { try { meta = JSON.parse(rawMeta); } catch { meta = {}; } }
        else { meta = rawMeta || {}; }
        const title = typeof meta.title === 'object' ? (meta.title?.en || '') : (meta.title || '');
        const description = typeof meta.description === 'object' ? (meta.description?.en || '') : (meta.description || '');
        let tags = '';
        if (meta && typeof meta === 'object') {
          if (meta.uploadTags?.en) tags = String(meta.uploadTags.en);
          else if (typeof meta.uploadTags === 'string') tags = meta.uploadTags;
          else if (meta.upload_tags?.en) tags = String(meta.upload_tags.en);
          else if (typeof meta.upload_tags === 'string') tags = meta.upload_tags;
          else if (Array.isArray(meta.tags)) tags = meta.tags.join(', ');
          else if (typeof meta.tags === 'string') tags = meta.tags;
        }
        if (typeof tags === 'string' && tags.includes(',')) {
          tags = tags.split(',').map((t) => t.trim()).filter(Boolean).join(', ');
        }
        metadataRows.push({ ImageName: baseName, Title: title || '', Description: description || '', Tags: tags || '', Date: img.createdAt ? new Date(img.createdAt).toISOString() : '' });
      }

      if (includeExcel) {
        this.sendToRenderer('zip-export:progress', { step: 'creating-excel' });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Metadata');
        worksheet.columns = [
          { header: 'Image Name', key: 'ImageName', width: 30 },
          { header: 'Title', key: 'Title', width: 40 },
          { header: 'Description', key: 'Description', width: 60 },
          { header: 'Tags', key: 'Tags', width: 40 },
          { header: 'Date', key: 'Date', width: 24 }
        ];
        worksheet.addRows(metadataRows);
        const buffer = await workbook.xlsx.writeBuffer();
        archive.append(Buffer.from(buffer), { name: 'metadata.xlsx' });
      }

      this.sendToRenderer('zip-export:progress', { step: 'zipping' });
      await archive.finalize();
      await new Promise((resolve, reject) => { output.on('close', resolve); output.on('error', reject); });

      this.sendToRenderer('zip-export:completed', { zipPath });
      return { success: true, zipPath, message: 'ZIP export created successfully' };
    } catch (error) {
      console.error('Error creating ZIP export:', error);
      this.sendToRenderer('zip-export:error', { error: error.message || String(error) });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ExportService;
