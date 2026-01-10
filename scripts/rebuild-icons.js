#!/usr/bin/env node

/**
 * Icon Rebuild Script
 * 
 * Rebuilds application icons from the source 1024x1024 PNG to platform-specific formats
 * using Sharp (secure, already in dependencies) and @ffflorian/electron-icon-generator.
 * 
 * Requirements:
 * - Source icon: build/icons/gen_image_factory_icon_tray_icon_1024x1024.png
 * - Output: build/icons/win/icon.ico, build/icons/mac/icon.icns, build/icons/png/*.png
 * - Output (AppX): build/icons/appx/*.png (Microsoft Store assets)
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

const sourceIcon = path.join(__dirname, '../build/icons/gen_image_factory_icon_tray_icon_1024x1024.png');
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
// Output directly to build/appx where electron-builder v25+ expects them by default
const appxDir = path.join(__dirname, '../build/appx');

[winDir, macDir, pngDir, appxDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function generatePNGs() {
  console.log('Generating PNG files using Sharp...');
  const tasks = pngSizes.map(size => {
    // Output as "16.png" etc. for icon-gen compatibility
    const outputPath = path.join(pngDir, `${size}.png`);
    
    // Apply "Contained" look to ALL icons (Dock, Window, Tray)
    // This creates a uniform "App Icon" style: Black Rounded Square with Logo inside
    const cornerRadius = Math.round(size * 0.22); // Standard squircle-ish radius
    const rectSize = size;
    const logoSize = Math.round(size * 0.7); // Logo is 70% of the container
    
    const resizeOptions = {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    };

    // Create rounded rectangle SVG background (Solid Black)
    const roundedRectSvg = Buffer.from(`
      <svg width="${rectSize}" height="${rectSize}" viewBox="0 0 ${rectSize} ${rectSize}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${rectSize}" height="${rectSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="black"/>
      </svg>
    `);

    // For the standard color icons, we want White Logo on Black Background
    // We can use .tint() or .threshold() if the source is simple, but simple resizing is safest if source is already white/light.
    // If source is colored, we might want to force it white for this high-contrast look?
    // Let's stick to just resizing the source. If it's your colorful logo, it will be on black.
    // If you want strictly White-on-Black, we'd need to grayscale+invert or threshold.
    // Assuming the user provided a logo that looks good on black.
    
    return sharp(sourceIcon)
      .resize(logoSize, logoSize, resizeOptions)
      .toBuffer()
      .then(logoBuffer => {
        return sharp(roundedRectSvg)
          .composite([{ input: logoBuffer }]) // Standard overlay (Logo ON Black)
          .png()
          .toFile(outputPath);
      })
      .then(() => console.log(`  [OK] ${size}.png (Contained App Icon)`))
      .catch(err => {
        console.error(`  [ERROR] Failed to generate ${size}.png:`, err.message);
        throw err;
      });
  });
  await Promise.all(tasks);
  console.log('PNG generation complete!\n');
}

async function renamePNGs() {
  console.log('Renaming PNGs to Electron format (NxN.png)...');
  const tasks = pngSizes.map(size => {
    const src = path.join(pngDir, `${size}.png`);
    const dest = path.join(pngDir, `${size}x${size}.png`);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
      console.log(`  [OK] Renamed ${size}.png -> ${size}x${size}.png`);
    }
  });
  console.log('PNG renaming complete!\n');
}

async function generateAppxAssets() {
  console.log('Generating AppX assets for Microsoft Store...');
  
  const appxAssets = [
    { name: 'Square44x44Logo.scale-200.png', width: 88, height: 88, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square150x150Logo.scale-200.png', width: 300, height: 300, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'StoreLogo.scale-200.png', width: 100, height: 100, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Wide310x150Logo.scale-200.png', width: 620, height: 300, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'SplashScreen.scale-200.png', width: 1240, height: 600, bg: { r: 255, g: 255, b: 255, alpha: 1 } },
    
    // Base Fallbacks (Scale 100 / Unplated) - REQUIRED for WACK compliance
    { name: 'Square44x44Logo.png', width: 44, height: 44, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.scale-100.png', width: 44, height: 44, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'StoreLogo.png', width: 50, height: 50, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square150x150Logo.png', width: 150, height: 150, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Wide310x150Logo.png', width: 310, height: 150, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'SplashScreen.png', width: 620, height: 300, bg: { r: 255, g: 255, b: 255, alpha: 1 } },

    // Standard targetsize icons
    { name: 'Square44x44Logo.targetsize-24.png', width: 24, height: 24, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.targetsize-48.png', width: 48, height: 48, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.targetsize-256.png', width: 256, height: 256, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    // Unplated targetsize icons (specifically for the taskbar and window header)
    { name: 'Square44x44Logo.targetsize-16_altform-unplated.png', width: 16, height: 16, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.targetsize-24_altform-unplated.png', width: 24, height: 24, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.targetsize-32_altform-unplated.png', width: 32, height: 32, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.targetsize-48_altform-unplated.png', width: 48, height: 48, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    { name: 'Square44x44Logo.targetsize-256_altform-unplated.png', width: 256, height: 256, bg: { r: 0, g: 0, b: 0, alpha: 0 } }
  ];

  const tasks = appxAssets.map(asset => {
    const outputPath = path.join(appxDir, asset.name);
    return sharp(sourceIcon)
      .resize(asset.width, asset.height, { 
        fit: 'contain', 
        background: asset.bg 
      })
      .png()
      .toFile(outputPath)
      .then(() => console.log(`  [OK] appx/${asset.name}`))
      .catch(err => {
        console.error(`  [ERROR] Failed to generate appx/${asset.name}:`, err.message);
        throw err;
      });
  });

  await Promise.all(tasks);
  console.log('AppX assets generation complete!\n');
}

async function generateICOAndICNS() {
  console.log('Generating ICO and ICNS files...');
  
  let icongen;
  try {
    icongen = require('icon-gen');
  } catch {
    console.log('  Installing icon-gen...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install --save-dev icon-gen', { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, '..') 
      });
      icongen = require('icon-gen');
    } catch (err) {
      console.error('  [ERROR] Failed to install icon-gen.');
      return;
    }
  }
  
  try {
    // 1. Generate the standard macOS Retina Tray Icon (Template)
    // 44x44 is the standard size for @2x menu bar icons on macOS
    // BUT the visual shape should be smaller (~36x36) to avoid looking "huge"
    const macTraySize = 44; // Canvas size
    const visualSize = 36;  // Actual icon shape size (18pt)
    const padding = (macTraySize - visualSize) / 2; // Centering offset
    const macTrayPath = path.join(macDir, 'iconTemplate@2x.png');
    
    const cornerRadius = Math.round(visualSize * 0.2);
    // Logo should be relative to the visual container size
    const logoSize = Math.round(visualSize * 0.65); 

    // Create the background shape (smaller rect centered in 44x44 canvas)
    const roundedRectSvg = Buffer.from(`
      <svg width="${macTraySize}" height="${macTraySize}" viewBox="0 0 ${macTraySize} ${macTraySize}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${padding}" y="${padding}" width="${visualSize}" height="${visualSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="black"/>
      </svg>
    `);

    const logoBuffer = await sharp(sourceIcon)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Composite: 
    // 1. Start with the rounded rect SVG (which includes the transparent margins)
    // 2. Composite the logo in the center using dest-out (punch hole)
    await sharp(roundedRectSvg)
      .composite([{ input: logoBuffer, blend: 'dest-out', gravity: 'center' }])
      .png()
      .toFile(macTrayPath);
    
    console.log('  [OK] Generated macOS Retina Tray Icon (iconTemplate@2x.png) with Cutout & Padding');

    // 2. Generate standard ICO/ICNS
    await icongen(pngDir, outputDir, {
      report: true,
      ico: { name: 'icon', sizes: [16, 24, 32, 48, 64, 128, 256] },
      icns: { name: 'icon', sizes: [16, 32, 64, 128, 256, 512, 1024] }
    });
    
    // Move generated files to platform-specific directories if they were created in the root
    const generatedIco = path.join(outputDir, 'icon.ico');
    const generatedIcns = path.join(outputDir, 'icon.icns');
    
    if (fs.existsSync(generatedIco)) {
      fs.renameSync(generatedIco, path.join(winDir, 'icon.ico'));
      console.log('  [OK] Moved icon.ico to win/');
    }
    
    if (fs.existsSync(generatedIcns)) {
      fs.renameSync(generatedIcns, path.join(macDir, 'icon.icns'));
      console.log('  [OK] Moved icon.icns to mac/');
    }
    
    console.log('ICO/ICNS generation complete!\n');
  } catch (err) {
    console.error('  [ERROR] Failed to generate ICO/ICNS:', err.message);
  }
}

async function main() {
  try {
    await generatePNGs();
    await generateAppxAssets();
    await generateICOAndICNS();
    await renamePNGs();
    
    console.log('[SUCCESS] Icons rebuilt successfully!');
    console.log('\nGenerated files:');
    console.log('  - build/icons/win/icon.ico');
    console.log('  - build/icons/mac/icon.icns');
    console.log('  - build/icons/png/*.png (16x16 to 1024x1024)');
    console.log('  - build/icons/appx/*.png (Microsoft Store assets)');
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
