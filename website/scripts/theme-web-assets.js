const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  processA: {
    source: path.join(__dirname, '../../src/renderer/assets/logo-square.svg'),
    outputs: [
      path.join(__dirname, '../static/img/logo.svg'),      // Desktop Navbar Logo
      path.join(__dirname, '../../src/renderer/assets/logo-zen.svg') // GitHub README Logo
    ]
  },
  processB: {
    source: path.join(__dirname, '../../src/renderer/assets/favicon/favicon.svg'),
    outputs: [
      path.join(__dirname, '../static/img/favicon.svg')    // Browser Tab & Mobile Icon
    ]
  }
};

// Zen Palette
const colorMap = [
  // Silver (Frame): #E2E8F0 (replaces Blue #2563eb)
  { search: /rgb\(\s*37\s*,\s*99\s*,\s*235\s*\)/g, replace: '#E2E8F0' },
  { search: /#2563eb/gi, replace: '#E2E8F0' },
  
  // Cyan (Action): #00ADB5 (replaces Green #16a34a)
  { search: /rgb\(\s*22\s*,\s*163\s*,\s*74\s*\)/g, replace: '#00ADB5' },
  { search: /#16a34a/gi, replace: '#00ADB5' }
];

function transformAndSave(processName, sourcePath, outputPaths) {
  console.log(`\n[INFO] Starting ${processName}...`);
  
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  let content = fs.readFileSync(sourcePath, 'utf8');
  let originalContent = content;

  // Perform Replacements
  colorMap.forEach(map => {
    content = content.replace(map.search, map.replace);
  });

  if (content === originalContent) {
    console.warn(`[WARN] No colors were replaced in ${path.basename(sourcePath)}. Check source hex/rgb codes.`);
  }

  // Ensure directories exist and write files
  outputPaths.forEach(outFile => {
    const dir = path.dirname(outFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[INFO] Created directory: ${dir}`);
    }
    fs.writeFileSync(outFile, content, 'utf8');
    console.log(`[SUCCESS] Generated: ${outFile}`);
  });
}

// Execution
try {
  console.log('[INFO] Starting Zen Industrial Branding Automation...');

  // Process A: Factory Logo
  transformAndSave('Process A (Factory Logo)', config.processA.source, config.processA.outputs);

  // Process B: G Icon
  transformAndSave('Process B (G Icon)', config.processB.source, config.processB.outputs);

  console.log('\n[SUCCESS] Zen Industrial Branding Applied Successfully!');
  
} catch (error) {
  console.error('[ERROR] Error:', error.message);
  process.exit(1);
}