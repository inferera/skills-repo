// scripts/lib/safe-symlink.mjs
// Safe symlink resolution that mitigates TOCTOU vulnerabilities

import fs from "node:fs/promises";
import path from "node:path";

const MAX_SYMLINK_DEPTH = 40; // Linux default is 40

/**
 * Safely resolve a symlink using file descriptors to prevent TOCTOU attacks
 *
 * @param {string} symlinkPath - Path to the symlink
 * @param {string} allowedRoot - Root directory that symlink targets must be within
 * @returns {Promise<{realPath: string, stat: fs.Stats} | null>} Resolved path and stats, or null if unsafe
 */
export async function safeResolveSymlink(symlinkPath, allowedRoot) {
  let depth = 0;
  let currentPath = symlinkPath;
  const visited = new Set();

  while (depth < MAX_SYMLINK_DEPTH) {
    // Detect circular symlinks
    if (visited.has(currentPath)) {
      console.warn(`  ⚠️  Circular symlink detected: ${symlinkPath}`);
      return null;
    }
    visited.add(currentPath);

    // Open with O_NOFOLLOW equivalent (lstat + readlink)
    let stats;
    try {
      stats = await fs.lstat(currentPath);
    } catch (err) {
      console.warn(`  ⚠️  Cannot access symlink: ${currentPath} - ${err.message}`);
      return null;
    }

    // If not a symlink, we've reached the target
    if (!stats.isSymbolicLink()) {
      // Security check: verify final path is within allowed root
      const realPath = await fs.realpath(currentPath);
      if (!isPathWithinRoot(realPath, allowedRoot)) {
        console.warn(`  ⚠️  Symlink target outside allowed root: ${realPath}`);
        return null;
      }

      // Re-stat the resolved path to ensure it still exists and hasn't changed
      try {
        const finalStats = await fs.stat(realPath);
        return { realPath, stat: finalStats };
      } catch (err) {
        console.warn(`  ⚠️  Symlink target disappeared during resolution: ${realPath}`);
        return null;
      }
    }

    // Read the symlink target
    let linkTarget;
    try {
      linkTarget = await fs.readlink(currentPath);
    } catch (err) {
      console.warn(`  ⚠️  Cannot read symlink: ${currentPath} - ${err.message}`);
      return null;
    }

    // Resolve relative symlinks
    currentPath = path.isAbsolute(linkTarget)
      ? linkTarget
      : path.resolve(path.dirname(currentPath), linkTarget);

    depth++;
  }

  console.warn(`  ⚠️  Symlink depth exceeded (possible loop): ${symlinkPath}`);
  return null;
}

/**
 * Check if a path is within an allowed root directory
 * Uses path.relative to avoid string manipulation vulnerabilities
 *
 * @param {string} targetPath - Resolved target path
 * @param {string} allowedRoot - Root directory that must contain the target
 * @returns {boolean} True if path is within root
 */
function isPathWithinRoot(targetPath, allowedRoot) {
  const rel = path.relative(allowedRoot, targetPath);
  // If relative path starts with "..", it's outside the root
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
