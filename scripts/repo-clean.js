#!/usr/bin/env node
/*
  Repository cleaner
  - Removes known junk artifacts with allowlist protection
  - Dry-run by default; pass --yes to actually delete
*/

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();

const ALLOWLIST_DIRS = [
  'docs/',
  'build/icons/',
  'data/legacy-db-backups/',
  'web-bundles/',
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

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    yes: args.includes('--yes'),
    verbose: args.includes('--verbose'),
  };
}

function walk(dir, out, ignored = new Set(['node_modules', '.git'])) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out, ignored);
    } else if (entry.isFile()) {
      out.push(path.relative(PROJECT_ROOT, full));
    }
  }
}

function isUnderAllowlist(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWLIST_DIRS.some(prefix => normalized.startsWith(prefix));
}

function matchJunk(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (isUnderAllowlist(norm)) return false;
  return JUNK_PATTERNS.some(re => re.test(norm));
}

function removeFile(relPath, opts) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (opts.verbose) console.log(`[repo-clean] removing ${relPath}`);
  try {
    fs.rmSync(abs, { force: true, recursive: false });
    return true;
  } catch (err) {
    console.error(`[repo-clean] failed to remove ${relPath}: ${err.message}`);
    return false;
  }
}

function main() {
  const opts = parseArgs();
  const files = [];
  walk(PROJECT_ROOT, files);
  const junk = files.filter(matchJunk);

  if (junk.length === 0) {
    console.log('[OK] No junk artifacts found.');
    return;
  }

  console.log('[INFO] Junk artifacts detected:');
  junk.forEach(f => console.log(` - ${f}`));

  if (!opts.yes) {
    console.log('\n[DRY-RUN] Pass --yes to actually remove these files.');
    process.exit(1);
  }

  let removed = 0;
  for (const rel of junk) {
    if (removeFile(rel, opts)) removed++;
  }

  console.log(`[OK] Removed ${removed}/${junk.length} artifacts.`);
}

main();


