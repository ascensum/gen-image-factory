#!/usr/bin/env node

/**
 * Icon Preview Script
 * 
 * Opens icons at their actual size in the default image viewer for visual inspection.
 * This helps verify how icons will appear in system tray/menu bar.
 * 
 * Usage:
 *   npm run preview-icons [size]
 *   npm run preview-icons 16
 *   npm run preview-icons 24
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const iconDir = path.join(__dirname, '../build/icons/png');

// Get size from command line or show all
const requestedSize = process.argv[2] ? parseInt(process.argv[2]) : null;

if (requestedSize && !iconSizes.includes(requestedSize)) {
  console.error(`Error: Size ${requestedSize} not available. Available sizes: ${iconSizes.join(', ')}`);
  process.exit(1);
}

const sizesToPreview = requestedSize ? [requestedSize] : [16, 24, 32, 48];

console.log('Icon Preview Tool');
console.log('=================');
console.log('This will open icons at their actual size to preview how they look.');
console.log('Compare the sizes to see which works best for system tray/menu bar.\n');

sizesToPreview.forEach(size => {
  const iconPath = path.join(iconDir, `${size}x${size}.png`);
  
  if (!fs.existsSync(iconPath)) {
    console.warn(`WARNING: ${size}x${size}.png not found, skipping...`);
    return;
  }
  
  console.log(`Opening ${size}x${size}.png...`);
  
  try {
    if (process.platform === 'darwin') {
      // macOS
      execSync(`open "${iconPath}"`, { stdio: 'inherit' });
    } else if (process.platform === 'win32') {
      // Windows
      execSync(`start "" "${iconPath}"`, { stdio: 'inherit' });
    } else {
      // Linux
      execSync(`xdg-open "${iconPath}"`, { stdio: 'inherit' });
    }
    
    // Small delay between opening multiple images
    if (sizesToPreview.length > 1) {
      execSync('sleep 0.5', { stdio: 'inherit' });
    }
  } catch (error) {
    console.error(`Failed to open ${iconPath}:`, error.message);
  }
});

console.log('\nTips:');
console.log('  - Compare the sizes side-by-side');
console.log('  - Consider which size is most visible and recognizable');
console.log('  - For macOS menu bar: 24x24 or 32x32 recommended');
console.log('  - For Windows system tray: 24x24 or 32x32 may be better than 16x16 on high-DPI displays');
console.log('\nTo preview a specific size: npm run preview-icons [size]');

