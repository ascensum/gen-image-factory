const axios = require("axios");
// const express = require('express'); // Removed express
const fs = require('fs').promises;
//const fetch = require('node-fetch');
const FormData = require('form-data'); // Uncommented to fix runtime error
const path = require('path');
const sharp = require("sharp");
const { Blob } = require('node:buffer'); // Import Blob
const { logDebug } = require(path.join(__dirname, './utils/logDebug')); // Corrected path
const aiVision = require(path.join(__dirname, './aiVision'));
const { randomUUID } = require('node:crypto');
//const ngrok = require('ngrok'); // Removed ngrok dependency
//require("dotenv").config(); // dotenv is already required in index.js


async function pause(isLong = false, seconds) {
  const milliseconds = isLong ? 60000 : (seconds || 3000);
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function removeBg(inputPath, removeBgSize, signal, timeoutMs) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('size', removeBgSize || 'preview');
    const fsModule = require('fs');
    form.append('image_file', fsModule.createReadStream(inputPath));

    const headers = {
      ...form.getHeaders(),
      'X-Api-Key': process.env.REMOVE_BG_API_KEY || ''
    };

    const response = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
      headers,
      responseType: 'arraybuffer',
      timeout: Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : 60000,
      signal
    });

    if (response.status === 200 && response.data) {
      return Buffer.from(response.data);
    }
    throw new Error(`Failed to remove background: ${response.status} ${response.statusText}`);
  } catch (error) {
    try {
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      let body = '';
      if (error?.response?.data) {
        try {
          if (Buffer.isBuffer(error.response.data)) {
            body = error.response.data.toString('utf8').slice(0, 500);
          } else if (typeof error.response.data === 'string') {
            body = String(error.response.data).slice(0, 500);
          } else {
            body = JSON.stringify(error.response.data).slice(0, 500);
          }
        } catch {}
      }
      console.error('Error in removeBg:', { status, statusText, body });
    } catch {
      console.error('Error in removeBg:', error);
    }
    throw error;
  }
}

// Retry mechanism for removeBg
async function retryRemoveBg(inputPath, retries = 3, delay = 2000, removeBgSize, signal, timeoutMs) {
  for (let i = 0; i < retries; i++) {
    try {
      return await removeBg(inputPath, removeBgSize, signal, timeoutMs);
    } catch (error) {
      const status = error?.response?.status;
      const isRetryable = !error.response || (status >= 500) || error.code === 'ECONNABORTED' || status === 429;
      console.warn(`Attempt ${i + 1} for removeBg failed: ${error.message}${status ? ` (status ${status})` : ''}. ${isRetryable && i < retries - 1 ? `Retrying in ${delay / 1000} seconds...` : 'Not retryable or no attempts left.'}`);
      if (isRetryable && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 15000);
        continue;
      }
      throw error;
    }
  }
}

// Removed singleton instances for ngrok and Express server
// Removed initializeServerAndTunnel function
// Removed cleanupServerAndTunnel function

// Map to store pending image generation tasks (no longer needed for polling)
// const pendingTasks = new Map();

// Initialize a counter to keep track of the current aspect ratio index
let aspectRatioIndex = 0;

/**
 * Generate unique image mapping ID from PiAPI URL
 * @param {string} imageUrl - PiAPI image URL
 * @param {number} index - Image index (1-based)
 * @param {string} jobId - Job ID for uniqueness
 * @returns {string} - Unique mapping ID
 */
function generateImageMappingId(imageUrl, index, jobId) {
  try {
    // Extract trim part: "trim=0;1456;816;0"
    const trimMatch = imageUrl.match(/trim=([^/]+)/);
    if (trimMatch) {
      const trimValues = trimMatch[1]; // "0;1456;816;0"
      const cleanTrim = trimValues.replace(/;/g, ''); // "014568160"
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const randomSuffix = Math.random().toString(36).substring(2, 5); // 3 random chars
      return `${cleanTrim}${index}_${timestamp}_${randomSuffix}`; // "0145681601_123456_abc"
    }
    // Fallback if no trim found
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substring(2, 5);
    return `img_${timestamp}_${index}_${randomSuffix}`;
  } catch (error) {
    console.warn('Error generating mapping ID, using fallback:', error);
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substring(2, 5);
    return `img_${timestamp}_${index}_${randomSuffix}`;
  }
}

