#!/usr/bin/env node

/**
 * Validate Microsoft Store Identity Configuration
 * 
 * This script validates that package.json Store identity values match
 * the expected values (which should be stored in GitHub secrets).
 * 
 * Usage:
 *   node scripts/validate-store-identity.js
 * 
 * This is useful for CI/CD validation to ensure package.json matches
 * the configured secrets.
 */

const fs = require('fs');
const path = require('path');

// Expected values from GitHub secrets (required)
// These must be set as environment variables (from GitHub secrets in CI/CD)
const EXPECTED_VALUES = {
  identityName: process.env.MS_STORE_IDENTITY_NAME,
  publisher: process.env.MS_STORE_PUBLISHER_ID,
  publisherDisplayName: process.env.MS_STORE_PUBLISHER_DISPLAY_NAME
};

function validateStoreIdentity() {
  // Check that required secrets are set
  const missingSecrets = [];
  if (!EXPECTED_VALUES.identityName) missingSecrets.push('MS_STORE_IDENTITY_NAME');
  if (!EXPECTED_VALUES.publisher) missingSecrets.push('MS_STORE_PUBLISHER_ID');
  if (!EXPECTED_VALUES.publisherDisplayName) missingSecrets.push('MS_STORE_PUBLISHER_DISPLAY_NAME');
  
  if (missingSecrets.length > 0) {
    console.error('ERROR: Required environment variables (GitHub secrets) not set:');
    missingSecrets.forEach(secret => console.error(`  - ${secret}`));
    console.error('\nSet these as GitHub secrets or environment variables before running validation.');
    process.exit(1);
  }
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error('ERROR: package.json not found');
    process.exit(1);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const appxConfig = packageJson?.build?.appx;
  
  if (!appxConfig) {
    console.error('ERROR: package.json build.appx configuration not found');
    process.exit(1);
  }
  
  const errors = [];
  const warnings = [];
  
  // Validate identityName
  if (appxConfig.identityName !== EXPECTED_VALUES.identityName) {
    errors.push(`identityName mismatch: expected "${EXPECTED_VALUES.identityName}", got "${appxConfig.identityName}"`);
  }
  
  // Validate publisher
  if (appxConfig.publisher !== EXPECTED_VALUES.publisher) {
    errors.push(`publisher mismatch: expected "${EXPECTED_VALUES.publisher}", got "${appxConfig.publisher}"`);
  }
  
  // Validate publisherDisplayName
  if (appxConfig.publisherDisplayName !== EXPECTED_VALUES.publisherDisplayName) {
    warnings.push(`publisherDisplayName mismatch: expected "${EXPECTED_VALUES.publisherDisplayName}", got "${appxConfig.publisherDisplayName}"`);
  }
  
  // Report results
  if (errors.length > 0) {
    console.error('[ERROR] Store Identity Validation Failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('[WARNING] Store Identity Validation Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('[SUCCESS] Store Identity Validation Passed');
    console.log(`   Identity Name: ${appxConfig.identityName}`);
    console.log(`   Publisher: ${appxConfig.publisher}`);
    console.log(`   Publisher Display Name: ${appxConfig.publisherDisplayName}`);
  }
}

validateStoreIdentity();
