/** Post-generation: QC, metadata, post-QC pipeline. ADR-003 DI (imageRepository, addLog, createImagePipeline). */

const path = require('path');
const fs = require('fs').promises;
const aiVision = require(path.join(__dirname, '../aiVision'));
const { emitPipelineStage } = require(path.join(__dirname, '../utils/pipelineStageLog'));
const { moveImageToFinal } = require(path.join(__dirname, '../utils/moveImageToFinal'));
const {
  buildPostQCProcessingConfig,
  isPostQCPipelineNoOp,
  normalizeProcessingSettings
} = require(path.join(__dirname, '../utils/processing'));

const QC_THROTTLE_MS = 2000;

class PostGenerationService {
  /**
   * @param {Object} opts
   * @param {Object} opts.imageRepository - ImageRepository instance (DI)
   * @param {Function} opts.addLog - (level, message, opts) => void
   */
  constructor({ imageRepository, addLog, createImagePipeline }) {
    if (!imageRepository) throw new Error('PostGenerationService requires imageRepository');
    if (!addLog) throw new Error('PostGenerationService requires addLog callback');
    this.imageRepository = imageRepository;
    this._addLog = addLog;
    this._createImagePipeline = createImagePipeline || null;
  }

  async _resolvePromptFile(filePath, label) {
    if (!filePath) return null;
    try {
      const text = await fs.readFile(filePath, 'utf8');
      if (text && text.trim() !== '') return text;
    } catch (err) {
      this._addLog('warn', `Failed to load ${label} from ${filePath}: ${err.message}`, {
        stepName: 'ai_operations', subStep: 'prompt_file_error',
        metadata: { filePath, error: err.message }
      });
    }
    return null;
  }

  // ─── Quality Check ──────────────────────────────────────────────────

