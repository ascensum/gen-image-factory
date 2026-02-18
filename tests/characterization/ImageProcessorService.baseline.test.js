/**
 * CHARACTERIZATION TEST: ImageProcessorService Baseline
 * 
 * Purpose: Capture CURRENT behavior of Sharp-based manipulation in producePictureModule.js BEFORE extraction.
 * 
 * CRITICAL: These tests must pass against LEGACY code (producePictureModule.js lines ~694-798)
 * AND against the new ImageProcessorService after extraction (1:1 parity verification).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);

describe('ImageProcessorService Characterization Tests (Baseline)', () => {
  let producePictureModule;
  const tempTestDir = path.resolve(__dirname, '../../temp-test-image-processor');
  const inputImagePath = path.join(tempTestDir, 'input.png');
  const imgName = 'test-image';

  // 100x100 white PNG
  const whitePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZ0lEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GYZAAAF396YQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(async () => {
    await fs.mkdir(tempTestDir, { recursive: true });
    await fs.writeFile(inputImagePath, whitePngBuffer);

    process.env.FEATURE_MODULAR_PROCESSOR = 'true';

    // Mock dependencies in producePictureModule.js
    // We need to ensure we can load the module
    producePictureModule = req('../../src/producePictureModule.js');
  });

  afterEach(async () => {
    await fs.rm(tempTestDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should process image and save as PNG by default', async () => {
    const config = {
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: true
    };

    const resultPath = await producePictureModule.processImage(inputImagePath, imgName, config);

    expect(resultPath).toContain(imgName);
    expect(resultPath).toContain('.png');
    
    const exists = await fs.access(resultPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should convert image to JPG with specified quality', async () => {
    const config = {
      imageConvert: true,
      convertToJpg: true,
      jpgQuality: 80,
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: true
    };

    const resultPath = await producePictureModule.processImage(inputImagePath, imgName, config);

    expect(resultPath).toContain('.jpg');
    
    // Verify it's actually a JPG (check header)
    const buffer = await fs.readFile(resultPath);
    expect(buffer[0]).toBe(0xFF);
    expect(buffer[1]).toBe(0xD8);
  });

  it('should convert image to WebP with specified quality', async () => {
    const config = {
      imageConvert: true,
      convertToWebp: true,
      webpQuality: 75,
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: true
    };

    const resultPath = await producePictureModule.processImage(inputImagePath, imgName, config);

    expect(resultPath).toContain('.webp');
    
    const buffer = await fs.readFile(resultPath);
    // WebP signature 'RIFF' .... 'WEBP'
    expect(buffer.toString('utf8', 0, 4)).toBe('RIFF');
    expect(buffer.toString('utf8', 8, 12)).toBe('WEBP');
  });

  it('should apply sharpening and saturation if imageEnhancement is enabled', async () => {
    const config = {
      imageEnhancement: true,
      sharpening: 2,
      saturation: 1.5,
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: true
    };

    // This primarily tests that it doesn't crash and produces an output
    const resultPath = await producePictureModule.processImage(inputImagePath, imgName, config);
    expect(resultPath).toBeDefined();
    
    const exists = await fs.access(resultPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should throw error on enhancement failure if configured to hard-fail', async () => {
    const config = {
      imageEnhancement: true,
      failRetryEnabled: true,
      failOnSteps: ['enhancement'],
      saturation: 1, // Provide valid saturation to reach the hard-fail check
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: true
    };

    // To trigger a failure, we corrupt the file.
    await fs.writeFile(inputImagePath, Buffer.from('not an image'));

    // The error message comes from Sharp when it tries to read the corrupted image
    await expect(producePictureModule.processImage(inputImagePath, imgName, config))
      .rejects.toThrow();
  });

  it('should cleanup original image if preserveInput is false', async () => {
    const config = {
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: false
    };

    const resultPath = await producePictureModule.processImage(inputImagePath, imgName, config);
    
    const inputExists = await fs.access(inputImagePath).then(() => true).catch(() => false);
    expect(inputExists).toBe(false);
    
    const outputExists = await fs.access(resultPath).then(() => true).catch(() => false);
    expect(outputExists).toBe(true);
  });

  it('should preserve original extension if imageConvert is false', async () => {
    const jpgPath = path.join(tempTestDir, 'input.jpg');
    // Minimal JPG header
    await fs.writeFile(jpgPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xDB]));
    
    const config = {
      imageConvert: false,
      outputDirectory: tempTestDir,
      tempDirectory: tempTestDir,
      preserveInput: true
    };

    // Sharp might fail on the minimal JPG, let's use the PNG but rename it to .jpg
    // Actually, Sharp checks content, not extension. 
    // But determine final format uses extension: 
    // const originalExt = path.extname(inputImagePath).toLowerCase();
    
    const resultPath = await producePictureModule.processImage(inputImagePath, imgName, config);
    // original inputImagePath is .png
    expect(resultPath).toContain('.png');
  });
});
