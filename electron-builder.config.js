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
  process.env.MS_STORE_IDENTITY_NAME && 
  process.env.MS_STORE_PUBLISHER_ID && 
  process.env.MS_STORE_PUBLISHER_ID.startsWith('CN=');

const config = {
  appId: 'com.genimage.factory',
  productName: 'GenImageFactory',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  asar: true,
  files: [
    'electron/**/*',
    'src/**/*',
    '!src/database/transactionManager.js',
    '!src/database/backupManager.js',
    '!src/database/migrations/**/*',
    'package.json'
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
    target: isStoreBuild ? ['appx'] : ['nsis']
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
    identityName: process.env.MS_STORE_IDENTITY_NAME || 'ShiftlineTools.GenImageFactory',
    publisher: process.env.MS_STORE_PUBLISHER_ID || 'CN=ShiftlineTools',
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || 'Shiftline Tools™'
  },
  publish: {
    provider: 'github',
    owner: 'ShiftlineTools',
    repo: 'gen-image-factory'
  }
};

module.exports = config;
