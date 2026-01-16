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
      const a = info.channels === 4 ? data[idx + 3] : 255;

      if (a !== 0) {
        hasNonTransparent = true;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        nonTransparentPixel = `rgba(${r},${g},${b},${a})`;
        break;
      }
    }

    if (hasNonTransparent) {
      console.log(`[FAIL] ${path.basename(filePath)} has non-transparent corners! (e.g., ${nonTransparentPixel})`);
    } else {
      console.log(`[PASS] ${path.basename(filePath)} corners are fully transparent.`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  const sourcePath = path.join(__dirname, '../build/icons/gen_image_factory_icon_tray_icon_1024x1024.png');
  console.log('Checking Source Asset transparency...');
  await checkTransparency(sourcePath);
}

main();