  async runQualityChecks(images, config, abortSignal) {
    const openaiModel = config.parameters?.openaiModel || 'gpt-4o';
    const customPrompt = config.ai?.qualityCheckPrompt
      || await this._resolvePromptFile(config.filePaths?.qualityCheckPromptFile, 'QC prompt');
    const timeoutMs = (config.parameters?.enablePollingTimeout === true)
      ? Math.max(1000, Number(config.parameters?.pollingTimeout || 15) * 60 * 1000)
      : 30_000;

    this._addLog('info', `Starting quality checks for ${images.length} image(s) using ${openaiModel}`, {
      stepName: 'ai_operations', subStep: 'quality_check_start',
      metadata: { imageCount: images.length, openaiModel, hasCustomPrompt: !!customPrompt }
    });

    let approvedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < images.length; i++) {
      if (abortSignal?.aborted) {
        this._addLog('warn', 'Quality checks aborted by user', {
          stepName: 'ai_operations', subStep: 'quality_check_aborted',
          metadata: { processedSoFar: i, total: images.length }
        });
        break;
      }

      if (i > 0) await new Promise(r => setTimeout(r, QC_THROTTLE_MS));

      const image = images[i];
      const imagePath = image.finalImagePath || image.tempImagePath;
      const mId = image.imageMappingId;

      if (!imagePath) {
        this._addLog('warn', `Skipping QC for image ${i + 1}/${images.length}: no file path`, {
          stepName: 'ai_operations', subStep: 'quality_check_skip',
          metadata: { imageMappingId: mId }
        });
        failedCount++;
        continue;
      }

      this._addLog('info', `Running quality check on image ${i + 1}/${images.length}`, {
        stepName: 'ai_operations', subStep: 'quality_check_image',
        metadata: { imageMappingId: mId, imagePath }
      });

      emitPipelineStage(config, 'quality_check_api_begin', `Vision QC API call for image ${i + 1}/${images.length}`, {
        phase: 'network',
        scope: 'post_engine',
        imageMappingId: mId,
        openaiModel,
        imageIndex: i + 1,
        total: images.length
      });

      try {
        const result = await Promise.race([
          aiVision.runQualityCheck(imagePath, openaiModel, customPrompt),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Quality check timed out')), timeoutMs))
        ]);

        if (result) {
          emitPipelineStage(config, 'quality_check_api_end', `Vision QC returned for image ${i + 1}/${images.length}`, {
            phase: 'network',
            scope: 'post_engine',
            imageMappingId: mId,
            passed: !!result.passed,
            imageIndex: i + 1
          });

          const qcStatus = result.passed ? 'approved' : 'qc_failed';
          const qcReason = result.reason || (result.passed ? 'Quality check passed' : 'Quality check failed');

          this._addLog('info', `Quality check ${result.passed ? 'PASSED' : 'FAILED'} for image ${i + 1}/${images.length}`, {
            stepName: 'ai_operations', subStep: 'quality_check_result',
            metadata: { imageMappingId: mId, passed: result.passed, reason: qcReason }
          });

          if (mId) {
            try {
              await this.imageRepository.updateQCStatusByMappingId(mId, qcStatus, qcReason);
            } catch (dbErr) {
              this._addLog('error', `Failed to update QC status for ${mId}: ${dbErr.message}`, {
                stepName: 'ai_operations', subStep: 'quality_check_db_error',
                metadata: { imageMappingId: mId, error: dbErr.message }
              });
            }
          }

          image.qcStatus = qcStatus;
          image.qcReason = qcReason;
          if (result.passed) approvedCount++; else failedCount++;
        } else {
          emitPipelineStage(config, 'quality_check_api_end', `Vision QC returned empty for image ${i + 1}/${images.length}`, {
            phase: 'network',
            scope: 'post_engine',
            imageMappingId: mId,
            emptyResult: true,
            imageIndex: i + 1
          });
          this._addLog('warn', `Quality check returned no result for image ${i + 1}/${images.length}`, {
            stepName: 'ai_operations', subStep: 'quality_check_no_result',
            metadata: { imageMappingId: mId }
          });
          if (mId) {
            await this.imageRepository.updateQCStatusByMappingId(mId, 'qc_failed', 'Quality check returned no result')
              .catch(e => console.warn('PostGen: QC DB update failed:', e.message));
          }
          image.qcStatus = 'qc_failed';
          failedCount++;
        }
      } catch (err) {
        emitPipelineStage(config, 'quality_check_api_error', `Vision QC failed for image ${i + 1}/${images.length}`, {
          phase: 'network',
          scope: 'post_engine',
          imageMappingId: mId,
          error: err.message
        });
        this._addLog('error', `Quality check error for image ${i + 1}/${images.length}: ${err.message}`, {
          stepName: 'ai_operations', subStep: 'quality_check_image_error',
          metadata: { imageMappingId: mId, error: err.message }
        });
        if (mId) {
          await this.imageRepository.updateQCStatusByMappingId(mId, 'qc_failed', `QC error: ${err.message}`)
            .catch(e => console.warn('PostGen: QC DB update failed:', e.message));
        }
        image.qcStatus = 'qc_failed';
        image.qcReason = err.message;
        failedCount++;
      }
    }

    this._addLog('info', `Quality checks completed: ${approvedCount} approved, ${failedCount} failed out of ${images.length}`, {
      stepName: 'ai_operations', subStep: 'quality_check_complete',
      metadata: { approvedCount, failedCount, total: images.length }
    });

