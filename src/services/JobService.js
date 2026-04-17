/**
 * JobService - Coordination Layer (Orchestration + Persistence)
 * 
 * Architectural Pattern: Service Layer (ADR-003, ADR-006)
 * Related: Story 3.1 Phase 4, Story 3.2 Phase 1
 * 
 * Responsibility: Coordinate JobEngine (orchestration) + JobRepository (persistence)
 * 
 * Flow:
 * 1. Accept job configuration
 * 2. Delegate orchestration to JobEngine
 * 3. Listen to JobEngine events
 * 4. Persist results via JobRepository
 * 5. Emit consolidated events for upstream consumers
 * 
 * Related ADRs:
 * - ADR-001: File Size Guardrail (< 400 lines)
 * - ADR-003: Dependency Injection
 * - ADR-009: Persistence Repository Layer
 */

const { EventEmitter } = require('events');
const path = require('path');
const fsSync = require('fs');
const { PostGenerationService } = require(path.join(__dirname, './PostGenerationService'));
const { moveImageToFinal } = require(path.join(__dirname, '../utils/moveImageToFinal'));
const { sanitizeConfigurationSnapshot } = require(path.join(__dirname, '../utils/sanitizeConfigurationSnapshot'));
const { finalizeBackgroundRun } = require(path.join(__dirname, './jobServiceBackgroundFinalize'));
const { startJobForExistingExecution } = require(path.join(__dirname, './jobServiceRerunStart'));
const { attachPostEnginePipelineStageLog } = require(path.join(__dirname, '../utils/attachPostEnginePipelineStageLog'));
const { countImagesGeneratedSuccessfully } = require(path.join(__dirname, '../utils/jobExecutionOutcome'));
const {
  isRunMetadataGenEnabledForJobConfig,
  isRunQualityCheckEnabledForJobConfig,
} = require(path.join(__dirname, '../utils/jobConfigAiFlags'));

function plannedImageSlots(cfg) {
  const gens = Math.max(1, Number(cfg?.parameters?.count || 1));
  const req = Math.max(1, Math.min(20, Number(cfg?.parameters?.variations || 1)));
  const maxAllowed = Math.max(1, Math.min(20, Math.floor(10000 / Math.max(1, gens))));
  return gens * Math.min(req, maxAllowed);
}

/**
 * JobService
 * 
 * Coordinates job execution lifecycle:
 * - JobEngine handles pure orchestration (no DB)
 * - JobRepository handles persistence (no orchestration)
 * - JobService bridges the two with event-based coordination
 */
