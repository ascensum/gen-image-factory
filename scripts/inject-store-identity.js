#!/usr/bin/env node

/**
 * Inject Microsoft Store Identity into package.json
 * 
 * This script injects Store identity values from environment variables
 * into package.json for local builds.
 * 
 * Usage:
 *   MS_STORE_IDENTITY_NAME=... MS_STORE_PUBLISHER_ID=... MS_STORE_PUBLISHER_DISPLAY_NAME=... node scripts/inject-store-identity.js
 * 
 * Or set environment variables and run:
 *   node scripts/inject-store-identity.js
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Get values from environment variables
const identityName = process.env.MS_STORE_IDENTITY_NAME;
const publisher = process.env.MS_STORE_PUBLISHER_ID;
const publisherDisplayName = process.env.MS_STORE_PUBLISHER_DISPLAY_NAME;

// Check required values
if (!identityName || !publisher || !publisherDisplayName) {
  console.error('ERROR: Required environment variables not set:');
  if (!identityName) console.error('  - MS_STORE_IDENTITY_NAME');
  if (!publisher) console.error('  - MS_STORE_PUBLISHER_ID');
  if (!publisherDisplayName) console.error('  - MS_STORE_PUBLISHER_DISPLAY_NAME');
  console.error('\nSet these environment variables before running local builds.');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Inject values
packageJson.build.appx.identityName = identityName;
packageJson.build.appx.publisher = publisher;
packageJson.build.appx.publisherDisplayName = publisherDisplayName;

// Write back
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

console.log('[SUCCESS] Injected Store identity into package.json');
console.log(`   Identity Name: ${identityName}`);
console.log(`   Publisher: ${publisher}`);
console.log(`   Publisher Display Name: ${publisherDisplayName}`);
