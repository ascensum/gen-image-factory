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

const GITHUB_OWNER = 'ShiftlineTools';
const GITHUB_REPO = 'gen-image-factory';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// Get version from command line args
const version = process.argv[2] || 'latest';

if (!version) {
  console.error('Usage: node scripts/extract-release-notes.js <version|latest>');
  console.error('Example: node scripts/extract-release-notes.js v1.0.9');
  process.exit(1);
}

function fetchRelease(version) {
  return new Promise((resolve, reject) => {
    const url = version === 'latest' 
      ? `${GITHUB_API}/latest`
      : `${GITHUB_API}/tags/${version}`;
    
    console.log(`Fetching release notes from: ${url}`);
    
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
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else if (res.statusCode === 404) {
          reject(new Error(`Release not found: ${version}`));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });
  });
}

function formatForStore(releaseBody) {
  if (!releaseBody) {
    return 'No release notes available.';
  }
  
  // Remove HTML comments (like the one we added for GitHub auto-generation)
  let formatted = releaseBody.replace(/<!--[\s\S]*?-->/g, '');
  
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
    console.log(`\nExtracting release notes for: ${version}\n`);
    
    const release = await fetchRelease(version);
    
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
    const outputFile = path.join(process.cwd(), `release-notes-${release.tag_name.replace(/^v/, '')}.txt`);
    fs.writeFileSync(outputFile, storeFormatted, 'utf8');
    console.log(`Saved to: ${outputFile}`);
    console.log();
    console.log('Copy the text above and paste it into Microsoft Partner Center → "What\'s New" field');
    console.log();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

