#!/usr/bin/env node

/**
 * Fetch Latest Version from GitHub Releases
 * 
 * This script fetches the latest release version from GitHub and caches it
 * for use in docusaurus.config.js. This ensures the website always shows
 * the latest GitHub release version automatically.
 * 
 * Usage:
 *   node website/scripts/fetch-version.js
 * 
 * This is typically run as part of the build process or pre-build hook.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Sanitize strings for safe logging (prevent log injection)
// Removes all control characters, newlines, and other dangerous characters
function sanitizeForLog(input) {
  if (typeof input !== 'string') {
    return String(input);
  }
  // Remove all control characters (0x00-0x1F, 0x7F-0x9F), newlines, carriage returns
  // Also remove backspaces, form feeds, and other potentially dangerous characters
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\n\r\b\f\t\v]/g, '')
    .replace(/\\/g, '') // Remove backslashes to prevent escape sequence injection
    .substring(0, 1000);
}

const GITHUB_OWNER = 'ShiftlineTools';
const GITHUB_REPO = 'gen-image-factory';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const CACHE_FILE = path.join(__dirname, '../.version-cache.json');

function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    https.get(GITHUB_API, {
      headers: {
        'User-Agent': 'Gen-Image-Factory-Website',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const release = JSON.parse(data);
            // Extract version from tag (e.g., "v1.0.8" -> "1.0.8")
            const version = release.tag_name.replace(/^v/, '');
            resolve(version);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub response: ${error.message}`));
          }
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
  });
}

async function main() {
  try {
    console.log('Fetching latest version from GitHub Releases...');
    const version = await fetchLatestVersion();
    
    // Cache the version with timestamp
    const cache = {
      version: version,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    console.log(`Latest version: ${version}`);
    console.log(`Cached to: ${CACHE_FILE}`);
    
  } catch (error) {
    // Sanitize error message to prevent log injection
    const sanitizedMsg = sanitizeForLog(error.message);
    console.warn(`Warning: Could not fetch version from GitHub: ${sanitizedMsg}`);
    console.warn('   Falling back to package.json version in docusaurus.config.js');
    process.exit(0); // Don't fail the build, just use fallback
  }
}

main();

