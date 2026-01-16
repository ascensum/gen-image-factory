const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function checkTransparency(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[MISSING] ${filePath}`);
    return;
  }

  try {
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    
    // Check corners (0,0), (w-1, 0), (0, h-1), (w-1, h-1)
    const corners = [
      { x: 0, y: 0 },
      { x: info.width - 1, y: 0 },
      { x: 0, y: info.height - 1 },
      { x: info.width - 1, y: info.height - 1 }
    ];

    let hasNonTransparent = false;
    let nonTransparentPixel = null;

    for (const corner of corners) {
      const idx = (corner.y * info.width + corner.x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = info.channels === 4 ? data[idx + 3] : 255;

      if (a !== 0) {
        hasNonTransparent = true;
        nonTransparentPixel = `rgba(${r},${g},${b},${a})`;
        break;
      }
    }

    if (hasNonTransparent) {
      console.log(`[FAIL] ${path.basename(filePath)} has non-transparent corners! (e.g., ${nonTransparentPixel})`);
      
      // Also check center to verify image exists
      const cx = Math.floor(info.width / 2);
      const cy = Math.floor(info.height / 2);
      const idx = (cy * info.width + cx) * info.channels;
      const a = info.channels === 4 ? data[idx + 3] : 255;
      console.log(`       Center pixel alpha: ${a}`);

    } else {
      console.log(`[PASS] ${path.basename(filePath)} corners are fully transparent.`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  const appxDir = path.join(__dirname, '../build/appx');
  const filesToCheck = [
    'Square44x44Logo.targetsize-16_altform-unplated.png',
    'Square44x44Logo.targetsize-24_altform-unplated.png',
    // Check standard ones too just in case
    'Square44x44Logo.png',
    'StoreLogo.png'
  ];

  console.log('Checking AppX assets transparency...');
  for (const file of filesToCheck) {
    await checkTransparency(path.join(appxDir, file));
  }
  
  // Note: Checking ICO bit depth specifically requires parsing the ICO header, 
  // which sharp doesn't do deeply. But we can infer from the PNGs generated for the ICO.
}

main();
