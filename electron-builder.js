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
    output: 'dist'
  },
  // Enable asar packaging to compress files
  asar: true,
  // Only include necessary files (electron-builder automatically includes node_modules from dependencies)
  files: [
    'electron/main.js',
    'electron/preload.js',
    'electron/renderer/**/*',
    'package.json',
    '!**/node_modules/**/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/**/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/**/*.d.ts',
    '!**/node_modules/**/*.map',
    '!**/node_modules/**/.{bin,hg,svn,git}',
    '!**/node_modules/**/{.nyc_output,coverage,.nyc_output}',
    '!**/node_modules/**/*.{md,ts,tsx,jsx}',
    '!**/node_modules/**/.{eslint,prettier,jest,ava}rc*',
    '!**/node_modules/**/.{travis,appveyor}.yml',
    '!**/node_modules/**/.{yarn,npm}.lock',
    '!**/node_modules/**/package-lock.json',
    '!**/node_modules/**/yarn.lock'
  ],
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
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32']
      },
      {
        target: 'portable',
        arch: ['x64', 'ia32']
      },
      {
        target: 'appx',
        arch: ['x64']
      }
    ]
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
