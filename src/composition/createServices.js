/**
 * createServices - Dependency Injection wiring factory.
 *
 * Initializes database models, repositories, and services for
 * the Electron main process.  Returns a flat `services` object
 * that controllers can reference.
 *
 * ADR-001: < 400 lines.  ADR-003: constructor injection only.
 */

const path = require('path');
const { logDebug } = require(path.join(__dirname, '../utils/logDebug'));

const { JobExecution } = require(path.join(__dirname, '../database/models/JobExecution'));
const { GeneratedImage } = require(path.join(__dirname, '../database/models/GeneratedImage'));
const { JobConfiguration } = require(path.join(__dirname, '../database/models/JobConfiguration'));

const { JobRepository } = require(path.join(__dirname, '../repositories/JobRepository'));
const { ImageRepository } = require(path.join(__dirname, '../repositories/ImageRepository'));
const { JobConfigurationRepository } = require(path.join(__dirname, '../repositories/JobConfigurationRepository'));

const { SecurityService } = require(path.join(__dirname, '../services/SecurityService'));
const ExportService = require(path.join(__dirname, '../services/ExportService'));
const { JobService } = require(path.join(__dirname, '../services/JobService'));
const { JobEngine } = require(path.join(__dirname, '../services/JobEngine'));
const ImageGeneratorService = require(path.join(__dirname, '../services/ImageGeneratorService'));
const ImageRemoverService = require(path.join(__dirname, '../services/ImageRemoverService'));
const ImageProcessorService = require(path.join(__dirname, '../services/ImageProcessorService'));
const ImagePipelineService = require(path.join(__dirname, '../services/ImagePipelineService'));
const { BulkRerunService } = require(path.join(__dirname, '../services/BulkRerunService'));
const { SingleRerunService } = require(path.join(__dirname, '../services/SingleRerunService'));
const { RetryQueueService } = require(path.join(__dirname, '../services/RetryQueueService'));
const { RetryProcessorService } = require(path.join(__dirname, '../services/RetryProcessorService'));
const RetryConfigService = require(path.join(__dirname, '../services/RetryConfigService'));
const { JobListService } = require(path.join(__dirname, '../services/JobListService'));
const { ErrorTranslationService: ErrorTranslation } = require(path.join(__dirname, '../services/errorTranslation'));

const SettingsComposer = require(path.join(__dirname, './settingsComposer'));
const { resolveRetryJobConfigurationForImage } = require(path.join(__dirname, '../utils/retryResolveJobConfiguration'));
const { mergeRetryOriginalProcessing } = require(path.join(__dirname, '../utils/mergeRetryOriginalProcessing'));

/**
 * Initialize all database models (creates tables if missing).
 */
async function initDatabase() {
  const jobExecution = new JobExecution();
  const generatedImage = new GeneratedImage();
  const jobConfig = new JobConfiguration();

  await jobExecution.init();
  await generatedImage.init();

  return { jobExecution, generatedImage, jobConfig };
}

/**
 * Create all services with proper dependency injection.
 *
 * @param {Object} opts
 * @param {Function} opts.webContentsSender - (channel, data) => void, for push events
 * @returns {Promise<Object>} services bag
 */
