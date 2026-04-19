const path = require('path');
const { emitPipelineStage } = require('./pipelineStageLog');
const { withRunwareRetries } = require('./runwareRetry');

/**
 * GET each Runware result URL and write files under tempDir (ADR-008 extraction).
 */
async function downloadRunwareResultUrls({
  imageUrls,
  imgNameBase,
  effectiveOutputFormat,
  tempDir,
  fs,
  axios,
  httpTimeoutMs,
  rwMaxAttempts,
  rwBackoffMs,
  abortSignal,
  logDebug,
  config,
  generateImageMappingId,
}) {
  const successfulDownloads = [];
  const failedItems = [];

  emitPipelineStage(config, 'runware_download_phase_begin', 'Downloading result image URLs to disk', {
    phase: 'network',
    urlCount: imageUrls.length,
    generationIndex: config.generationIndex,
  });

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const imageSuffix = `_${i + 1}`;
    const mappingId = generateImageMappingId(imageUrl, i + 1, imgNameBase);

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
        generationIndex: config.generationIndex,
      });
      const response = await withRunwareRetries({
        label: `GET result ${i + 1}/${imageUrls.length}`,
        maxAttempts: rwMaxAttempts,
        backoffMs: rwBackoffMs,
        abortSignal,
        logDebug,
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
        fn: () => axios.get(imageUrl, { responseType: 'arraybuffer', timeout: httpTimeoutMs, signal: abortSignal }),
      });

      let inferredExt = '';
      try {
        const urlPath = new URL(imageUrl).pathname;
        const fromUrl = path.extname(urlPath).toLowerCase();
        if (fromUrl && ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(fromUrl)) inferredExt = fromUrl;
      } catch (e) {
        console.log('URL PARSE ERROR', e.message);
      }
      if (!inferredExt) {
        const ct = String(response.headers?.['content-type'] || '').toLowerCase();
        if (ct.includes('image/png')) inferredExt = '.png';
        else if (ct.includes('image/jpeg') || ct.includes('image/jpg')) inferredExt = '.jpg';
        else if (ct.includes('image/webp')) inferredExt = '.webp';
        else if (ct.includes('image/svg') || ct.includes('svg+xml')) inferredExt = '.svg';
      }
      if (!inferredExt) {
        const wantSvg = String(effectiveOutputFormat || '').toLowerCase() === 'svg';
        inferredExt = wantSvg ? '.svg' : '.png';
      }

      const inputImagePath = path.resolve(path.join(tempDir, `${imgNameBase}${imageSuffix}${inferredExt}`));
      await fs.mkdir(path.dirname(inputImagePath), { recursive: true });
      await fs.writeFile(inputImagePath, response.data);

      successfulDownloads.push({
        inputImagePath,
        mappingId,
        imageUrl,
        imageSuffix,
      });
      emitPipelineStage(config, 'runware_download_item_end', `Saved result image ${i + 1}/${imageUrls.length}`, {
        phase: 'network',
        index: i + 1,
        host: downloadHost,
        mappingId,
        inputImagePath,
        generationIndex: config.generationIndex,
      });
    } catch (err) {
      emitPipelineStage(config, 'runware_download_item_error', `Download failed for image ${i + 1}/${imageUrls.length}`, {
        phase: 'network',
        index: i + 1,
        host: downloadHost,
        mappingId,
        error: String(err && err.message || err),
        generationIndex: config.generationIndex,
      });
      failedItems.push({
        mappingId,
        stage: 'download',
        vendor: 'runware',
        message: String(err && err.message || err),
      });
    }
  }

  emitPipelineStage(config, 'runware_download_phase_end', 'Runware download phase finished', {
    phase: 'network',
    saved: successfulDownloads.length,
    failed: failedItems.filter((f) => f.stage === 'download').length,
    generationIndex: config.generationIndex,
  });

  return { successfulDownloads, failedItems };
}

module.exports = { downloadRunwareResultUrls };
