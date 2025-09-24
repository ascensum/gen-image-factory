const axios = require("axios");
// const express = require('express'); // Removed express
const fs = require('fs').promises;
//const fetch = require('node-fetch');
const FormData = require('form-data'); // Uncommented to fix runtime error
const path = require('path');
const sharp = require("sharp");
const { Blob } = require('node:buffer'); // Import Blob
const { logDebug } = require('./utils/logDebug'); // Corrected path
const aiVision = require('./aiVision');
//const ngrok = require('ngrok'); // Removed ngrok dependency
//require("dotenv").config(); // dotenv is already required in index.js


async function pause(isLong = false, seconds) {
  const milliseconds = isLong ? 60000 : (seconds || 3000);
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function removeBg(inputPath, removeBgSize) {
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
      timeout: 60000
    });

    if (response.status === 200 && response.data) {
      return Buffer.from(response.data);
    }
    throw new Error(`Failed to remove background: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error('Error in removeBg:', error);
    throw error;
  }
}

// Retry mechanism for removeBg
async function retryRemoveBg(inputPath, retries = 3, delay = 2000, removeBgSize) {
  for (let i = 0; i < retries; i++) {
    try {
      return await removeBg(inputPath, removeBgSize);
    } catch (error) {
      const isRetryable = !error.response || (error.response.status >= 500) || error.code === 'ECONNABORTED' || error.response?.status === 429;
      console.warn(`Attempt ${i + 1} for removeBg failed: ${error.message}. ${isRetryable && i < retries - 1 ? `Retrying in ${delay / 1000} seconds...` : 'Not retryable or no attempts left.'}`);
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
  const width = dims?.width;
  const height = dims?.height;

  // Build Runware request
  const runwareModel = settings?.parameters?.runwareModel || 'runware:101@1';
  const variations = Math.max(1, Math.min(20, Number(config?.variations || settings?.parameters?.variations || 1)));
  const providerFormat = (settings?.parameters?.runwareFormat || 'png').toLowerCase(); // png|jpg|webp
  const outputFormat = providerFormat === 'jpeg' ? 'jpg' : providerFormat;
  const advanced = settings?.parameters?.runwareAdvanced || {};

  const body = {
    model: runwareModel,
    positivePrompt: sanitizePromptForRunware(prompt),
    numberResults: variations,
    outputType: 'URL',
    outputFormat,
    ...(width && height ? { width, height } : {}),
    ...(Array.isArray(advanced?.lora) && advanced.lora.length > 0 ? { loras: advanced.lora.filter(x => x && x.model).map(x => ({ model: x.model, weight: Number(x.weight) || 1 })) } : {}),
    ...(typeof advanced.checkNSFW === 'boolean' ? { checkNSFW: !!advanced.checkNSFW } : {}),
    ...(advanced.scheduler ? { scheduler: String(advanced.scheduler) } : {}),
    ...(Number.isFinite(Number(advanced.CFGScale)) ? { CFGScale: Number(advanced.CFGScale) } : {}),
    ...(Number.isFinite(Number(advanced.steps)) ? { steps: Number(advanced.steps) } : {})
  };

  // Timeouts: reuse pollingTimeout (minutes) as HTTP timeout (ms) if provided
  const httpTimeoutMs = (config?.pollingTimeout ? Number(config.pollingTimeout) * 60 * 1000 : 30000);
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
    rwResponse = await axios.post(
      'https://api.runware.ai/v1/images/generate',
      payload,
      { headers: rwHeaders, timeout: httpTimeoutMs }
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
  const imageUrls = extractRunwareImageUrls(rwData);
  if (!imageUrls.length) {
    throw new Error('Runware returned no images. Please adjust parameters or try again.');
  }

  logDebug('Image URLs:', imageUrls);

    // Process each image URL
    const processedImages = [];
    const successfulItems = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageSuffix = `_${i + 1}`;
      
      // Generate unique mapping ID for this image
      const mappingId = generateImageMappingId(imageUrl, i + 1, imgNameBase);
      logDebug(`Generated mapping ID for image ${i + 1}: ${mappingId}`);
      
      // Use settings path instead of hardcoded relative path
      const tempDir = config.tempDirectory || './pictures/generated';
      const inputImagePath = path.resolve(path.join(tempDir, `${imgNameBase}${imageSuffix}.png`));

      // Download the image
      try {
        await axios
          .get(imageUrl, { responseType: 'arraybuffer' })
          .then(async (response) => {
            await fs.mkdir(path.dirname(inputImagePath), { recursive: true });
            await fs.writeFile(inputImagePath, response.data);
            logDebug(`Image downloaded and saved to ${inputImagePath}`); // Use global logDebug
          })
          .catch((error) => {
            console.error('Error downloading image:', error);
            throw error;
          });

        // Quality checks are now handled by JobRunner after images are saved to database
        // This ensures we have proper database IDs for QC status updates

        // --- Conditionally run Metadata Generation ---
        let updatedSettings = { ...settings }; // Create a local copy to modify
        if (runMetadataGen) {
          const metadataResult = await aiVision.generateMetadata(
            inputImagePath,
            promptContext,
            customMetadataPrompt,
            config.openaiModel
          );
          
          // Log the metadata result for debugging
          console.log('🔍 Metadata result from aiVision with keys:', metadataResult ? Object.keys(metadataResult) : 'none');
          
          // Update settings with new metadata
          if (metadataResult.new_title) {
            // Ensure nested objects exist before assignment
            updatedSettings.title = updatedSettings.title || {};
            updatedSettings.title.title = { en: metadataResult.new_title };
            console.log('✅ Added title to settings:', metadataResult.new_title);
          }
          if (metadataResult.new_description) {
            updatedSettings.title = updatedSettings.title || {};
            updatedSettings.title.description = { en: metadataResult.new_description };
            console.log('✅ Added description to settings:', metadataResult.new_description);
          }
          if (metadataResult.uploadTags) {
            updatedSettings.uploadTags = { en: metadataResult.uploadTags };
            console.log('✅ Added uploadTags to settings:', metadataResult.uploadTags);
          }
          
          // Log the final updated settings
          console.log('🔍 Final updatedSettings with keys:', Object.keys(updatedSettings));
        }

        // PROCESS IMAGE
        logDebug('Processing image...');
        // The processImage function now handles everything and returns the final path in /toupload
        const outputPath = await processImage(inputImagePath, imgNameBase + imageSuffix, config);

        processedImages.push({
          outputPath,
          settings: updatedSettings, // Push the modified settings
          mappingId: mappingId, // Include the unique mapping ID
        });
      } catch (error) {
        console.error('Error during image processing steps:', error);
        try {
          await fs.unlink(inputImagePath); // Attempt to clean up failed image
        } catch (e) { /* ignore */ }
        continue; // Skip to the next image
      }
    }

    if (processedImages.length === 0) {
      throw new Error('No images passed the quality check.');
    }

    // Cleanup if no pending tasks
    // await cleanupServerAndTunnel(); // Removed cleanupServerAndTunnel

    // Return the list of processed images and updated settings
    return processedImages;
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
  console.log(`🔧 processImage: Starting with inputImagePath: ${inputImagePath}, imgName: ${imgName}`);
  console.log(`🔧 processImage: Received config keys:`, Object.keys(config));
  
  const {
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
  } = config;

  console.log(`🔧 processImage: Extracted settings:`);
  console.log(`  - removeBg: ${removeBg}`);
  console.log(`  - imageConvert: ${imageConvert}`);
  console.log(`  - imageEnhancement: ${imageEnhancement}`);
  console.log(`  - sharpening: ${sharpening}`);
  console.log(`  - saturation: ${saturation}`);
  console.log(`  - convertToJpg: ${convertToJpg}`);
  console.log(`  - trimTransparentBackground: ${trimTransparentBackground}`);
  console.log(`  - jpgBackground: ${jpgBackground}`);
  console.log(`  - removeBgSize: ${removeBgSize}`);
  console.log(`  - jpgQuality: ${jpgQuality}`);
  console.log(`  - pngQuality: ${pngQuality}`);

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
      imageBuffer = await retryRemoveBg(inputImagePath, 3, 2000, removeBgSize);
      logDebug('Background removal successful');
    } catch (error) {
      console.error('Background removal failed:', error);
      logDebug('Using original image as fallback for subsequent steps.');
      imageBuffer = await fs.readFile(inputImagePath);
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
      sharpInstance = sharpInstance.trim({ threshold: 50 });
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
  }

  // 4. Determine Final Format and Path
  // Align behavior with retryExecutor: require both imageConvert AND convertToJpg to convert
  const shouldConvertToJpg = !!imageConvert && !!convertToJpg;
  const finalExtension = shouldConvertToJpg ? ".jpg" : ".png";
  console.log(`🔧 processImage: Final extension determined: ${finalExtension} (convertToJpg: ${convertToJpg}, imageConvert: ${imageConvert})`);
  
  // Use settings path instead of hardcoded relative path
  console.log(`🔧 processImage: DEBUG - config.outputDirectory:`, config.outputDirectory);
  console.log(`🔧 processImage: DEBUG - config keys:`, Object.keys(config));
  
  const outputDir = config.outputDirectory || './pictures/toupload';
  console.log(`🔧 processImage: DEBUG - final outputDir:`, outputDir);
  
  // Normalize imgName to avoid double extensions like .png.jpg
  const baseName = imgName.replace(/\.(png|jpg|jpeg)$/i, '');
  const outputPath = path.resolve(path.join(outputDir, `${baseName}${finalExtension}`));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  console.log(`🔧 processImage: Output path: ${outputPath}`);

  // 5. Encode to Final Format and Save
  try {
    if (finalExtension === '.jpg') {
      const backgroundColor = jpgBackground === 'black' ? '#000000' : '#ffffff';
      console.log(`🔧 processImage: Saving as JPG with quality: ${jpgQuality}, background: ${backgroundColor}`);
      await sharpInstance
        .flatten({ background: backgroundColor })
        .jpeg({ quality: jpgQuality, chromaSubsampling: '4:4:4' })
        .toFile(outputPath);
    } else {
      console.log(`🔧 processImage: Saving as PNG with quality: ${pngQuality}`);
      await sharpInstance.png({ quality: pngQuality }).toFile(outputPath);
    }
    logDebug('Final image saved to:', outputPath);
  } catch (error) {
    console.error(`Error saving final image to ${outputPath}:`, error);
    throw error;
  }

  // 6. Cleanup Original Downloaded Image (only if different from output)
  try {
    const samePath = path.resolve(inputImagePath) === path.resolve(outputPath);
    if (!samePath) {
      await fs.unlink(inputImagePath);
      logDebug('Cleaned up original downloaded image.');
    } else {
      logDebug('Skipped cleanup: inputImagePath equals outputPath');
    }
  } catch (error) {
    console.error(`Error deleting original downloaded image ${inputImagePath}:`, error);
  }

  console.log(`🔧 processImage: Completed successfully. Output: ${outputPath}`);
  return outputPath;
}

module.exports = { producePictureModule, processImage };