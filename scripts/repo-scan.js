#!/usr/bin/env node
/*
  Repository hygiene scanner
  - Scans for emoji policy violations (no emojis outside .md)
  - Scans for junk artifacts per denylist
  - Exits non-zero on violations
*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    staged: args.includes('--staged'),
    verbose: args.includes('--verbose'),
  };
}

const PROJECT_ROOT = process.cwd();

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output', 'coverage'
]);

// Ignore path prefixes relative to project root
const IGNORE_PREFIXES = [
  'electron/renderer/assets/',
  'playwright-report/',
  'test-results/',
];

const ALLOWLIST_DIRS = [
  'docs/',
  'build/icons/',
  'data/legacy-db-backups/',
  'web-bundles/',
  '.github/',
];

const JUNK_PATTERNS = [
  /(^|\/)playwright-report\//,
  /(^|\/)test-results\//,
  /(^|\/)bulk_export_.*\.zip$/,
  /(^|\/)exported-images-.*\.zip$/,
  /(^|\/)electron(-dev)?\.log$/,
  /(^|\/)debug\.log$/,
  /(^|\/)npm-debug\.log.*$/,
  /(^|\/)yarn-(debug|error)\.log.*$/,
];

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.mjs', '.cjs']);

function isUnderAllowlist(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWLIST_DIRS.some(prefix => normalized.startsWith(prefix));
}

function shouldIgnoreByPrefix(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  return IGNORE_PREFIXES.some(prefix => norm.startsWith(prefix));
}

function listFilesRecursive(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const relDir = path.relative(PROJECT_ROOT, fullPath);
      if (shouldIgnoreByPrefix(relDir + '/')) continue;
      results.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      const rel = path.relative(PROJECT_ROOT, fullPath);
      if (shouldIgnoreByPrefix(rel)) continue;
      results.push(rel);
    }
  }
  return results;
}

function getStagedFiles() {
  try {
    // Include status to filter out deletions (D)
    const out = execSync('git diff --cached --name-status', { encoding: 'utf8' });
    const lines = out.split('\n').map(s => s.trim()).filter(Boolean);
    const files = [];
    for (const line of lines) {
      // Format: "A\tpath" or "M\tpath" or "D\tpath"
      const [status, ...rest] = line.split(/\s+/);
      const file = rest.join(' ').trim();
      if (!file) continue;
      // Skip deletions
      if (status === 'D') continue;
      files.push(file);
    }
    return files;
  } catch (_) {
    return [];
  }
}

// Emoji detection: prefer Unicode property escapes; fallback to wide ranges
// Exclude trademark symbols (™ \u2122, © \u00A9, ® \u00AE) as they are legitimate branding symbols
function hasEmoji(text) {
  // First remove trademark symbols to check for actual emojis
  const trademarkSymbols = /[\u2122\u00A9\u00AE]/g;
  const textWithoutTrademarks = text.replace(trademarkSymbols, '');
  
  try {
    const reProp = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;
    return reProp.test(textWithoutTrademarks);
  } catch (_) {
    // Exclude trademark symbols from emoji ranges
    const reRange = /[\u203C-\u211F\u2120-\u2121\u2123-\u3299\u2194-\u21AA\u231A-\u27BF\u2B05-\u2B55\u1F000-\u1FAFF]/;
    return reRange.test(textWithoutTrademarks);
  }
}

function scanEmoji(files) {
  const violations = [];
  for (const rel of files) {
    if (isUnderAllowlist(rel)) continue; // allowlisted dirs (e.g. .github/, docs/)
    const ext = path.extname(rel).toLowerCase();
    if (ext === '.md') continue; // allowed
    // Only scan code-like files to avoid huge binaries
    if (!CODE_EXTENSIONS.has(ext)) continue;
    const abs = path.join(PROJECT_ROOT, rel);
    try {
      const content = fs.readFileSync(abs, 'utf8');
      if (hasEmoji(content)) {
        violations.push(rel);
      }
    } catch (_) {
      // ignore unreadable files
    }
  }
  return violations;
}

function scanJunk(files) {
  const matches = [];
  for (const rel of files) {
    if (isUnderAllowlist(rel)) continue;
    const norm = rel.replace(/\\/g, '/');
    if (JUNK_PATTERNS.some(re => re.test(norm))) {
      matches.push(rel);
    }
  }
  return matches;
}

function main() {
  const { staged, verbose } = parseArgs();
  let files = [];
  if (staged) {
    files = getStagedFiles();
  } else {
    files = listFilesRecursive(PROJECT_ROOT);
  }

  if (verbose) {
    console.log(`[repo-scan] Scanning ${files.length} file(s)`);
  }

  const emojiViolations = scanEmoji(files);
  const junkMatches = scanJunk(files);

  let hasErrors = false;
  if (emojiViolations.length > 0) {
    hasErrors = true;
    console.error('\n[ERROR] Emoji policy violations in non-MD files:');
    emojiViolations.forEach(f => console.error(` - ${f}`));
  }

  if (junkMatches.length > 0) {
    hasErrors = true;
    console.error('\n[ERROR] Junk artifacts detected:');
    junkMatches.forEach(f => console.error(` - ${f}`));
    console.error('\nTip: run "npm run repo:clean" to remove known junk safely.');
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('[OK] repo-scan found no issues.');
  }
}

main();


