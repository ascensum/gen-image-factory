const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { emitPipelineStage } = require(path.join(__dirname, '../utils/pipelineStageLog'));

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

    emitPipelineStage(config, 'sharp_local_begin', 'Sharp encode/write (local CPU, no network)', {
      phase: 'local',
      imgName,
      generationIndex: config.generationIndex,
      imageConvert: !!imageConvert,
      trim: !!trimTransparentBackground,
      enhancement: !!imageEnhancement
    });

    let sharpInstance = sharp(imageBuffer);

    // 1. Trim transparent edges (intended for alpha PNGs after remove.bg; normalizer clears trim when remove.bg is off)
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

      const sharpenSlider = Number(sharpening);
      if (Number.isFinite(sharpenSlider) && sharpenSlider > 0) {
        const sigma = sharpenSlider * 0.2;
        this.logDebug(`Sharpening: slider=${sharpenSlider} → sharp.sharpen sigma=${sigma}`);
        sharpInstance = sharpInstance.sharpen({ sigma });
      }

      const sat = Number(saturation);
      if (Number.isFinite(sat) && Math.abs(sat - 1) > 1e-6) {
        const satClamped = Math.min(3, Math.max(0, sat));
        this.logDebug(`Saturation modulate: ${satClamped} (1 = unchanged)`);
        sharpInstance = sharpInstance.modulate({ saturation: satClamped });
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
        const BLACK_VALUES = ['black', '#000000', '#000'];
        const backgroundColor = BLACK_VALUES.includes(String(jpgBackground || '').toLowerCase()) ? '#000000' : '#ffffff';
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

    emitPipelineStage(config, 'sharp_local_end', 'Sharp pipeline finished', {
      phase: 'local',
      outputPath,
      generationIndex: config.generationIndex
    });

    return outputPath;
  }
}

module.exports = ImageProcessorService;
