/**
 * Electron Builder Configuration
 * Cleaned for v26 Schema Compatibility
 */

// Safe load for dotenv
if (!process.env.CI) {
  try { require('dotenv').config(); } catch (_e) {}
}

module.exports = {
  appId: 'com.genimage.factory',
  productName: 'Gen Image Factory',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  asar: true,
  files: [
    'electron/**/*',
    'package.json',
    'dist/renderer/**/*' 
  ],
  mac: {
    icon: 'build/icons/mac/icon.icns',
    category: 'public.app-category.graphics-design',
    target: ['dmg', 'zip']
  },
  win: {
    icon: 'build/icons/win/icon.ico',
    // DO NOT add publisherName here, it's invalid in v26
    target: ['appx', 'nsis'] 
  },
  linux: {
    icon: 'build/icons/png',
    category: 'Graphics',
    target: ['AppImage', 'deb']
  },
  // 'appx' is the ONLY valid key for Microsoft Store settings in the schema
  appx: {
    identityName: process.env.MS_STORE_IDENTITY_NAME || undefined,
    publisher: process.env.MS_STORE_PUBLISHER_ID || undefined,
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || 'Shiftline Tools'
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
