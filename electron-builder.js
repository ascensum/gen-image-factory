/**
 * Electron Builder Configuration
 */

// Only try to load dotenv if we are NOT in CI and the package exists
if (!process.env.CI) {
  try {
    require('dotenv').config();
  } catch (_e) {
    // dotenv not found, skipping local env load
  }
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
    // We use MSIX for Store and NSIS for GitHub Releases
    target: ['msix', 'nsis'], 
    publisherName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || undefined
  },
  linux: {
    icon: 'build/icons/png',
    category: 'Graphics',
    target: ['AppImage', 'deb']
  },
  publish: {
    provider: 'github',
    owner: 'ascensum',
    repo: 'gen-image-factory'
  }
};

// Inject Microsoft Store identity if variables are present
if (process.env.MS_STORE_IDENTITY_NAME && process.env.MS_STORE_PUBLISHER_ID) {
  baseConfig.msix = {
    identityName: process.env.MS_STORE_IDENTITY_NAME,
    publisher: process.env.MS_STORE_PUBLISHER_ID,
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || 'Shiftline Tools',
    installLocation: 'Custom',
    allowElevation: true
  };
}

module.exports = baseConfig;
