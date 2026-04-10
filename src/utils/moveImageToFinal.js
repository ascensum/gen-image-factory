/**
 * moveImageToFinal - Ported from legacy jobRunner.moveImageToFinalLocation.
 *
 * Resolves output directory (with fallback to Desktop/Documents),
 * moves file via rename (with copy+unlink fallback), verifies result.
 *
 * Stateful: caches `_finalOutputDirectory` on the `state` object across calls
 * within a single job so the directory is resolved only once.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * @param {string} processedImagePath - Source file to move
 * @param {string} imageMappingId - Used to prefix the final filename
 * @param {Object} config - Job config (needs config.filePaths.outputDirectory)
 * @param {Object} state - Mutable state object to cache finalOutputDirectory
 * @returns {Promise<string|null>} Final path, or null on failure
 */
async function moveImageToFinal(processedImagePath, imageMappingId, config, state = {}) {
  try {
    if (!state._finalOutputDirectory) {
      let lockedDir = config.filePaths?.outputDirectory;
      if (!lockedDir || String(lockedDir).trim() === '') {
        try {
          const { app } = require('electron');
          lockedDir = path.join(app.getPath('desktop'), 'gen-image-factory', 'pictures', 'toupload');
        } catch {
          const os = require('os');
          lockedDir = path.join(os.homedir(), 'Documents', 'gen-image-factory', 'pictures', 'toupload');
        }
      }
      await fs.mkdir(lockedDir, { recursive: true });
      state._finalOutputDirectory = lockedDir;
    }

    const finalDir = state._finalOutputDirectory;
    const originalFilename = path.basename(processedImagePath);
    const finalFilename = `${imageMappingId}_${originalFilename}`;
    const finalImagePath = path.join(finalDir, finalFilename);

    let moved = false;
    try {
      await fs.rename(processedImagePath, finalImagePath);
      moved = true;
    } catch {
      try {
        await fs.copyFile(processedImagePath, finalImagePath);
        await fs.unlink(processedImagePath);
        moved = true;
      } catch { moved = false; }
    }

    const finalExists = (() => { try { fsSync.accessSync(finalImagePath); return true; } catch { return false; } })();
    if (!moved || !finalExists) throw new Error('Final image not present after move');

    return finalImagePath;
  } catch {
    return null;
  }
}

module.exports = { moveImageToFinal };