/**
 * Parse Runware dimensions CSV and return width/height for a generation index
 * @param {string} csv - e.g., "1024x1024,1280x720"
 * @param {number} generationIndex - zero-based index
 * @returns {{width:number,height:number}|null}
 */
function getRunwareDimensionsForGeneration(csv, generationIndex) {
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

function normalizeRunwareDimension(value) {
  if (!Number.isFinite(Number(value))) return null;
  let v = Math.round(Number(value));
  v = Math.max(128, Math.min(2048, v));
  // round to nearest multiple of 64 within bounds
  v = Math.round(v / 64) * 64;
  v = Math.max(128, Math.min(2048, v));
  return v;
}

/**
 * Extract list of image URLs from Runware response
 * @param {any} rwData - response body
 * @returns {string[]}
 */
function extractRunwareImageUrls(rwData) {
  const urls = [];
  if (!rwData) return urls;
  // Case 1: object with data: [ { imageURL } ]
  if (Array.isArray(rwData.data)) {
    for (const item of rwData.data) {
      const u = item && (item.imageURL || item.url);
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.push(u);
    }
    return urls;
  }
  // Case 2: array of result objects, each may have data: [ { imageURL } ] or imageURL directly
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

/**
 * Remove common Midjourney-style flags from prompt (e.g., --v 6.1) for Runware
 * @param {string} prompt
 * @returns {string}
 */
function sanitizePromptForRunware(prompt) {
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

/**
 * Produces pictures based on the provided settings and image name base.
 * Implements polling mechanism for image generation status.
 * 
 * @param {Object} settings - Configuration settings for image generation.
 * @param {string} imgNameBase - Base name for the generated images.
 * @returns {Array} - List of processed images with their paths and settings.
 */
async function producePictureModule(
  settings,
  imgNameBase,
  customMetadataPrompt = null,
  config = {}
) {
  // Destructure config parameters
  const {
    removeBg,
    imageConvert,
    convertToJpg,
    trimTransparentBackground,
    aspectRatios,
    pollingTimeout,
    processMode,
    removeBgSize,
    runQualityCheck,
    runMetadataGen,
    abortSignal,
  } = config;

  // Removed local debug mode variables, use imported ones directly

  // const port = 3043; // Port no longer needed
  // let tunnelUrl; // No longer needed

  // Parse aspect ratios from the environment variable (now from config)
  // const aspectRatios = process.env.ASPECT_RATIOS.split(','); // Removed

  try {
    // Initialize server and tunnel (removed)
    // tunnelUrl = await initializeServerAndTunnel(port);

    // Prepare the webhook URL (no longer needed)
    // const webhookUrl = `${tunnelUrl}/webhook`;

    // Prepare the prompt
    const promptContext = settings.promptContext || ''; // Keep this for the quality check
    const prompt = settings.prompt || '';

  // Select current dimensions if provided (sequential per generation)
  const currentGenerationIndex = Number(config.generationIndex || 0);
  const dimensionsList = (settings?.parameters?.runwareDimensionsCsv || config?.runwareDimensionsCsv || '').trim();
  const dims = getRunwareDimensionsForGeneration(dimensionsList, currentGenerationIndex);
  // Default to safe 1024x1024 if not provided
  let width = normalizeRunwareDimension(dims?.width ?? 1024);
  let height = normalizeRunwareDimension(dims?.height ?? 1024);

  // Build Runware request
  const runwareModel = settings?.parameters?.runwareModel || 'runware:101@1';
  const variations = Math.max(1, Math.min(20, Number(config?.variations || settings?.parameters?.variations || 1)));
  const providerFormat = (settings?.parameters?.runwareFormat || 'png').toLowerCase(); // png|jpg|webp
  const outputFormat = providerFormat === 'jpeg' ? 'jpg' : providerFormat;
  const advancedEnabled = settings?.parameters?.runwareAdvancedEnabled === true;
  const advanced = advancedEnabled ? (settings?.parameters?.runwareAdvanced || {}) : {};
  try {
    console.log('RunwareAdvanced gate (module):', {
      enabledFlag: settings?.parameters?.runwareAdvancedEnabled,
      effectiveEnabled: advancedEnabled,
      advancedKeys: advanced ? Object.keys(advanced) : [],
      rawAdvanced: advanced
    });
  } catch {}

  // Build LoRA payload from top-level parameters first, fallback to advanced.lora (for backward compatibility)
  const loraEnabled = settings?.parameters?.loraEnabled === true;
  const loraList = Array.isArray(settings?.parameters?.lora)
    ? settings.parameters.lora
    : (Array.isArray(advanced?.lora) ? advanced.lora : []);

  const body = {
    taskType: 'imageInference',
    taskUUID: randomUUID(),
    model: runwareModel,
    positivePrompt: sanitizePromptForRunware(prompt),
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

  // Explicit debug for variations request
  try {
    logDebug(`Runware request params: numberResults=${String(variations)} width=${String(width)} height=${String(height)} model=${String(runwareModel)}`);
    console.log('Runware payload fields (module):', {
      hasCFGScale: Object.prototype.hasOwnProperty.call(body, 'CFGScale'),
      hasSteps: Object.prototype.hasOwnProperty.call(body, 'steps'),
      hasScheduler: Object.prototype.hasOwnProperty.call(body, 'scheduler'),
      hasCheckNSFW: Object.prototype.hasOwnProperty.call(body, 'checkNSFW'),
      hasLora: Object.prototype.hasOwnProperty.call(body, 'lora')
    });
  } catch {}

  // Timeouts: only use custom Generation Timeout when explicitly enabled
  const enableTimeoutFlag = (config && config.enablePollingTimeout === true) || (settings?.parameters?.enablePollingTimeout === true);
  const timeoutMinutesRaw = Number.isFinite(Number(config?.pollingTimeout)) ? Number(config.pollingTimeout) : (Number.isFinite(Number(settings?.parameters?.pollingTimeout)) ? Number(settings.parameters.pollingTimeout) : undefined);
  const httpTimeoutMs = enableTimeoutFlag && Number.isFinite(Number(timeoutMinutesRaw))
    ? Math.max(1000, Number(timeoutMinutesRaw) * 60 * 1000)
    : 30000;
  const rwHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.RUNWARE_API_KEY || ''}`
  };
  if (!rwHeaders.Authorization || rwHeaders.Authorization.endsWith(' ')) {
    throw new Error('Runware API key is missing. Please set it in Settings → API Keys.');
  }

  // Runware API expects an array payload
  const payload = [body];
  let rwResponse;
  try {
    logDebug('Runware payload (sanitized):', { ...body, positivePrompt: '[redacted]' });
    rwResponse = await axios.post(
      'https://api.runware.ai/v1/images/generate',
      payload,
      { headers: rwHeaders, timeout: httpTimeoutMs, signal: abortSignal }
    );
  } catch (err) {
    // Surface provider error details if present
    const status = err?.response?.status;
    const serverErrors = err?.response?.data?.errors;
    const raw = err?.response?.data;
    const details = Array.isArray(serverErrors)
      ? ` Provider: ${JSON.stringify(serverErrors)}`
      : (raw ? ` Provider: ${JSON.stringify(raw)}` : '');
    const message = status ? `Runware request failed (${status}).${details}` : (err?.message || 'Runware request failed');
    throw new Error(message);
  }

  const rwData = rwResponse?.data;
  // Expect shape: { data: [{ imageURL: "..." }, ...] }
  let imageUrls = extractRunwareImageUrls(rwData);
  if (!imageUrls.length) {
    throw new Error('Runware returned no images. Please adjust parameters or try again.');
  }

  // If provider returns fewer URLs than requested variations, top-up with additional requests
  // Safety: up to 5 extra attempts to avoid long loops
  if (imageUrls.length < variations) {
    let remaining = variations - imageUrls.length;
    let attempts = 0;
    try { logDebug(`Top-up init: initial=${imageUrls.length} requested=${variations} remaining=${remaining}`); } catch {}
    while (remaining > 0 && attempts < 5) {
      try {
        const extraBody = { ...body, taskUUID: randomUUID(), numberResults: Math.min(remaining, 20) };
        try { logDebug(`Top-up attempt ${attempts + 1}: requesting ${Math.min(remaining, 20)} more`); } catch {}
        const extraResp = await axios.post(
          'https://api.runware.ai/v1/images/generate',
          [extraBody],
          { headers: rwHeaders, timeout: httpTimeoutMs, signal: abortSignal }
        );
        const extraUrls = extractRunwareImageUrls(extraResp?.data);
        if (Array.isArray(extraUrls) && extraUrls.length > 0) {
          for (const u of extraUrls) {
            if (imageUrls.length < variations) imageUrls.push(u);
          }
          try { logDebug(`Top-up received: +${extraUrls.length} → total=${imageUrls.length}`); } catch {}
        }
      } catch (e) {
        // Break on provider errors to avoid spinning
        try { logDebug(`Top-up aborted due to error: ${e?.message || e}`); } catch {}
        break;
      } finally {
        remaining = Math.max(0, variations - imageUrls.length);
        attempts += 1;
      }
    }
  }

  logDebug('Image URLs:', imageUrls);

    // Process each image URL
    const processedImages = [];
    const successfulItems = [];
    const failedItems = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageSuffix = `_${i + 1}`;
      
      // Generate unique mapping ID for this image
      const mappingId = generateImageMappingId(imageUrl, i + 1, imgNameBase);
      logDebug(`Generated mapping ID for image ${i + 1}: ${mappingId}`);
      
      // Use settings path for temp writes
      const tempDir = config.tempDirectory || './pictures/generated';

      // Download the image
      try {
        // Reuse HTTP timeout to ensure network loss doesn't hang job in 'running'
        let response;
        try {
          response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: httpTimeoutMs, signal: abortSignal });
        } catch (err) {
          failedItems.push({
            mappingId,
            stage: 'download',
            vendor: 'runware',
            message: String(err && err.message || err)
          });
          throw err;
        }
        // Infer extension from URL or content-type header
        let inferredExt = '';
        try {
          const urlPath = new URL(imageUrl).pathname;
          const fromUrl = path.extname(urlPath).toLowerCase();
          if (fromUrl && ['.png', '.jpg', '.jpeg', '.webp'].includes(fromUrl)) {
            inferredExt = fromUrl;
          }
        } catch {}
        if (!inferredExt) {
          const ct = String(response.headers?.['content-type'] || '').toLowerCase();
          if (ct.includes('image/png')) inferredExt = '.png';
          else if (ct.includes('image/jpeg') || ct.includes('image/jpg')) inferredExt = '.jpg';
          else if (ct.includes('image/webp')) inferredExt = '.webp';
        }
        if (!inferredExt) {
          // Fallback to png if unknown
          inferredExt = '.png';
        }
        const inputImagePath = path.resolve(path.join(tempDir, `${imgNameBase}${imageSuffix}${inferredExt}`));
        await fs.mkdir(path.dirname(inputImagePath), { recursive: true });
        await fs.writeFile(inputImagePath, response.data);
        logDebug(`Image downloaded and saved to ${inputImagePath}`); // Use global logDebug

        // Quality checks are now handled by JobRunner after images are saved to database
        // This ensures we have proper database IDs for QC status updates

        // Metadata generation is handled by JobRunner after persistence
        let updatedSettings = { ...settings }; // Create a local copy to modify

        // PROCESS IMAGE
        logDebug('Processing image...');
        // The processImage function now handles everything and returns the final path in /toupload
        let outputPath;
        try {
          // Reset per-image soft failure bucket
          try { (config)._softFailures = []; } catch {}
          outputPath = await processImage(inputImagePath, imgNameBase + imageSuffix, config);
        } catch (procErr) {
          failedItems.push({
            mappingId,
            stage: (procErr && procErr.stage) ? String(procErr.stage) : 'processing',
            vendor: 'local',
            message: String((procErr && procErr.message) || procErr)
          });
          throw procErr;
        }

        processedImages.push({
          outputPath,
          settings: updatedSettings, // Push the modified settings
          mappingId: mappingId, // Include the unique mapping ID
          ...(Array.isArray((config)._softFailures) && (config)._softFailures.length > 0 ? { softFailures: [...(config)._softFailures] } : {})
        });
      } catch (error) {
        console.error('Error during image processing steps:', error);
        try {
          await fs.unlink(inputImagePath); // Attempt to clean up failed image
        } catch (e) { /* ignore */ }
        continue; // Skip to the next image
      }
    }

    if (processedImages.length === 0 && failedItems.length === 0) {
      throw new Error('No images were successfully generated.');
    }

    // Cleanup if no pending tasks
    // await cleanupServerAndTunnel(); // Removed cleanupServerAndTunnel

    // Return the list of processed images and failures for per-image persistence
    return { processedImages, failedItems };
  } catch (error) {
    console.error('Error during image generation:', error);
    // Cleanup in case of error
    // pendingTasks.forEach(({ reject, timeout }, taskId) => { // Removed pendingTasks
    //   clearTimeout(timeout);
    //   reject(new Error('Process terminated due to an error.'));
    //   pendingTasks.delete(taskId);
    // });
    // await cleanupServerAndTunnel(); // Removed cleanupServerAndTunnel
    throw error;
  }
}

async function processImage(inputImagePath, imgName, config = {}) {
  logDebug(`processImage: Starting with inputImagePath: ${inputImagePath}, imgName: ${imgName}`);
  try {
    logDebug('processImage: Received config keys:', Object.keys(config));
    logDebug('processImage: Key settings snapshot', {
      removeBg: !!config.removeBg,
      removeBgFailureMode: String(config.removeBgFailureMode || 'approve'),
      trimTransparentBackground: !!config.trimTransparentBackground,
      imageConvert: !!config.imageConvert,
      convertToJpg: !!config.convertToJpg,
      convertToWebp: !!config.convertToWebp,
      webpQuality: Number.isFinite(Number(config.webpQuality)) ? Number(config.webpQuality) : undefined,
      jpgQuality: Number.isFinite(Number(config.jpgQuality)) ? Number(config.jpgQuality) : undefined,
      removeBgSize: config.removeBgSize || 'preview',
      preserveInput: !!config.preserveInput,
      outputDirectory: config.outputDirectory || '',
      tempDirectory: config.tempDirectory || ''
    });
  } catch {}
  
  const {
    preserveInput,
    removeBg,
    imageConvert,
    imageEnhancement,
    sharpening,
    saturation,
    convertToJpg,
    trimTransparentBackground,
    jpgBackground,
    removeBgSize,
    jpgQuality,
    pngQuality,
    failRetryEnabled,
    failOnSteps,
  } = config;

  try {
    logDebug('processImage: Extracted settings snapshot', {
      removeBg: !!removeBg,
      imageConvert: !!imageConvert,
      imageEnhancement: !!imageEnhancement,
      sharpening,
      saturation,
      convertToJpg: !!convertToJpg,
      trimTransparentBackground: !!trimTransparentBackground,
      jpgBackground,
      removeBgSize,
      jpgQuality,
      pngQuality,
      removeBgFailureMode: String(config?.removeBgFailureMode || 'approve'),
      convertToWebp: !!config?.convertToWebp
    });
  } catch {}

  let imageBuffer;
  try {
    imageBuffer = await fs.readFile(inputImagePath);
  } catch (error) {
    console.error(`Error reading initial image file ${inputImagePath}:`, error);
    throw error;
  }

  // 1. Remove Background (optional)
  if (removeBg) {
    logDebug('Removing background with remove.bg...');
    try {
      // In processImage we rely solely on module config; infer enable by presence of a numeric pollingTimeout
      const timeoutMinutesRawRb = Number.isFinite(Number(config?.pollingTimeout)) ? Number(config.pollingTimeout) : undefined;
      const enableTimeoutFlagRb = Number.isFinite(timeoutMinutesRawRb);
      const removeBgTimeoutMs = enableTimeoutFlagRb
        ? Math.max(1000, Number(timeoutMinutesRawRb) * 60 * 1000)
        : 30000;
      imageBuffer = await retryRemoveBg(inputImagePath, 3, 2000, removeBgSize, config.abortSignal, removeBgTimeoutMs);
      logDebug('Background removal successful');
      try {
        // Signal to caller that remove.bg actually applied
        config._removeBgApplied = true;
      } catch {}
    } catch (error) {
      console.error('Background removal failed:', error);
      const enabled = !!failRetryEnabled;
      const steps = Array.isArray(failOnSteps) ? failOnSteps.map(s => String(s).toLowerCase()) : [];
      // Normalize failure mode from settings:
      // - UI/Job config uses 'approve' | 'mark_failed'
      // - Retry flow may still pass 'soft' | 'fail'
      const rawMode = String(config?.removeBgFailureMode || 'approve').toLowerCase();
      const failureMode = (rawMode === 'mark_failed') ? 'fail' : (rawMode === 'approve' ? 'soft' : rawMode);
      // Treat missing/invalid key or explicit auth errors as hard-fail safeguards
      let unauthorized = false;
      try {
        const status = error?.response?.status;
        const body = error?.response?.data;
        const msg = String(error && error.message || '');
        unauthorized = (!process.env.REMOVE_BG_API_KEY) || status === 401 || status === 403 ||
          /unauthorized|forbidden|x-api-key|invalid api key/i.test(msg) ||
          (typeof body === 'string' && /unauthorized|forbidden|x-api-key|invalid api key/i.test(body));
      } catch {}
      // Respect user mode: only hard-fail when explicitly requested or fail-retry selects the step
      const hardFail = (enabled && steps.includes('remove_bg')) || failureMode === 'fail';
      try {
        logDebug('processImage: remove.bg failure decision', {
          rawMode,
          failureMode,
          failRetryEnabled: enabled,
          stepsIncludeRemoveBg: steps.includes('remove_bg'),
          unauthorized,
          hardFail
        });
      } catch {}
      if (hardFail) {
        try { logDebug('processImage: remove.bg failure treated as HARD-FAIL', { failureMode, unauthorized }); } catch {}
        // Signal to caller that remove.bg did not apply in hard-fail path
        try { config._removeBgApplied = false; } catch {}
        // Record as soft failure as well so callers can detect via consolidated path
        try {
          if (Array.isArray((config)._softFailures)) {
            (config)._softFailures.push({
              stage: 'remove_bg',
              vendor: 'remove.bg',
              message: 'Hard-fail triggered'
            });
          }
        } catch {}
        const err = new Error('processing_failed:remove_bg');
        // @ts-ignore
        err.stage = 'remove_bg';
        throw err;
      } else {
        logDebug('Using original image as fallback for subsequent steps.');
        try {
          if (Array.isArray((config)._softFailures)) {
            (config)._softFailures.push({
              stage: 'remove_bg',
              vendor: 'remove.bg',
              message: String(error && error.message || error)
            });
          }
        } catch {}
        imageBuffer = await fs.readFile(inputImagePath);
      }
    }
  } else {
    imageBuffer = await fs.readFile(inputImagePath);
  }

  let sharpInstance = sharp(imageBuffer);

  // 2. Trim (optional, with conditions)
  if (trimTransparentBackground) {
    if (!removeBg) {
      console.warn("Warning: --trimTransparentBackground requires --removeBg to be true. Skipping trim.");
    } else if (imageConvert && convertToJpg) {
      console.warn("Warning: --trimTransparentBackground has no effect when converting to JPG. Skipping trim.");
    } else {
      logDebug('Trimming transparent background...');
      try {
        sharpInstance = sharpInstance.trim({ threshold: 50 });
      } catch (e) {
        const enabled = !!failRetryEnabled;
        const steps = Array.isArray(failOnSteps) ? failOnSteps.map(s => String(s).toLowerCase()) : [];
        if (enabled && steps.includes('trim')) {
          const err = new Error(`Trim failed: ${String(e && e.message || e)}`);
          // @ts-ignore
          err.stage = 'trim';
          throw err;
        } else {
          console.warn(' processImage: Trim failed but not selected to hard-fail. Continuing without trim.');
        }
      }
    }
  }

  // 3. Apply Image Enhancement Effects (optional)
  if (imageEnhancement) {
    logDebug('Applying image enhancement effects...');
    
    // Apply sharpening if enabled
    if (sharpening > 0) {
      logDebug(`Applying sharpening with intensity: ${sharpening}`);
      sharpInstance = sharpInstance.sharpen({ sigma: sharpening });
    }
    
    // Apply saturation adjustment if enabled
    if (saturation !== 1) {
      logDebug(`Applying saturation adjustment: ${saturation}`);
      sharpInstance = sharpInstance.modulate({ saturation: saturation });
    }
    // Validate enhancement if configured to hard-fail
    try {
      const enabled = !!failRetryEnabled;
      const steps = Array.isArray(failOnSteps) ? failOnSteps.map(s => String(s).toLowerCase()) : [];
      if (enabled && steps.includes('enhancement')) {
        await sharpInstance.clone().toBuffer();
      }
    } catch (e) {
      const err = new Error(`Enhancement failed: ${String(e && e.message || e)}`);
      // @ts-ignore
      err.stage = 'enhancement';
      throw err;
    }
  }

  // 4. Determine Final Format and Path
  // Conversion rules:
  // - If imageConvert is true:
  //    - convertToWebp === true => force WEBP
  //    - else if convertToJpg === true  => force JPG
  //    - else                           => force PNG
  // - If imageConvert is false: preserve original extension when known, else default to PNG
  const originalExt = path.extname(inputImagePath).toLowerCase();
  let finalExtension = '.png';
  if (imageConvert === true) {
    finalExtension = (config.convertToWebp === true) ? '.webp' : (convertToJpg === true ? '.jpg' : '.png');
  } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(originalExt)) {
    finalExtension = (originalExt === '.jpeg') ? '.jpg' : originalExt;
  } else {
    finalExtension = '.png';
  }
  logDebug(`processImage: Final extension determined: ${finalExtension} (convertToJpg: ${convertToJpg}, imageConvert: ${imageConvert}, originalExt: ${originalExt})`);
  
  // Use settings path instead of hardcoded relative path
  logDebug(`processImage: DEBUG - config.outputDirectory: ${String(config.outputDirectory || '')}`);
  try { logDebug('processImage: DEBUG - config keys:', Object.keys(config)); } catch {}
  
  const outputDir = config.outputDirectory || './pictures/toupload';
  logDebug(`processImage: DEBUG - final outputDir: ${outputDir}`);
  
  // Normalize imgName to avoid double extensions like .png.jpg
  const baseName = imgName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  const outputPath = path.resolve(path.join(outputDir, `${baseName}${finalExtension}`));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  logDebug(`processImage: Output path: ${outputPath}`);

  // 5. Encode to Final Format and Save
  try {
    if (finalExtension === '.jpg') {
      const backgroundColor = jpgBackground === 'black' ? '#000000' : '#ffffff';
      console.log(` processImage: Saving as JPG with quality: ${jpgQuality}, background: ${backgroundColor}`);
      await sharpInstance
        .flatten({ background: backgroundColor })
        .jpeg({ quality: jpgQuality, chromaSubsampling: '4:4:4' })
        .toFile(outputPath);
    } else if (finalExtension === '.webp') {
      const webpQuality = Number.isFinite(Number(config.webpQuality)) ? Number(config.webpQuality) : 85;
      console.log(` processImage: Saving as WEBP with quality: ${webpQuality}`);
      await sharpInstance.webp({ quality: webpQuality }).toFile(outputPath);
    } else {
      console.log(` processImage: Saving as PNG (lossless)`);
      await sharpInstance.png().toFile(outputPath);
    }
    logDebug('Final image saved to:', outputPath);
  } catch (error) {
    console.error(`Error saving final image to ${outputPath}:`, error);
    const err = new Error(String(error && error.message || error));
    // Distinguish conversion/write phase broadly as "convert"
    // @ts-ignore
    err.stage = 'convert';
    throw err;
  }

  // 6. Cleanup Original Downloaded Image (only if different from output)
  try {
    const samePath = path.resolve(inputImagePath) === path.resolve(outputPath);
    if (!samePath && !preserveInput) {
      await fs.unlink(inputImagePath);
      logDebug('Cleaned up original downloaded image.');
    } else {
      logDebug('Skipped cleanup: preserveInput is true or inputImagePath equals outputPath');
    }
  } catch (error) {
    console.error(`Error deleting original downloaded image ${inputImagePath}:`, error);
  }

  logDebug(`processImage: Completed successfully. Output: ${outputPath}`);
  return outputPath;
}

module.exports = { producePictureModule, processImage };