    return { approvedCount, failedCount };
  }

  // ─── Metadata Generation ────────────────────────────────────────────

  async runMetadataGeneration(images, config, abortSignal) {
    const openaiModel = config.parameters?.openaiModel || 'gpt-4o';
    const customPrompt = config.ai?.metadataPrompt
      || await this._resolvePromptFile(config.filePaths?.metadataPromptFile, 'metadata prompt');
    const timeoutMs = (config.parameters?.enablePollingTimeout === true)
      ? Math.max(1000, Number(config.parameters?.pollingTimeout || 15) * 60 * 1000)
      : 30_000;

    this._addLog('info', `Starting AI metadata generation for ${images.length} image(s) using ${openaiModel}`, {
      stepName: 'image_generation', subStep: 'metadata_start',
      metadata: { imageCount: images.length, openaiModel, hasCustomPrompt: !!customPrompt }
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (abortSignal?.aborted) {
        this._addLog('warn', 'Metadata generation aborted by user', {
          stepName: 'image_generation', subStep: 'metadata_aborted',
          metadata: { processedSoFar: i, total: images.length }
        });
        break;
      }

      const localPath = image.finalImagePath || image.tempImagePath;
      const mId = image.imageMappingId;
      if (!localPath) {
        this._addLog('warn', `Skipping metadata for image ${i + 1}/${images.length}: no file path`, {
          stepName: 'image_generation', subStep: 'metadata_skip',
          metadata: { imageMappingId: mId, imageIndex: i }
        });
        continue;
      }

      this._addLog('info', `Processing metadata for image ${i + 1}/${images.length}`, {
        stepName: 'image_generation', subStep: 'metadata_processing',
        metadata: { imageMappingId: mId, imageIndex: i, imagePath: localPath }
      });

      emitPipelineStage(config, 'metadata_api_begin', `AI metadata API call for image ${i + 1}/${images.length}`, {
        phase: 'network',
        scope: 'post_engine',
        imageMappingId: mId,
        openaiModel,
        imageIndex: i + 1,
        total: images.length
      });

      try {
        const result = await Promise.race([
          aiVision.generateMetadata(localPath, image.metadata?.prompt || 'default image', customPrompt, openaiModel),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Metadata generation timed out')), timeoutMs))
        ]);

        emitPipelineStage(config, 'metadata_api_end', `AI metadata API returned for image ${i + 1}/${images.length}`, {
          phase: 'network',
          scope: 'post_engine',
          imageMappingId: mId,
          imageIndex: i + 1,
          hasResult: !!result
        });

        if (result && mId) {
          const tags = result.uploadTags || result.tags || result.upload_tags || null;
          const metadataPayload = {
            title: result.new_title || null,
            description: result.new_description || null,
            tags: typeof tags === 'string' ? tags : (Array.isArray(tags) ? tags.join(', ') : null)
          };

          this._addLog('debug', `AI metadata result for image ${mId}`, {
            stepName: 'image_generation', subStep: 'metadata_ai_result',
            metadata: {
              imageMappingId: mId, hasTitle: !!result.new_title,
              hasDescription: !!result.new_description, hasTags: !!tags,
              titlePreview: (result.new_title || '').substring(0, 60),
              resultKeys: Object.keys(result)
            }
          });

          try {
            const updateResult = await this.imageRepository.updateGeneratedImageByMappingId(mId, {
              metadata: metadataPayload
            });
            this._addLog('info', `Metadata saved for image ${i + 1}/${images.length} (${mId})`, {
              stepName: 'image_generation', subStep: 'metadata_db_updated',
              metadata: { imageMappingId: mId, hasTitle: !!metadataPayload.title, hasTags: !!metadataPayload.tags, dbResult: updateResult?.success }
            });
            successCount++;
          } catch (dbError) {
            this._addLog('warn', `Failed to save metadata to DB for image ${mId}: ${dbError.message}`, {
              stepName: 'image_generation', subStep: 'metadata_db_error',
              metadata: { imageMappingId: mId, error: dbError.message }
            });
            failCount++;
          }
        } else {
          const reason = !result ? 'empty AI result' : 'no imageMappingId';
          this._addLog('warn', `Cannot save metadata for image ${i + 1}/${images.length}: ${reason}`, {
            stepName: 'image_generation', subStep: 'metadata_skip_save',
            metadata: { imageMappingId: mId, reason, hasResult: !!result }
          });
          failCount++;
        }
      } catch (err) {
        failCount++;
        emitPipelineStage(config, 'metadata_api_error', `AI metadata API failed for image ${i + 1}/${images.length}`, {
          phase: 'network',
          scope: 'post_engine',
          imageMappingId: mId,
          error: err.message
        });
        this._addLog('warn', `Metadata generation failed for image ${i + 1}/${images.length}: ${err.message}`, {
          stepName: 'image_generation', subStep: 'metadata_error',
          metadata: { imageMappingId: mId, error: err.message }
        });
      }
    }

    this._addLog('info', `Metadata generation completed: ${successCount} succeeded, ${failCount} failed out of ${images.length}`, {
      stepName: 'image_generation', subStep: 'metadata_complete',
      metadata: { successCount, failCount, total: images.length }
    });

    return { successCount, failCount };
  }

  /**
   * After QC approves: move to output. If remove.bg was deferred (QC on + remove.bg in settings), run full
   * ImagePipelineService.processImage here so remove.bg + Sharp run only for approved images.
   */
  async runPostQCProcessing(approvedImages, config, abortSignal) {
    const proc = normalizeProcessingSettings(config.processing || {});
    const runDeferredPipeline = config.ai?.runQualityCheck === true && !!proc.removeBg;
    const apiKeys = config.apiKeys || {};
    const pipeline = this._createImagePipeline ? this._createImagePipeline(apiKeys) : null;
    const paramsCfg = config.parameters || {};
    const pollingTimeout = (paramsCfg.enablePollingTimeout === true && Number.isFinite(Number(paramsCfg.pollingTimeout)))
      ? Number(paramsCfg.pollingTimeout) : undefined;
    const removeBgKey = apiKeys.removeBg || apiKeys.remove_bg || process.env.REMOVE_BG_API_KEY || '';

    let tempProcessingDir;
    try {
      const { app } = require('electron');
      tempProcessingDir = path.join(app.getPath('desktop'), 'gen-image-factory', 'pictures', 'temp_processing');
    } catch {
      const os = require('os');
      tempProcessingDir = path.join(os.homedir(), 'Documents', 'gen-image-factory', 'pictures', 'temp_processing');
    }
    if (runDeferredPipeline && pipeline) await fs.mkdir(tempProcessingDir, { recursive: true });

    this._addLog('info', runDeferredPipeline
      ? `Post-QC: remove.bg + processing for ${approvedImages.length} approved image(s)`
      : `Moving ${approvedImages.length} QC-approved image(s) to final output`,
    {
      stepName: 'image_generation', subStep: 'finalize_approved_start',
      metadata: { count: approvedImages.length, deferredRemoveBg: runDeferredPipeline }
    });
    emitPipelineStage(config, 'finalize_approved_begin', runDeferredPipeline
      ? 'Post-QC: deferred remove.bg + Sharp then move to final'
      : 'Post-QC: move approved images to final (no deferred pipeline)', {
      scope: 'post_engine',
      deferredRemoveBg: runDeferredPipeline,
      count: approvedImages.length
    });

    let processedCount = 0;

    for (let i = 0; i < approvedImages.length; i++) {
      if (abortSignal?.aborted) break;
      const image = approvedImages[i];
      const mId = image.imageMappingId;
      const sourcePath = image.tempImagePath || image.finalImagePath;
      if (!sourcePath) continue;
      try { await fs.access(sourcePath); } catch { continue; }

      let pathForFinal = sourcePath;

      if (runDeferredPipeline && pipeline) {
        const effectiveFailMode = proc.removeBgFailureMode || 'approve';
        const processingConfig = buildPostQCProcessingConfig(proc, null, tempProcessingDir, effectiveFailMode);
        if (Number.isFinite(pollingTimeout)) processingConfig.pollingTimeout = pollingTimeout;
        Object.assign(processingConfig, {
          apiKeys: config.apiKeys,
          abortSignal,
          pipelineStageLog: config.pipelineStageLog
        });
        const isMarkFailed = processingConfig.removeBg === true && processingConfig.removeBgFailureMode === 'mark_failed';

        if (isMarkFailed && !removeBgKey.trim()) {
          this._addLog('warn', 'Remove.bg API key missing with Mark Failed; marking qc_failed', {
            stepName: 'image_generation', subStep: 'post_qc_missing_key', metadata: { imageMappingId: mId }
          });
          await this._markImageFailed(mId, image);
          continue;
        }

        let removeBgThrew = false;
        try {
          if (!isPostQCPipelineNoOp(processingConfig)) {
            emitPipelineStage(config, 'post_qc_process_image_begin', 'Deferred pipeline.processImage (remove.bg + Sharp)', {
              scope: 'post_engine',
              phase: 'network_then_local',
              imageMappingId: mId,
              sourcePath,
              removeBg: !!processingConfig.removeBg
            });
            pathForFinal = await pipeline.processImage(sourcePath, path.basename(sourcePath), processingConfig);
            emitPipelineStage(config, 'post_qc_process_image_end', 'Deferred pipeline.processImage finished', {
              scope: 'post_engine',
              phase: 'local',
              imageMappingId: mId,
              outputPath: pathForFinal
            });
          }
        } catch (procErr) {
          removeBgThrew = true;
          emitPipelineStage(config, 'post_qc_process_image_error', 'Deferred pipeline.processImage failed', {
            scope: 'post_engine',
            imageMappingId: mId,
            error: procErr.message,
            stage: procErr.stage
          });
          this._addLog('warn', `Post-QC processing threw: ${procErr.message}`, {
            stepName: 'image_generation', subStep: 'post_qc_catch',
            metadata: { imageMappingId: mId, error: procErr.message, stage: procErr.stage }
          });
          if (isMarkFailed) { await this._markImageFailed(mId, image); continue; }
          continue;
        }

        const hadSoftBg = Array.isArray(processingConfig._softFailures) && processingConfig._softFailures.some(f => f?.stage === 'remove_bg');
        if (isMarkFailed && (removeBgThrew || !processingConfig._removeBgApplied || hadSoftBg)) {
          this._addLog('warn', 'Mark Failed override: forcing qc_failed', {
            stepName: 'image_generation', subStep: 'post_qc_mark_failed_override', metadata: { imageMappingId: mId }
          });
          await this._markImageFailed(mId, image);
          continue;
        }
      } else if (runDeferredPipeline && !pipeline) {
        this._addLog('warn', 'Deferred remove.bg requires createImagePipeline; skipping processing for image', {
          stepName: 'image_generation', subStep: 'finalize_no_pipeline', metadata: { imageMappingId: mId }
        });
      }

      const finalPath = await moveImageToFinal(pathForFinal, mId, config, this);
      if (finalPath) {
        await this.imageRepository.updateImagePathsByMappingId(mId, null, finalPath);
        image.finalImagePath = finalPath;
        image.tempImagePath = null;
        processedCount++;
      } else {
        try {
          const fsSync = require('fs');
          if (pathForFinal && fsSync.existsSync(pathForFinal)) {
            await this.imageRepository.updateImagePathsByMappingId(mId, null, pathForFinal);
            image.finalImagePath = pathForFinal;
            image.tempImagePath = null;
            processedCount++;
          }
        } catch {}
      }
    }

    this._addLog('info', `Finalize approved completed: ${processedCount}/${approvedImages.length} moved to output`, {
      stepName: 'image_generation', subStep: 'finalize_approved_complete',
      metadata: { processedCount, total: approvedImages.length }
    });
  }

  async _markImageFailed(mappingId, image) {
    try { await this.imageRepository.updateQCStatusByMappingId(mappingId, 'qc_failed', 'processing_failed:remove_bg'); } catch {}
    try { Object.assign(image, { qcStatus: 'qc_failed', qcReason: 'processing_failed:remove_bg' }); } catch {}
  }
}

module.exports = { PostGenerationService };
