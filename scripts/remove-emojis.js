#!/usr/bin/env node
/*
  Remove emojis from source files (non-MD)
  - Default: dry-run (shows files and counts)
  - Use --write to apply changes
  - Respects ignore prefixes similar to repo-scan
*/

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();

const IGNORED_DIRS = new Set(['node_modules', '.git']);
const IGNORE_PREFIXES = [
  'electron/renderer/assets/',
  'playwright-report/',
  'test-results/',
  'build/',
  'dist/',
  'coverage/',
];

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.mjs', '.cjs']);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    verbose: args.includes('--verbose'),
  };
}

function shouldIgnoreByPrefix(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  return IGNORE_PREFIXES.some(prefix => norm.startsWith(prefix));
}

function listFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(PROJECT_ROOT, full);
    if (entry.isDirectory()) {
      if (shouldIgnoreByPrefix(rel + '/')) continue;
      out.push(...listFiles(full));
    } else if (entry.isFile()) {
      if (shouldIgnoreByPrefix(rel)) continue;
      out.push(rel);
    }
  }
  return out;
}

function hasEmoji(text) {
  try {
    const reProp = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;
    return reProp.test(text);
  } catch (_) {
    const reRange = /[\u203C-\u3299\u2122\u00A9\u00AE\u2194-\u21AA\u231A-\u27BF\u2B05-\u2B55\u1F000-\u1FAFF]/;
    return reRange.test(text);
  }
}

function stripEmojis(text) {
  try {
    const re = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
    return text.replace(re, '');
  } catch (_) {
    const re = /[\u203C-\u3299\u2122\u00A9\u00AE\u2194-\u21AA\u231A-\u27BF\u2B05-\u2B55\u1F000-\u1FAFF]/g;
    return text.replace(re, '');
  }
}

function main() {
  const { write, verbose } = parseArgs();
  const files = listFiles(PROJECT_ROOT);
  const targets = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.md') return false;
    if (!CODE_EXTENSIONS.has(ext)) return false;
    return true;
  });

  let changed = 0;
  let scanned = 0;
  const modified = [];

  for (const rel of targets) {
    scanned++;
    const abs = path.join(PROJECT_ROOT, rel);
    try {
      const content = fs.readFileSync(abs, 'utf8');
      if (!hasEmoji(content)) continue;
      const cleaned = stripEmojis(content);
      if (content !== cleaned) {
        if (write) {
          fs.writeFileSync(abs, cleaned, 'utf8');
        }
        changed++;
        modified.push(rel);
        if (verbose) console.log(`[remove-emojis] ${write ? 'updated' : 'would update'} ${rel}`);
      }
    } catch (_) {
      // ignore
    }
  }

  if (write) {
    console.log(`[OK] Removed emojis from ${changed} file(s) (scanned ${scanned}).`);
  } else {
    if (changed > 0) {
      console.log(`[DRY-RUN] Would update ${changed} file(s):`);
      modified.forEach(f => console.log(` - ${f}`));
      process.exit(1);
    } else {
      console.log('[OK] No emojis found in code files.');
    }
  }
}

main();


