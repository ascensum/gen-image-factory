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
  productName: 'Gen Image Factory',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  asar: true,
  files: [
    'electron/**/*',
    'package.json'
  ],
  mac: {
    icon: 'build/icons/mac/icon.icns',
    category: 'public.app-category.graphics-design',
    target: ['dmg', 'zip']
  },
  win: {
    icon: 'build/icons/win/icon.ico',
    // Conditionally include APPX target only when Store requirements are met
    target: isStoreBuild ? ['appx', 'nsis'] : ['nsis']
  },
  linux: {
    icon: 'build/icons/png',
    category: 'Graphics',
    target: ['AppImage', 'deb']
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  publish: {
    provider: 'github',
    owner: 'ascensum',
    repo: 'gen-image-factory'
  }
};

// Only include appx config if Store build is enabled
if (isStoreBuild) {
  config.appx = {
    identityName: process.env.MS_STORE_IDENTITY_NAME,
    publisher: process.env.MS_STORE_PUBLISHER_ID,
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || 'Shiftline Tools'
  };
}

module.exports = config;
