/**
 * Electron Builder Configuration
 * Cleaned for v26 Schema Compatibility
 */

// Safe load for dotenv
if (!process.env.CI) {
  try { require('dotenv').config(); } catch (_e) {}
}

// Check if all Microsoft Store requirements are met
const isStoreBuild = 
  !!(process.env.MS_STORE_IDENTITY_NAME && 
  process.env.MS_STORE_PUBLISHER_ID);

const config = {
  appId: 'com.genimage.factory',
  productName: 'GenImageFactory',
  executableName: 'GenImageFactory',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  asar: true,
  asarUnpack: [
    '**/node_modules/keytar/**/*',     // SecurityService: OS credential store — permanent
    '**/node_modules/sqlite3/**/*',    // ADR-009 DB layer — REMOVE in Epic 5 (→ PGlite, no native binding)
    '**/node_modules/sharp/**/*'       // ImageProcessorService: pixel manipulation — permanent
    // NOTE (Epic 5): When sqlite3 → PGlite migration lands:
    //   1. Remove the sqlite3 asarUnpack entry above
    //   2. PGlite (.wasm) requires NO asarUnpack — it is pure JS+WASM
    //   3. Enable vendor-wasm manualChunk in Pillar 4 (vite.config.ts) to control WASM asset placement
  ],
  files: [
    // Electron main process
    'electron/**/*',
    // Backend source (electron/main.js requires ../src/... at runtime)
    'src/**/*',
    // Renderer bundle (Vite output)
    'electron/renderer/**/*',
    // Manifest
    'package.json',
    // Exclusions applied to everything matched above
    '!**/node_modules/*/{test,tests,testing,__tests__,spec,specs}/**/*',
    '!**/node_modules/*/{doc,docs,documentation,examples,example,samples}/**/*',
    '!**/node_modules/*/*.md',
    '!**/node_modules/*/*.map',
    '!**/node_modules/**/*.d.ts',
    '!**/node_modules/**/*.d.ts.map',
    '!**/node_modules/.bin/**/*',
    '!**/node_modules/.cache/**/*',
    '!**/*.tar.gz',
    '!src/**/*.ts',
    '!src/**/__tests__/**/*',
    '!src/**/*.test.*',
    '!**/coverage/**/*'
  ],
  mac: {
    icon: 'icons/mac/icon.icns',
    category: 'public.app-category.graphics-design',
    target: ['dmg', 'zip']
  },
  win: {
    icon: 'icons/win/icon.ico',
    // Target will be set dynamically via command line --win flag
    // APPX and NSIS are built separately to avoid certificate issues
    target: isStoreBuild ? ['appx'] : ['nsis'],
    verifyUpdateCodeSignature: false,
    signtoolOptions: {
      publisherName: process.env.MS_STORE_PUBLISHER_ID,
      timeStampServer: 'http://timestamp.digicert.com',
      signingHashAlgorithms: ['sha256']
    }
  },
  linux: {
    icon: 'icons/png',
    category: 'Graphics',
    target: ['AppImage', 'deb']
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  appx: {
    applicationId: 'GenImageFactory', // Must be alpha-numeric only (no periods)
    identityName: process.env.MS_STORE_IDENTITY_NAME,
    publisher: process.env.MS_STORE_PUBLISHER_ID,
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME,
    backgroundColor: 'transparent',
    displayName: process.env.MS_STORE_APP_DISPLAY_NAME
  },
  publish: {
    provider: 'github',
    owner: 'ShiftlineTools',
    repo: 'gen-image-factory'
  }
};

module.exports = config;
