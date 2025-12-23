#!/usr/bin/env node

/**
 * Icon Rebuild Script
 * 
 * Rebuilds application icons from the source 1024x1024 PNG to platform-specific formats
 * using electron-icon-builder.
 * 
 * Requirements:
 * - Source icon: electron/renderer/assets/gen_image_factory_icon_tray_icon_1024x1024.png
 * - Output: build/icons/win/icon.ico, build/icons/mac/icon.icns, build/icons/png/*.png
 * 
 * Usage:
 *   npm run rebuild-icons
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceIcon = path.join(__dirname, '../electron/renderer/assets/gen_image_factory_icon_tray_icon_1024x1024.png');
const outputDir = path.join(__dirname, '../build/icons');

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

// Check if electron-icon-builder is available
try {
  require.resolve('electron-icon-builder');
} catch {
  console.error('Error: electron-icon-builder is not installed.');
  console.error('Please run: npm install --save-dev electron-icon-builder');
  process.exit(1);
}

console.log('Rebuilding icons using electron-icon-builder...');
console.log('');

try {
  // Run electron-icon-builder
  execSync(
    `npx electron-icon-builder --input="${sourceIcon}" --output="${outputDir}"`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  );

  // electron-icon-builder creates icons in a nested directory structure
  // Move them to the correct location
  const nestedIconsDir = path.join(outputDir, 'icons');
  if (fs.existsSync(nestedIconsDir)) {
    console.log('\nMoving icons to correct location...');
    
    // Move win/icon.ico
    const nestedWin = path.join(nestedIconsDir, 'win', 'icon.ico');
    const targetWin = path.join(outputDir, 'win', 'icon.ico');
    if (fs.existsSync(nestedWin)) {
      if (!fs.existsSync(path.dirname(targetWin))) {
        fs.mkdirSync(path.dirname(targetWin), { recursive: true });
      }
      fs.copyFileSync(nestedWin, targetWin);
    }
    
    // Move mac/icon.icns
    const nestedMac = path.join(nestedIconsDir, 'mac', 'icon.icns');
    const targetMac = path.join(outputDir, 'mac', 'icon.icns');
    if (fs.existsSync(nestedMac)) {
      if (!fs.existsSync(path.dirname(targetMac))) {
        fs.mkdirSync(path.dirname(targetMac), { recursive: true });
      }
      fs.copyFileSync(nestedMac, targetMac);
    }
    
    // Move PNG files
    const nestedPng = path.join(nestedIconsDir, 'png');
    const targetPng = path.join(outputDir, 'png');
    if (fs.existsSync(nestedPng)) {
      if (!fs.existsSync(targetPng)) {
        fs.mkdirSync(targetPng, { recursive: true });
      }
      const pngFiles = fs.readdirSync(nestedPng);
      pngFiles.forEach(file => {
        const src = path.join(nestedPng, file);
        const dest = path.join(targetPng, file);
        fs.copyFileSync(src, dest);
      });
    }
    
    // Remove nested directory
    fs.rmSync(nestedIconsDir, { recursive: true, force: true });
    console.log('Icons moved successfully.');
  }

  console.log('\nIcons rebuilt successfully!');
  console.log('\nGenerated files:');
  console.log('  - build/icons/win/icon.ico');
  console.log('  - build/icons/mac/icon.icns');
  console.log('  - build/icons/png/*.png (16x16 to 1024x1024)');
  console.log('\nIcon Size Recommendations:');
  console.log('  - macOS Menu Bar/Tray: Use 24x24.png or 32x32.png (16x16 is too small)');
  console.log('  - Windows System Tray: Use 16x16.png (standard)');
  console.log('  - Desktop Icons: Use 32x32.png or larger');
} catch (error) {
  console.error('\nERROR: Error rebuilding icons:', error.message);
  process.exit(1);
}