class JobService extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {JobEngine} options.jobEngine - Job orchestration engine (DI)
   * @param {JobRepository} options.jobRepository - Job persistence repository (DI)
   */
  constructor(options = {}) {
    super();
    
    if (!options.jobEngine) throw new Error('JobService requires jobEngine dependency');
    if (!options.jobRepository) throw new Error('JobService requires jobRepository dependency');
    
    this.jobEngine = options.jobEngine;
    this.jobRepository = options.jobRepository;
    this.imageRepository = options.imageRepository || null;
    this._createImagePipeline = options.createImagePipeline || null;

    this.postGen = this.imageRepository
      ? new PostGenerationService({ imageRepository: this.imageRepository, addLog: this._addLog.bind(this), createImagePipeline: this._createImagePipeline })
      : null;
    
    this.currentExecutionId = null;
    this.currentJobId = null;
    this.currentLabel = null;
    this.currentConfigurationId = null;
    this.currentStartedAt = null;
    this.abortController = null;
    /** Set by SingleRerunService / BulkRerunService before startJob() — existing execution row, no new INSERT. */
    this.databaseExecutionId = null;
    this.configurationId = null;
    this.persistedLabel = null;
    this.isRerun = false;
    /** True while _runJobInBackground is in flight (after executeJob returns, persist/move/postGen still run). Caps JobEngine progress at 95 so UI never treats the job as completed until paths are final. */
    this._backgroundPipelineActive = false;
    this.liveProgress = { state: 'idle', progress: 0, currentStep: '', totalImages: 0, totalGenerations: 1, variations: 1, gensDone: 0 };
    this._logBuffer = [];
    
    this._setupJobEngineListeners();
  }

  _addLog(level, message, opts = {}) {
    const entry = {
      id: Date.now().toString() + '_' + this._logBuffer.length,
      timestamp: new Date().toISOString(),
      level,
      message,
      source: opts.source || 'job-service',
      stepName: opts.stepName || '',
      subStep: opts.subStep || '',
      metadata: opts.metadata || {}
    };
    this._logBuffer.push(entry);
    if (this._logBuffer.length > 500) this._logBuffer.shift();
  }

  getLogs(mode) {
    if (mode === 'debug') return [...this._logBuffer];
    return this._logBuffer.filter(l => l.level !== 'debug');
  }

  _setupJobEngineListeners() {
    this.jobEngine.on('progress', (data) => {
      const step = data.step || '';
      const meta = data.metadata || {};
      const gensDone = step === 'image_generation' ? (meta.generationIndex != null ? meta.generationIndex + 1 : this.liveProgress.gensDone) : this.liveProgress.gensDone;
      let progress = data.progress || 0;
      if (this._backgroundPipelineActive && progress > 95) progress = 95;
      this.liveProgress = {
        ...this.liveProgress,
        state: 'running',
        progress,
        currentStep: step,
        totalImages: meta.totalImages || this.liveProgress.totalImages,
        totalGenerations: meta.generations || this.liveProgress.totalGenerations,
        variations: meta.variations || this.liveProgress.variations,
        gensDone
      };
      this.emit('progress', data);
    });

    this.jobEngine.on('log', (logEntry) => {
      this._addLog(logEntry.level || 'info', logEntry.message || '', {
        source: logEntry.source || 'job-engine',
        stepName: logEntry.stepName || '',
        subStep: logEntry.subStep || '',
        metadata: logEntry.metadata || {}
      });
    });

    this.jobEngine.on('image-generated', async (data) => {
      this.emit('image-generated', data);
    });

    this.jobEngine.on('error', (errorData) => {
      this.emit('error', errorData);
      // Do not persist per-generation errors here — final execution status comes from
      // _runJobInBackground after post-processing (partial success must stay completed).
    });

    // job-complete is emitted from _runJobInBackground after persist/move/metadata/QC so IPC matches final paths (not when JobEngine returns).
  }

  async startJobAsync(config, options = {}) {
    const configurationSnapshot = sanitizeConfigurationSnapshot(config);
    const execution = {
      configurationId: options.configurationId || null,
      label: options.label || 'Untitled Job',
      status: 'running',
      startedAt: new Date().toISOString(),
      totalImages: 0, successfulImages: 0, failedImages: 0, errorMessage: null,
      configurationSnapshot
    };
    const saveResult = await this.jobRepository.saveJobExecution(execution);
    if (!saveResult.success) throw new Error('Failed to create job execution record');

    this.currentExecutionId = saveResult.id;
    this.currentJobId = saveResult.jobId || null;
    this.currentLabel = options.label || 'Untitled Job';
    this.currentConfigurationId = options.configurationId || null;
    this.currentStartedAt = new Date(execution.startedAt);
    this.abortController = new AbortController();
    this._logBuffer = [];
    const gens = Math.max(1, Number(config?.parameters?.count || 1));
    const vars = Math.max(1, Math.min(20, Number(config?.parameters?.variations || 1)));
    this.liveProgress = { state: 'running', progress: 0, currentStep: 'starting', totalImages: 0, totalGenerations: gens, variations: vars, gensDone: 0 };
    this._addLog('info', `Job started: ${gens} generation(s), ${vars} variation(s)`, { stepName: 'initialization', subStep: 'job_start', metadata: { generations: gens, variations: vars } });

    // Fire-and-forget: run job in background so IPC returns immediately
    this._runJobInBackground(config);

    return this.currentExecutionId;
  }

  /**
   * Legacy JobRunner API for SingleRerunService / BulkRerunService (pre–Story 5.3 parity).
   * @returns {Promise<{ success: boolean, jobId?: string, error?: string }>}
   */
  async startJob(config) {
    try {
      return await startJobForExistingExecution(this, config);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async _runJobInBackground(config) {
    let successResult = null;
    let lastError = null;
    try {
      const hasMetadataGen = isRunMetadataGenEnabledForJobConfig(config);
      const hasQC = isRunQualityCheckEnabledForJobConfig(config);
      this._backgroundPipelineActive = true;

      const result = await this.jobEngine.executeJob(config, this.abortController.signal);

      attachPostEnginePipelineStageLog(config, this._addLog.bind(this));

      if (this.imageRepository && Array.isArray(result.images)) {
        for (const img of result.images) {
          try {
            await this.imageRepository.saveGeneratedImage({ ...img, executionId: this.currentExecutionId });
          } catch (e) { console.warn('JobService: Failed to persist image:', e.message); }
        }
      }

      const hasImages = Array.isArray(result.images) && result.images.length > 0;

      // When QC is off: move successful images to final and auto-approve (processing already ran during generation).
      // Do not overwrite qc_failed / retry_failed (e.g. remove.bg mark_failed); those stay for Failed Images Review.
      if (!hasQC && hasImages && this.imageRepository) {
        const moveState = {};
        for (const image of result.images) {
          if (image.qcStatus && image.qcStatus !== 'approved') continue;
          const sourcePath = image.tempImagePath || image.finalImagePath;
          const mId = image.imageMappingId;
          if (!sourcePath || !mId) continue;
          try { fsSync.accessSync(sourcePath); } catch { continue; }
          const finalPath = await moveImageToFinal(sourcePath, mId, config, moveState);
          if (finalPath) {
            await this.imageRepository.updateImagePathsByMappingId(mId, null, finalPath);
            image.finalImagePath = finalPath;
            image.tempImagePath = null;
            await this.imageRepository.updateQCStatusByMappingId(mId, 'approved', 'QC disabled, auto-approved').catch(() => {});
          }
        }
      }

      // Metadata generation runs on ALL images regardless of QC outcome.
      if (hasImages && this.postGen) {
        if (hasMetadataGen) {
          this.liveProgress = { ...this.liveProgress, state: 'running', progress: 95, currentStep: 'metadata_generation' };
          await this.postGen.runMetadataGeneration(result.images, config, this.abortController?.signal);
        } else {
          this._addLog('info', 'Skipping AI metadata generation (runMetadataGen not enabled in job config)', {
            stepName: 'image_generation',
            subStep: 'metadata_skipped',
            metadata: {
              runMetadataGen: config?.ai?.runMetadataGen,
              aiKeys: config?.ai && typeof config.ai === 'object' ? Object.keys(config.ai) : [],
            },
          });
        }
      }

      // QC (optional): vision QC on temp files. If remove.bg is on, it runs only after approval (generation skipped local processing; see JobEngine.skipLocalImageProcessing).
      if (hasQC && hasImages && this.postGen) {
        this.liveProgress = { ...this.liveProgress, state: 'running', progress: 95, currentStep: 'quality_check' };
        await this.postGen.runQualityChecks(result.images, config, this.abortController?.signal);

        const approvedImages = result.images.filter(img => img.qcStatus === 'approved');
        if (approvedImages.length > 0) {
          this.liveProgress = { ...this.liveProgress, progress: 95, currentStep: 'finalize_approved' };
          await this.postGen.runPostQCProcessing(approvedImages, config, this.abortController?.signal);
        }
      }

      const planned = plannedImageSlots(config);
      const generatedOkCount = countImagesGeneratedSuccessfully(result.images);
      const successfulImages = generatedOkCount;
      const failedImages = Math.max(0, planned - generatedOkCount);
      let terminalStatus = result.status || 'completed';
      if (terminalStatus !== 'aborted' && terminalStatus !== 'stopped') {
        if (generatedOkCount > 0) terminalStatus = 'completed';
        else if (failedImages > 0 && planned > 0) terminalStatus = 'failed';
      }

      if (this.currentExecutionId) {
        await this.jobRepository.updateJobExecution(this.currentExecutionId, {
          configurationId: this.currentConfigurationId,
          startedAt: this.currentStartedAt,
          completedAt: new Date(),
          status: terminalStatus,
          totalImages: planned,
          successfulImages,
          failedImages,
          errorMessage: null,
          label: this.currentLabel
        }).catch(e => console.warn('JobService: Failed to update execution:', e.message));
      }

      successResult = {
        ...result,
        status: terminalStatus,
        totalImages: planned,
        successfulImages,
        failedImages,
        plannedTotal: planned
      };
    } catch (error) {
      lastError = error;
      console.error('JobService: background job failed:', error);
      if (this.currentExecutionId) {
        await this.jobRepository.updateJobExecutionStatus(
          this.currentExecutionId, 'failed', this.currentJobId, error.message
        ).catch(e => console.error('Failed to update execution status:', e));
      }
      this.liveProgress = { state: 'failed', progress: 0, currentStep: 'failed', totalImages: 0 };
    } finally {
      finalizeBackgroundRun(this, { successResult, lastError });
    }
  }

  async stopJob() {
    try {
      if (!this.abortController) {
        return { success: false, message: 'No active job to stop' };
      }

      // Signal abort to JobEngine
      this.abortController.abort();

      // Update execution status
      if (this.currentExecutionId) {
        await this.jobRepository.updateJobExecutionStatus(
          this.currentExecutionId,
          'stopped',
          this.currentJobId,
          'Job stopped by user'
        );
      }

      return { success: true, message: 'Job stop signal sent' };
    } catch (error) {
      console.error('JobService.stopJob failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get job execution status from DB, or legacy no-arg probe for rerun services.
   *
   * @param {string|number} [executionId] - When omitted, returns { status: 'running'|'idle' } for in-process runner.
   * @returns {Promise<Object>}
   */
  async getJobStatus(executionId) {
    if (arguments.length === 0) {
      const busy =
        this.currentExecutionId != null || this._backgroundPipelineActive === true;
      return { status: busy ? 'running' : 'idle' };
    }
    try {
      const result = await this.jobRepository.getJobExecution(executionId);
      return result;
    } catch (error) {
      console.error('JobService.getJobStatus failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get job history
   * 
   * @param {number} limit - Number of records to return
   * @returns {Promise<Object>} { success: true, executions: [...] }
   */
  async getJobHistory(limit = 50) {
    try {
      const result = await this.jobRepository.getJobHistory(limit);
      return result;
    } catch (error) {
      console.error('JobService.getJobHistory failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get job statistics
   * 
   * @returns {Promise<Object>} { totalJobs, completedJobs, failedJobs, averageDuration }
   */
  async getJobStatistics() {
    try {
      const result = await this.jobRepository.getJobStatistics();
      return result;
    } catch (error) {
      console.error('JobService.getJobStatistics failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update job execution statistics (called after images are processed)
   * 
   * @param {string|number} executionId - Execution ID
   * @returns {Promise<Object>} { success: true }
   */
  async updateJobStatistics(executionId) {
    try {
      const result = await this.jobRepository.updateJobExecutionStatistics(executionId);
      return result;
    } catch (error) {
      console.error('JobService.updateJobStatistics failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup() {
    try {
      // Stop any active job
      if (this.abortController) {
        this.abortController.abort();
      }

      // Remove event listeners
      this.jobEngine.removeAllListeners();
      this.removeAllListeners();

      return { success: true };
    } catch (error) {
      console.error('JobService.cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { JobService };
