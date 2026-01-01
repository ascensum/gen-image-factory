/**
 * Electron Builder Configuration
 */

// Safe load for dotenv
if (!process.env.CI) {
  try { require('dotenv').config(); } catch (_e) {}
}

const baseConfig = {
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
    // Removed 'publisherName' from here - it was causing the crash
    target: ['appx', 'nsis'] 
  },
  linux: {
    icon: 'build/icons/png',
    category: 'Graphics',
    target: ['AppImage', 'deb']
  },
  // Re-mapped to 'appx' which is the correct schema key
  appx: {
    identityName: process.env.MS_STORE_IDENTITY_NAME,
    publisher: process.env.MS_STORE_PUBLISHER_ID,
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || 'Shiftline Tools',
    installLocation: 'Custom',
    allowElevation: true
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

module.exports = baseConfig;
