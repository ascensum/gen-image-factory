#!/usr/bin/env node

/**
 * Privacy Firewall Validation Script
 * 
 * Validates that public_docs/ does not contain any internal project information:
 * - No references to story numbers
 * - No references to PRD documents
 * - No references to internal architecture decisions
 * - No internal development notes
 */

const fs = require('fs').promises;
const path = require('path');

// Patterns that indicate internal information
const FORBIDDEN_PATTERNS = [
  // Story references
  /story\s*\d+\.\d+/i,
  /story\s*[12]\.[\d]+/i,
  /docs\/stories\//i,
  
  // PRD references
  /docs\/prd\//i,
  /product\s*requirements/i,
  /prd\s*document/i,
  
  // Architecture references (internal)
  /docs\/architecture\//i,
  /internal\s*architecture/i,
  /architecture\s*decision/i,
  
  // Internal component specs
  /docs\/dashboard-components\//i,
  /docs\/job-management-components\//i,
  /docs\/qc-workflow-components\//i,
  /docs\/settings-components\//i,
  
  // Development notes
  /TODO/i,
  /FIXME/i,
  /internal\s*note/i,
  /dev\s*note/i,
  
  // Testing logs
  /test.*log/i,
  /coverage.*report/i,
];

// Directories that should never appear in public_docs
const FORBIDDEN_DIRECTORIES = [
  'prd',
  'stories',
  'architecture',
  'dashboard-components',
  'job-management-components',
  'qc-workflow-components',
  'settings-components',
];

async function validatePublicDocs() {
  const publicDocsPath = path.join(__dirname, '..', 'public_docs');
  
  try {
    // Check if public_docs exists
    await fs.access(publicDocsPath);
  } catch (_error) {
    console.error('[ERROR] public_docs/ directory does not exist');
    process.exit(1);
  }

  let hasErrors = false;
  const errors = [];

  // Recursively read all files in public_docs
  async function checkDirectory(dirPath, relativePath = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFilePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Check for forbidden directory names
        if (FORBIDDEN_DIRECTORIES.includes(entry.name.toLowerCase())) {
          errors.push(`[ERROR] Forbidden directory found: ${relativeFilePath}/`);
          hasErrors = true;
        }
        await checkDirectory(fullPath, relativeFilePath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check file content
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          
          for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(content)) {
              const match = content.match(pattern);
              errors.push(`[ERROR] Forbidden pattern found in ${relativeFilePath}: "${match[0]}"`);
              hasErrors = true;
            }
          }
        } catch (error) {
          errors.push(`[WARNING] Could not read file ${relativeFilePath}: ${error.message}`);
        }
      }
    }
  }

  await checkDirectory(publicDocsPath);

  if (hasErrors) {
        console.error('\n[ERROR] Privacy Firewall Validation Failed\n');
    errors.forEach(error => console.error(error));
    console.error('\nPlease remove all internal references from public_docs/');
    process.exit(1);
  } else {
    console.log('[SUCCESS] Privacy Firewall Validation Passed');
    console.log('   All content in public_docs/ is safe for public consumption');
  }
}

// Run validation
validatePublicDocs().catch(error => {
  console.error('Validation script error:', error);
  process.exit(1);
});

