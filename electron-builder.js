/**
 * Electron Builder Configuration
 * 
 * This file provides the electron-builder configuration with support for
 * environment variable injection for sensitive values (Microsoft Store identity).
 * 
 * For local development, create a .env file with:
 *   MS_STORE_IDENTITY_NAME=...
 *   MS_STORE_PUBLISHER_ID=...
 *   MS_STORE_PUBLISHER_DISPLAY_NAME=...
 * 
 * For CI/CD, these values come from GitHub Secrets.
 */

// Load .env file for local development (if not in CI)
if (!process.env.CI && require('fs').existsSync('.env')) {
  require('dotenv').config();
}

const baseConfig = {
  appId: 'com.genimage.factory',
  productName: 'Gen Image Factory',
  directories: {
    output: 'dist', // MUST BE EXPLICIT
    buildResources: 'build'
  },
  // Enable asar packaging to compress files
  asar: true,
  // Include necessary files (electron-builder automatically includes node_modules from dependencies)
  files: [
    'electron/**/*',
    'package.json'
  ],
  // Exclude unnecessary files to reduce bundle size
  // Note: These exclusions apply to files within the included directories
  // electron-builder will still include production node_modules automatically
  mac: {
    icon: 'build/icons/mac/icon.icns',
    category: 'public.app-category.graphics-design',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ]
  },
  win: {
    icon: 'build/icons/win/icon.ico',
    target: ['appx', 'nsis'], // Ensure appx (MSIX) is here for the store, nsis for GitHub releases
    publisherName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME || undefined
  },
  appx: {},
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false
  },
  linux: {
    icon: 'build/icons/png',
    category: 'Graphics',
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      }
    ],
    desktop: {
      entry: {
        Name: 'Gen Image Factory',
        Comment: 'AI-powered image generation application',
        Categories: 'Graphics;'
      }
    }
  },
  publish: {
    provider: 'github',
    owner: 'ascensum',
    repo: 'gen-image-factory'
  }
};

// Inject Microsoft Store identity from environment variables
if (process.env.MS_STORE_IDENTITY_NAME && process.env.MS_STORE_PUBLISHER_ID && process.env.MS_STORE_PUBLISHER_DISPLAY_NAME) {
  baseConfig.appx = {
    identityName: process.env.MS_STORE_IDENTITY_NAME,
    publisher: process.env.MS_STORE_PUBLISHER_ID,
    publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME
  };
} else if (process.platform === 'win32' || process.env.CI) {
  // Only warn if building for Windows or in CI
  console.warn('[WARNING] Microsoft Store identity environment variables not set. MSIX build may fail.');
  console.warn('Required: MS_STORE_IDENTITY_NAME, MS_STORE_PUBLISHER_ID, MS_STORE_PUBLISHER_DISPLAY_NAME');
}

module.exports = baseConfig;
