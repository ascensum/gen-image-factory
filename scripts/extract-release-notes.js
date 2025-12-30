#!/usr/bin/env node

/**
 * Extract Release Notes for Microsoft Store Submission
 * 
 * This script extracts release notes from a GitHub Release and formats them
 * for easy copy-paste into Microsoft Partner Center's "What's New" field.
 * 
 * Usage:
 *   node scripts/extract-release-notes.js <version>
 *   node scripts/extract-release-notes.js v1.0.9
 *   node scripts/extract-release-notes.js latest
 * 
 * The script will:
 * 1. Fetch release notes from GitHub API
 * 2. Format them for Microsoft Store (removes GitHub-specific formatting)
 * 3. Display them in console and optionally save to file
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Sanitize strings for safe logging (prevent log injection)
// Removes all control characters, newlines, and other dangerous characters
// Applies sanitization repeatedly to prevent bypasses
function sanitizeForLog(input) {
  if (typeof input !== 'string') {
    return String(input);
  }
  let sanitized = input;
  let previous;
  // Apply sanitization repeatedly until no more changes to prevent bypasses
  do {
    previous = sanitized;
    // Remove all control characters (0x00-0x1F, 0x7F-0x9F), newlines, carriage returns
    // Also remove backspaces, form feeds, and other potentially dangerous characters
    sanitized = sanitized
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F\n\r\b\f\t\v]/g, '')
      .replace(/\\/g, '') // Remove backslashes to prevent escape sequence injection
      .replace(/%0a/gi, '') // Remove URL-encoded newlines
      .replace(/%0d/gi, '') // Remove URL-encoded carriage returns
      .replace(/%0A/gi, '') // Remove URL-encoded newlines (uppercase)
      .replace(/%0D/gi, ''); // Remove URL-encoded carriage returns (uppercase)
  } while (sanitized !== previous);
  
  return sanitized.substring(0, 1000);
}

const GITHUB_OWNER = 'ShiftlineTools';
const GITHUB_REPO = 'gen-image-factory';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// Get version from command line args
const version = process.argv[2] || 'latest';

// Validate version input to prevent injection attacks
function validateVersion(version) {
  if (!version || version === 'latest') {
    return version;
  }
  // Allow only alphanumeric, dots, hyphens, and 'v' prefix (semantic versioning)
  if (!/^v?[\d.]+(-[\w.]+)?$/.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: v1.0.0 or 1.0.0`);
  }
  return version;
}

const validatedVersion = validateVersion(version);

function fetchRelease(version) {
  return new Promise((resolve, reject) => {
    // Sanitize version for URL to prevent injection
    const sanitizedVersion = version === 'latest' ? 'latest' : encodeURIComponent(version);
    const url = version === 'latest' 
      ? `${GITHUB_API}/latest`
      : `${GITHUB_API}/tags/${sanitizedVersion}`;
    
    // Sanitize URL for logging to prevent log injection
    const sanitizedUrl = sanitizeForLog(url);
    console.log(`Fetching release notes from: ${sanitizedUrl}`);
    
    https.get(url, {
      headers: {
        'User-Agent': 'Gen-Image-Factory-Release-Notes-Extractor',
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
            resolve(release);
          } catch (error) {
            const sanitizedMsg = sanitizeForLog(error.message);
            reject(new Error(`Failed to parse response: ${sanitizedMsg}`));
          }
        } else if (res.statusCode === 404) {
          // Sanitize version for error message to prevent log injection
          const sanitizedVersionForError = sanitizeForLog(version);
          reject(new Error(`Release not found: ${sanitizedVersionForError}`));
        } else {
          // Sanitize response data to prevent injection
          const sanitizedData = sanitizeForLog(data.substring(0, 200));
          reject(new Error(`GitHub API error: ${res.statusCode} - ${sanitizedData}`));
        }
      });
    }).on('error', (error) => {
      // Sanitize error message to prevent log injection
      const sanitizedMsg = sanitizeForLog(error.message);
      reject(new Error(`Network error: ${sanitizedMsg}`));
    });
  });
}

function formatForStore(releaseBody) {
  if (!releaseBody) {
    return 'No release notes available.';
  }
  
  // Remove HTML comments (like the one we added for GitHub auto-generation)
  // Apply replacement repeatedly until no more matches to prevent incomplete sanitization
  // This prevents bypasses like: <!<!-- comment --> which becomes <! after first pass
  let formatted = releaseBody;
  let previous;
  do {
    previous = formatted;
    formatted = formatted.replace(/<!--[\s\S]*?-->/g, '');
  } while (formatted !== previous);
  
  // Remove GitHub-specific markdown that might not render well in Store
  // Keep basic formatting (headers, lists, bold)
  
  // Convert GitHub markdown links to plain text (Store doesn't support markdown links)
  formatted = formatted.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove artifact/integrity sections (not relevant for Store users)
  formatted = formatted.replace(/###? Artifacts[\s\S]*?(?=###|$)/g, '');
  formatted = formatted.replace(/###? Integrity[\s\S]*?(?=###|$)/g, '');
  formatted = formatted.replace(/###? Installation[\s\S]*?(?=###|$)/g, '');
  
  // Clean up extra whitespace
  formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();
  
  return formatted;
}

async function main() {
  try {
    console.log(`\nExtracting release notes for: ${validatedVersion}\n`);
    
    const release = await fetchRelease(validatedVersion);
    
    console.log(`Found release: ${release.tag_name} (${release.name || release.tag_name})\n`);
    console.log('=' .repeat(80));
    console.log('RELEASE NOTES FOR MICROSOFT STORE:');
    console.log('=' .repeat(80));
    console.log();
    
    const storeFormatted = formatForStore(release.body);
    console.log(storeFormatted);
    
    console.log();
    console.log('=' .repeat(80));
    console.log();
    
    // Optionally save to file
    // Sanitize tag_name to prevent path traversal attacks
    const sanitizedTag = release.tag_name.replace(/^v/, '').replace(/[^a-zA-Z0-9.-]/g, '');
    if (!sanitizedTag || sanitizedTag.includes('..') || sanitizedTag.includes('/') || sanitizedTag.includes('\\')) {
      throw new Error('Invalid tag name detected - potential path traversal attack');
    }
    const outputFile = path.join(process.cwd(), `release-notes-${sanitizedTag}.txt`);
    // Ensure the resolved path is within the current working directory (prevent path traversal)
    const resolvedPath = path.resolve(outputFile);
    const cwd = path.resolve(process.cwd());
    if (!resolvedPath.startsWith(cwd)) {
      throw new Error('Path traversal detected - output file must be within current directory');
    }
    fs.writeFileSync(resolvedPath, storeFormatted, 'utf8');
    console.log(`Saved to: ${resolvedPath}`);
    console.log();
    console.log('Copy the text above and paste it into Microsoft Partner Center → "What\'s New" field');
    console.log();
    
  } catch (error) {
    // Sanitize error message to prevent log injection
    // Use separate arguments instead of template string interpolation for extra safety
    const sanitizedMsg = sanitizeForLog(error.message || 'Unknown error');
    console.error('Error:', sanitizedMsg);
    process.exit(1);
  }
}

main();

