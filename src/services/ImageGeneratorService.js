const path = require('path');
const { randomUUID } = require('node:crypto');
const { emitPipelineStage } = require(path.join(__dirname, '../utils/pipelineStageLog'));
const {
  resolveRunwareRetryOptions,
  withRunwareRetries
} = require(path.join(__dirname, '../utils/runwareRetry'));

console.log('LOADING ImageGeneratorService');

class ImageGeneratorService {
  constructor(apiKey, dependencies = {}) {
    this.apiKey = apiKey;
    this.axios = dependencies.axios || require('axios');
    this.fs = dependencies.fs || require('fs').promises;
    this.logDebug = dependencies.logDebug || (() => {});
    // console.log('DEBUG: axios.get is mock:', !!(this.axios.get && this.axios.get._isMockFunction));
  }

  /**
   * Select current dimensions if provided (sequential per generation)
   */
  getRunwareDimensionsForGeneration(csv, generationIndex) {
    try {
      const value = (csv || '').trim();
      if (!value) return null;
      const items = value.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length === 0) return null;
      const selected = items[Math.abs(generationIndex) % items.length];
      const match = selected.match(/^(\d+)x(\d+)$/i);
      if (!match) return null;
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      if (!(width > 0 && height > 0)) return null;
      return { width, height };
    } catch {
      return null;
    }
  }

  normalizeRunwareDimension(value) {
    if (!Number.isFinite(Number(value))) return null;
    let v = Math.round(Number(value));
    v = Math.max(128, Math.min(2048, v));
    // round to nearest multiple of 64 within bounds
    v = Math.round(v / 64) * 64;
    v = Math.max(128, Math.min(2048, v));
    return v;
  }

  sanitizePromptForRunware(prompt) {
    if (!prompt || typeof prompt !== 'string') return '';
    let p = prompt;
    // Remove version flags and common MJ toggles that cause provider 400s
    p = p.replace(/\s--v\s?\d+(?:\.\d+)?/gi, '');
    p = p.replace(/\s--(ar|aspect-ratio)\s?\d+:\d+/gi, '');
    p = p.replace(/\s--(stylize|style)\s?\d+/gi, '');
    p = p.replace(/\s--(q|quality)\s?\d+(?:\.\d+)?/gi, '');
    p = p.replace(/\s--(chaos|weird)\s?\d+/gi, '');
    p = p.replace(/\s--(seed)\s?\d+/gi, '');
    p = p.replace(/\s--(tile|uplight|upbeta|niji|turbo)\b/gi, '');
    return p.trim();
  }

  extractRunwareImageUrls(rwData) {
    const urls = [];
    if (!rwData) return urls;
    if (Array.isArray(rwData.data)) {
      for (const item of rwData.data) {
        const u = item && (item.imageURL || item.url);
        if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.push(u);
      }
      return urls;
    }
    if (Array.isArray(rwData)) {
      for (const entry of rwData) {
        if (Array.isArray(entry?.data)) {
          for (const item of entry.data) {
            const u = item && (item.imageURL || item.url);
            if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.push(u);
          }
        } else {
          const u = entry && (entry.imageURL || entry.url);
          if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.push(u);
        }
      }
      return urls;
    }
    return urls;
  }

  generateImageMappingId(imageUrl, index, jobId) {
    try {
      const trimMatch = imageUrl.match(/trim=([^/]+)/);
      if (trimMatch) {
        const trimValues = trimMatch[1];
        const cleanTrim = trimValues.replace(/;/g, '');
        const timestamp = Date.now().toString().slice(-6);
        const randomSuffix = Math.random().toString(36).substring(2, 5);
        return `${cleanTrim}${index}_${timestamp}_${randomSuffix}`;
      }
      const timestamp = Date.now().toString().slice(-6);
      const randomSuffix = Math.random().toString(36).substring(2, 5);
      return `img_${timestamp}_${index}_${randomSuffix}`;
    } catch (error) {
      const timestamp = Date.now().toString().slice(-6);
      const randomSuffix = Math.random().toString(36).substring(2, 5);
      return `img_${timestamp}_${index}_${randomSuffix}`;
    }
  }

  async generateImages(settings, imgNameBase, config = {}) {
    const { abortSignal } = config;
    const prompt = settings.prompt || '';

    const currentGenerationIndex = Number(config.generationIndex || 0);
    const dimensionsList = (settings?.parameters?.runwareDimensionsCsv || config?.runwareDimensionsCsv || '').trim();
    const dims = this.getRunwareDimensionsForGeneration(dimensionsList, currentGenerationIndex);
    
    let width = this.normalizeRunwareDimension(dims?.width ?? 1024);
    let height = this.normalizeRunwareDimension(dims?.height ?? 1024);

    const runwareModel = settings?.parameters?.runwareModel || 'runware:101@1';
    const variations = Math.max(1, Math.min(20, Number(config?.variations || settings?.parameters?.variations || 1)));
    const providerFormat = (settings?.parameters?.runwareFormat || 'png').toLowerCase();
    const outputFormat = providerFormat === 'jpeg' ? 'jpg' : providerFormat;
    const advancedEnabled = settings?.parameters?.runwareAdvancedEnabled === true;
    const advanced = advancedEnabled ? (settings?.parameters?.runwareAdvanced || {}) : {};

    const loraEnabled = settings?.parameters?.loraEnabled === true;
    const loraList = Array.isArray(settings?.parameters?.lora)
      ? settings.parameters.lora
      : (Array.isArray(advanced?.lora) ? advanced.lora : []);

    const body = {
      taskType: 'imageInference',
      taskUUID: randomUUID(),
      model: runwareModel,
      positivePrompt: this.sanitizePromptForRunware(prompt),
      numberResults: variations,
      outputType: 'URL',
      outputFormat,
      width,
      height,
      ...(loraEnabled && Array.isArray(loraList) && loraList.length > 0
        ? { lora: loraList.filter(x => x && x.model).map(x => ({ model: x.model, weight: Number(x.weight) || 1 })) }
        : {}),
      ...(typeof advanced.checkNSFW === 'boolean' ? { checkNSFW: !!advanced.checkNSFW } : {}),
      ...(advanced.scheduler ? { scheduler: String(advanced.scheduler) } : {}),
      ...(Number.isFinite(Number(advanced.CFGScale)) ? { CFGScale: Number(advanced.CFGScale) } : {}),
      ...(Number.isFinite(Number(advanced.steps)) ? { steps: Number(advanced.steps) } : {})
    };

    const enableTimeoutFlag = (config && config.enablePollingTimeout === true) || (settings?.parameters?.enablePollingTimeout === true);
    const timeoutMinutesRaw = Number.isFinite(Number(config?.pollingTimeout)) ? Number(config.pollingTimeout) : (Number.isFinite(Number(settings?.parameters?.pollingTimeout)) ? Number(settings.parameters.pollingTimeout) : undefined);
    const httpTimeoutMs = enableTimeoutFlag && Number.isFinite(Number(timeoutMinutesRaw))
      ? Math.max(1000, Number(timeoutMinutesRaw) * 60 * 1000)
      : 30000;

    const { maxAttempts: rwMaxAttempts, backoffMs: rwBackoffMs } = resolveRunwareRetryOptions(settings, config);

    const rwHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey || ''}`
    };
    if (!rwHeaders.Authorization || rwHeaders.Authorization.endsWith(' ')) {
      throw new Error('Runware API key is missing. Please set it in Settings → API Keys.');
    }

    emitPipelineStage(config, 'runware_api_begin', 'POST https://api.runware.ai/v1/images/generate (imageInference)', {
      phase: 'network',
      host: 'api.runware.ai',
      variations,
      generationIndex: config.generationIndex
    });

    let rwResponse;
    try {
      this.logDebug('Runware payload (sanitized):', { ...body, positivePrompt: '[redacted]' });
      rwResponse = await withRunwareRetries({
        label: 'imageInference POST',
        maxAttempts: rwMaxAttempts,
        backoffMs: rwBackoffMs,
        abortSignal,
        logDebug: this.logDebug,
        onRetry: (attempt, max, err) => {
          emitPipelineStage(config, 'runware_api_retry', `Runware POST retry (${attempt}/${max})`, {
            phase: 'network',
            generationIndex: config.generationIndex,
            error: String(err?.message || err),
          });
        },
        fn: () => this.axios.post(
          'https://api.runware.ai/v1/images/generate',
          [body],
          { headers: rwHeaders, timeout: httpTimeoutMs, signal: abortSignal }
        ),
      });
    } catch (err) {
      const status = err?.response?.status;
      const serverErrors = err?.response?.data?.errors;
      const raw = err?.response?.data;
      const details = Array.isArray(serverErrors)
        ? ` Provider: ${JSON.stringify(serverErrors)}`
        : (raw ? ` Provider: ${JSON.stringify(raw)}` : '');
      const message = status ? `Runware request failed (${status}).${details}` : (err?.message || 'Runware request failed');
      throw new Error(message);
    }

    emitPipelineStage(config, 'runware_api_end', 'Runware generate response received', {
      phase: 'network',
      host: 'api.runware.ai',
      generationIndex: config.generationIndex
    });

    let imageUrls = this.extractRunwareImageUrls(rwResponse?.data);
    if (!imageUrls.length) {
      throw new Error('Runware returned no images. Please adjust parameters or try again.');
    }

    if (imageUrls.length < variations) {
      let remaining = variations - imageUrls.length;
      let attempts = 0;
      while (remaining > 0 && attempts < 5) {
        try {
          emitPipelineStage(config, 'runware_api_extra_begin', 'POST Runware (top-up variations)', {
            phase: 'network',
            host: 'api.runware.ai',
            attempt: attempts + 1,
            remaining,
            generationIndex: config.generationIndex
          });
          const extraBody = { ...body, taskUUID: randomUUID(), numberResults: Math.min(remaining, 20) };
          const extraResp = await withRunwareRetries({
            label: 'imageInference POST (top-up)',
            maxAttempts: rwMaxAttempts,
            backoffMs: rwBackoffMs,
            abortSignal,
            logDebug: this.logDebug,
            onRetry: (attempt, max, err) => {
              emitPipelineStage(config, 'runware_api_extra_retry', `Runware top-up POST retry (${attempt}/${max})`, {
                phase: 'network',
                generationIndex: config.generationIndex,
                error: String(err?.message || err),
              });
            },
            fn: () => this.axios.post(
              'https://api.runware.ai/v1/images/generate',
              [extraBody],
              { headers: rwHeaders, timeout: httpTimeoutMs, signal: abortSignal }
            ),
          });
          const extraUrls = this.extractRunwareImageUrls(extraResp?.data);
          if (Array.isArray(extraUrls) && extraUrls.length > 0) {
            for (const u of extraUrls) {
              if (imageUrls.length < variations) imageUrls.push(u);
            }
          }
          emitPipelineStage(config, 'runware_api_extra_end', 'Runware top-up response received', {
            phase: 'network',
            generationIndex: config.generationIndex
          });
        } catch (e) {
          emitPipelineStage(config, 'runware_api_extra_error', 'Runware top-up request failed', {
            phase: 'network',
            error: String(e && e.message || e),
            generationIndex: config.generationIndex
          });
          break;
        } finally {
          remaining = Math.max(0, variations - imageUrls.length);
          attempts += 1;
        }
      }
    }

    const successfulDownloads = [];
    const failedItems = [];
    const tempDir = config.outputDirectory || config.tempDirectory || './pictures/generated';

    emitPipelineStage(config, 'runware_download_phase_begin', 'Downloading result image URLs to disk', {
      phase: 'network',
      urlCount: imageUrls.length,
      generationIndex: config.generationIndex
    });

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageSuffix = `_${i + 1}`;
      const mappingId = this.generateImageMappingId(imageUrl, i + 1, imgNameBase);

      let downloadHost = 'unknown';
      try {
        downloadHost = new URL(imageUrl).hostname;
      } catch (_) { /* ignore */ }

      try {
        emitPipelineStage(config, 'runware_download_item_begin', `GET result image ${i + 1}/${imageUrls.length}`, {
          phase: 'network',
          index: i + 1,
          total: imageUrls.length,
          host: downloadHost,
          mappingId,
          generationIndex: config.generationIndex
        });
        const response = await withRunwareRetries({
          label: `GET result ${i + 1}/${imageUrls.length}`,
          maxAttempts: rwMaxAttempts,
          backoffMs: rwBackoffMs,
          abortSignal,
          logDebug: this.logDebug,
          onRetry: (attempt, max, err) => {
            emitPipelineStage(config, 'runware_download_retry', `Runware download retry (${attempt}/${max})`, {
              phase: 'network',
              index: i + 1,
              host: downloadHost,
              mappingId,
              generationIndex: config.generationIndex,
              error: String(err?.message || err),
            });
          },
          fn: () => this.axios.get(imageUrl, { responseType: 'arraybuffer', timeout: httpTimeoutMs, signal: abortSignal }),
        });
        
        let inferredExt = '';
        try {
          const urlPath = new URL(imageUrl).pathname;
          const fromUrl = path.extname(urlPath).toLowerCase();
          if (fromUrl && ['.png', '.jpg', '.jpeg', '.webp'].includes(fromUrl)) inferredExt = fromUrl;
        } catch (e) {
           console.log('URL PARSE ERROR', e.message);
        }
        if (!inferredExt) {
          const ct = String(response.headers?.['content-type'] || '').toLowerCase();
          if (ct.includes('image/png')) inferredExt = '.png';
          else if (ct.includes('image/jpeg') || ct.includes('image/jpg')) inferredExt = '.jpg';
          else if (ct.includes('image/webp')) inferredExt = '.webp';
        }
        if (!inferredExt) inferredExt = '.png';

        const inputImagePath = path.resolve(path.join(tempDir, `${imgNameBase}${imageSuffix}${inferredExt}`));
        await this.fs.mkdir(path.dirname(inputImagePath), { recursive: true });
        await this.fs.writeFile(inputImagePath, response.data);
        
        successfulDownloads.push({
          inputImagePath,
          mappingId,
          imageUrl,
          imageSuffix
        });
        emitPipelineStage(config, 'runware_download_item_end', `Saved result image ${i + 1}/${imageUrls.length}`, {
          phase: 'network',
          index: i + 1,
          host: downloadHost,
          mappingId,
          inputImagePath,
          generationIndex: config.generationIndex
        });
      } catch (err) {
        emitPipelineStage(config, 'runware_download_item_error', `Download failed for image ${i + 1}/${imageUrls.length}`, {
          phase: 'network',
          index: i + 1,
          host: downloadHost,
          mappingId,
          error: String(err && err.message || err),
          generationIndex: config.generationIndex
        });
        failedItems.push({
          mappingId,
          stage: 'download',
          vendor: 'runware',
          message: String(err && err.message || err)
        });
      }
    }

    emitPipelineStage(config, 'runware_download_phase_end', 'Runware download phase finished', {
      phase: 'network',
      saved: successfulDownloads.length,
      failed: failedItems.filter((f) => f.stage === 'download').length,
      generationIndex: config.generationIndex
    });

    return { successfulDownloads, failedItems };
  }
}

module.exports = ImageGeneratorService;
