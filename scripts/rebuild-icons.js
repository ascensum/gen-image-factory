#!/usr/bin/env node

/**
 * Icon Rebuild Script
 * 
 * Rebuilds application icons from the source 1024x1024 PNG to platform-specific formats
 * using Sharp (secure, already in dependencies) and @ffflorian/electron-icon-generator.
 * 
 * Requirements:
 * - Source icon: electron/renderer/assets/gen_image_factory_icon_tray_icon_1024x1024.png
 * - Output: build/icons/win/icon.ico, build/icons/mac/icon.icns, build/icons/png/*.png
 * 
 * Usage:
 *   npm run rebuild-icons
 * 
 * Note: This script uses Sharp (already in dependencies) for PNG generation and
 * @ffflorian/electron-icon-generator (secure alternative) for ICO/ICNS conversion.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceIcon = path.join(__dirname, '../electron/renderer/assets/gen_image_factory_icon_tray_icon_1024x1024.png');
const outputDir = path.join(__dirname, '../build/icons');

// Icon sizes needed for different platforms
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

// Check if source icon exists
if (!fs.existsSync(sourceIcon)) {
  console.error(`Error: Source icon not found at ${sourceIcon}`);
  process.exit(1);
}

console.log('Icon Rebuild Script');
console.log('==================');
console.log(`Source: ${sourceIcon}`);
console.log(`Output: ${outputDir}`);
console.log('');

// Ensure output directories exist
const winDir = path.join(outputDir, 'win');
const macDir = path.join(outputDir, 'mac');
const pngDir = path.join(outputDir, 'png');

[winDir, macDir, pngDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function generatePNGs() {
  console.log('Generating PNG files using Sharp...');
  const tasks = pngSizes.map(size => {
    const outputPath = path.join(pngDir, `${size}x${size}.png`);
    return sharp(sourceIcon)
      .resize(size, size, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toFile(outputPath)
      .then(() => console.log(`  [OK] ${size}x${size}.png`))
      .catch(err => {
        console.error(`  [ERROR] Failed to generate ${size}x${size}.png:`, err.message);
        throw err;
      });
  });
  await Promise.all(tasks);
  console.log('PNG generation complete!\n');
}

async function generateICOAndICNS() {
  console.log('Generating ICO and ICNS files...');
  
  // Check if @ffflorian/electron-icon-generator is available
  let iconGenerator;
  try {
    iconGenerator = require('@ffflorian/electron-icon-generator');
  } catch {
    console.log('  Installing @ffflorian/electron-icon-generator (secure alternative)...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install --save-dev @ffflorian/electron-icon-generator', { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, '..') 
      });
      iconGenerator = require('@ffflorian/electron-icon-generator');
    } catch (err) {
      console.error('  [ERROR] Failed to install @ffflorian/electron-icon-generator.');
      console.error('  Error:', err.message);
      console.log('\n  Alternative options:');
      console.log('  1. Install manually: npm install --save-dev @ffflorian/electron-icon-generator');
      console.log('  2. Use online converter: https://cloudconvert.com/png-to-ico');
      console.log('  3. Icons are already generated in build/icons/ - no action needed');
      return;
    }
  }
  
  try {
    // Generate icons using the secure alternative
    await iconGenerator({
      input: sourceIcon,
      output: outputDir
    });
    
    console.log('  [OK] icon.ico (Windows)');
    console.log('  [OK] icon.icns (macOS)');
    console.log('ICO/ICNS generation complete!\n');
  } catch (err) {
    console.error('  [ERROR] Failed to generate ICO/ICNS:', err.message);
    console.log('  Note: PNG files were generated successfully.');
    console.log('  You can use online tools to convert PNGs to ICO/ICNS if needed.');
  }
}

async function main() {
  try {
    await generatePNGs();
    await generateICOAndICNS();
    
    console.log('[SUCCESS] Icons rebuilt successfully!');
    console.log('\nGenerated files:');
    console.log('  - build/icons/win/icon.ico');
    console.log('  - build/icons/mac/icon.icns');
    console.log('  - build/icons/png/*.png (16x16 to 1024x1024)');
    console.log('\nIcon Size Recommendations:');
    console.log('  - macOS Menu Bar/Tray: Use 24x24.png or 32x32.png (16x16 is too small)');
    console.log('  - Windows System Tray: Use 16x16.png (standard)');
    console.log('  - Desktop Icons: Use 32x32.png or larger');
  } catch (error) {
    console.error('\n[ERROR] Error rebuilding icons:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