async function createServices(opts = {}) {
  const webContentsSender = opts.webContentsSender || (() => {});

  // 1. Database models
  const { jobExecution, generatedImage, jobConfig } = await initDatabase();

  // 2. Repositories
  const jobRepository = new JobRepository(jobExecution);
  const imageRepository = new ImageRepository(generatedImage);
  const configRepository = new JobConfigurationRepository(jobConfig);

  // 3. Security
  let keytar;
  try { keytar = require('keytar'); } catch { keytar = null; }
  const securityService = new SecurityService(keytar, jobConfig);

  // 4. Settings composer (replaces backendAdapter.getSettings / saveSettings)
  const settingsComposer = new SettingsComposer({
    configRepository,
    securityService,
    getDefaultSettings: () => jobConfig.getDefaultSettings()
  });

  // 5. Error translation
  const errorTranslation = new ErrorTranslation();

  // 6. Image pipeline services
  const imageProcessorService = new ImageProcessorService({ logDebug });

  // Generator + remover are created lazily per-job (API key resolved at runtime).
  // We build a factory so JobEngine gets a fresh pipeline per execution.
  function createImagePipeline(apiKeys = {}) {
    const generatorService = new ImageGeneratorService(
      apiKeys.runware || process.env.RUNWARE_API_KEY || '',
      { logDebug }
    );
    const removerService = new ImageRemoverService(
      apiKeys.removeBg || apiKeys.remove_bg || process.env.REMOVE_BG_API_KEY || '',
      { logDebug }
    );
    return new ImagePipelineService({
      imageGeneratorService: generatorService,
      imageRemoverService: removerService,
      imageProcessorService
    });
  }

  // 7. JobEngine + JobService
  const jobEngine = new JobEngine({
    producePictureModule: {
      producePictureModule: async (settings, imgNameBase, customMetadataPrompt, config) => {
        const pipeline = createImagePipeline(config.apiKeys || {});
        return pipeline.producePictures(settings, imgNameBase, customMetadataPrompt, config);
      },
      processImage: async (inputImagePath, imgName, config) => {
        const pipeline = createImagePipeline(config.apiKeys || {});
        return pipeline.processImage(inputImagePath, imgName, config);
      }
    }
  });

  const jobService = new JobService({
    jobEngine,
    jobRepository,
    imageRepository,
    createImagePipeline
  });

  // Forward JobService events to renderer via webContentsSender
  _wireJobEvents(jobService, webContentsSender);

  // 8. Export service
  const exportService = new ExportService(
    jobExecution, generatedImage, jobConfig,
    { sendToRenderer: webContentsSender }
  );

  // 9. Retry services
  const retryProcessorService = RetryProcessorService;
  const retryConfigService = RetryConfigService;

  const retryQueueService = new RetryQueueService({
    processOneJob: async (job) => {
      const retryProcessor = _buildRetryProcessor(
        imageRepository, generatedImage, jobConfig,
        createImagePipeline, settingsComposer, jobRepository
      );
      return retryProcessor.processImage(job);
    },
    emit: (event, payload) => webContentsSender(`retry-${event}`, payload)
  });

  // 10. Rerun services
  const singleRerunService = new SingleRerunService({
    jobExecution,
    jobConfig,
    jobRunner: jobService,
    saveJobExecution: (exec) => jobRepository.saveJobExecution(exec),
    getSettings: () => settingsComposer.getSettings().then(r => r.settings)
  });

  const bulkRerunService = new BulkRerunService({
    jobExecution,
    jobConfig,
    jobRunner: jobService,
    getSettings: () => settingsComposer.getSettings().then(r => r.settings)
  });

  const advanceBulkRerunChain = () => {
    bulkRerunService.processNextBulkRerunJob().catch((err) => {
      console.warn('Bulk rerun chain:', err?.message || err);
    });
  };
  jobService.on('job-complete', advanceBulkRerunChain);
  jobService.on('job-failed', advanceBulkRerunChain);

  // 11. Job list service
  const jobListService = new JobListService({
    fetchJobExecutionsWithFilters: (f, p, ps) => jobRepository.getJobExecutionsWithFilters(f, p, ps),
    fetchJobExecutionsCount: (f) => jobRepository.getJobExecutionsCount(f),
    getPendingRerunExecutionIds: () => bulkRerunService.getPendingRerunExecutionIds()
  });

  return {
    // Models (for init / reconciliation)
    jobExecution,
    generatedImage,
    jobConfig,
    // Repositories
    jobRepository,
    imageRepository,
    configRepository,
    // Services
    securityService,
    settingsComposer,
    errorTranslation,
    jobEngine,
    jobService,
    exportService,
    retryQueueService,
    retryProcessorService,
    retryConfigService,
    singleRerunService,
    bulkRerunService,
    jobListService,
    imageProcessorService,
    // Factories
    createImagePipeline
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────

function _wireJobEvents(jobService, sender) {
  const channelMap = {
    'progress': 'job:progress',
    'image-generated': 'job:image-generated',
    'error': 'job:error',
    'job-complete': 'job:complete'
  };
  Object.entries(channelMap).forEach(([event, channel]) => {
    jobService.on(event, (data) => {
      try { sender(channel, data); } catch {}
    });
  });
}

function _buildRetryProcessor(imageRepo, genImage, jobConfig, createPipeline, settingsComposer, jobRepository) {
  return new (class {
    async processImage(job) {
      try {
        const imageRes = await imageRepo.getGeneratedImage(job.imageId);
        if (!imageRes.success) return { success: false, error: 'Image not found' };

        const settings = await settingsComposer.getSettings();
        const apiKeys = settings?.settings?.apiKeys || {};
        const pipeline = createPipeline(apiKeys);

        const processImageFn = (src, name, cfg) => pipeline.processImage(src, name, cfg);
        const executor = {
          outputDirectory: job.outputDirectory,
          tempDirectory: job.tempDirectory,
          currentImageId: job.imageId,
          generatedImage: genImage,
          imageProcessorService: { processFile: processImageFn }
        };

        const jobConfiguration = await resolveRetryJobConfigurationForImage(
          imageRes.image,
          jobConfig,
          jobRepository
        );

        const useOrig = job.useOriginalSettings !== false;
        let processingSettingsPayload = {};
        if (useOrig) {
          let snapshotProcessing = null;
          if (imageRes.image.executionId && jobRepository) {
            try {
              const exRes = await jobRepository.getJobExecution(imageRes.image.executionId);
              if (exRes.success && exRes.execution?.configurationSnapshot && typeof exRes.execution.configurationSnapshot === 'object') {
                const snap = exRes.execution.configurationSnapshot;
                snapshotProcessing = snap.processing != null ? snap.processing : null;
              }
            } catch (_) {}
          }
          const merged = mergeRetryOriginalProcessing(snapshotProcessing, imageRes.image.processingSettings);
          const psForOrig =
            merged && Object.keys(merged).length > 0
              ? JSON.stringify(merged)
              : typeof imageRes.image.processingSettings === 'string'
                ? imageRes.image.processingSettings
                : imageRes.image.processingSettings != null && typeof imageRes.image.processingSettings === 'object'
                  ? JSON.stringify(imageRes.image.processingSettings)
                  : null;
          const imageForOrig = { ...imageRes.image, processingSettings: psForOrig };
          processingSettingsPayload = await RetryConfigService.getOriginalProcessingSettings({}, imageForOrig);

          const includeMeta = !!job.includeMetadata;
          const hasWork =
            includeMeta ||
            (processingSettingsPayload &&
              (processingSettingsPayload.removeBg ||
                processingSettingsPayload.imageConvert ||
                processingSettingsPayload.imageEnhancement ||
                processingSettingsPayload.trimTransparentBackground ||
                (Number(processingSettingsPayload.sharpening) > 0) ||
                (Number.isFinite(Number(processingSettingsPayload.saturation)) &&
                  Math.abs(Number(processingSettingsPayload.saturation) - 1) > 1e-6)));
          if (!hasWork) {
            return {
              success: false,
              error:
                'No processing settings available for original-settings retry (missing saved per-image data and job snapshot). Use Retry with custom settings.'
            };
          }
        } else {
          processingSettingsPayload =
            job.modifiedSettings != null ? job.modifiedSettings : (job.settings || {});
        }

        const { run } = require(path.join(__dirname, '../services/RetryPostProcessingService'));
        return await run(
          executor,
          imageRes.image.finalImagePath || imageRes.image.tempImagePath,
          processingSettingsPayload,
          job.includeMetadata || false,
          jobConfiguration,
          useOrig,
          job.failOptions || {}
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  })();
}

module.exports = { createServices, initDatabase };
