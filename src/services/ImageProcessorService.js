const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class ImageProcessorService {
  constructor(dependencies = {}) {
    this.fs = dependencies.fs || fs;
    this.logDebug = dependencies.logDebug || (() => {});
  }

  async process(imageBuffer, imgName, config = {}) {
    const {
      imageConvert,
      imageEnhancement,
      sharpening,
      saturation,
      convertToJpg,
      convertToWebp,
      trimTransparentBackground,
      jpgBackground,
      jpgQuality,
      webpQuality,
      failRetryEnabled,
      failOnSteps,
      outputDirectory,
      inputImagePath // for cleanup
    } = config;

    let sharpInstance = sharp(imageBuffer);

    // 1. Trim (already handled if modular remover was used, but we keep it for pure processor usage)
    if (trimTransparentBackground) {
      this.logDebug('Trimming transparent background (processor)...');
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
          console.warn(' ImageProcessorService: Trim failed but not selected to hard-fail. Continuing without trim.');
        }
      }
    }

    // 2. Apply Image Enhancement Effects (optional)
    if (imageEnhancement) {
      this.logDebug('Applying image enhancement effects (processor)...');
      
      if (sharpening > 0) {
        this.logDebug(`Applying sharpening with intensity: ${sharpening}`);
        sharpInstance = sharpInstance.sharpen({ sigma: sharpening });
      }
      
      if (saturation !== 1) {
        this.logDebug(`Applying saturation adjustment: ${saturation}`);
        sharpInstance = sharpInstance.modulate({ saturation: saturation });
      }

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

    // 3. Determine Final Format and Path
    const originalExt = inputImagePath ? path.extname(inputImagePath).toLowerCase() : '.png';
    let finalExtension = '.png';
    if (imageConvert === true) {
      finalExtension = (convertToWebp === true) ? '.webp' : (convertToJpg === true ? '.jpg' : '.png');
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(originalExt)) {
      finalExtension = (originalExt === '.jpeg') ? '.jpg' : originalExt;
    } else {
      finalExtension = '.png';
    }

    const outputDir = outputDirectory || './pictures/toupload';
    const baseName = imgName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const outputPath = path.resolve(path.join(outputDir, `${baseName}${finalExtension}`));
    await this.fs.mkdir(path.dirname(outputPath), { recursive: true });

    // 4. Encode and Save
    try {
      if (finalExtension === '.jpg') {
        const backgroundColor = jpgBackground === 'black' ? '#000000' : '#ffffff';
        await sharpInstance
          .flatten({ background: backgroundColor })
          .jpeg({ quality: jpgQuality || 80, chromaSubsampling: '4:4:4' })
          .toFile(outputPath);
      } else if (finalExtension === '.webp') {
        const quality = Number.isFinite(Number(webpQuality)) ? Number(webpQuality) : 85;
        await sharpInstance.webp({ quality }).toFile(outputPath);
      } else {
        await sharpInstance.png().toFile(outputPath);
      }
      this.logDebug('Final image saved to:', outputPath);
    } catch (error) {
      const err = new Error(String(error && error.message || error));
      // Distinguish conversion/write phase broadly as "convert"
      // @ts-ignore
      err.stage = 'convert';
      throw err;
    }

    // 5. Cleanup Original Downloaded Image (only if different from output)
    try {
      const { preserveInput, inputImagePath: originalPath } = config;
      const samePath = originalPath && path.resolve(originalPath) === path.resolve(outputPath);
      if (originalPath && !samePath && !preserveInput) {
        await this.fs.unlink(originalPath);
        this.logDebug('Cleaned up original downloaded image.');
      }
    } catch (error) {
      console.error(`Error deleting original downloaded image:`, error);
    }

    return outputPath;
  }
}

module.exports = ImageProcessorService;
