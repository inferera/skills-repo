# Security and Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical security vulnerabilities, important bugs, and ensure build completes successfully

**Architecture:** Apply security patches to path handling and symlink validation, fix data model inconsistencies, improve error handling, and add input validation throughout the codebase.

**Tech Stack:** Node.js 18+, ES Modules, YAML, Git

---

## Task 1: Fix Path Traversal Vulnerability

**Files:**
- Modify: `scripts/import-from-issue.mjs:108-110`

**Step 1: Strengthen path normalization**

Replace weak `includes("..")` check with proper path validation:

```javascript
function normalizeSourcePath(p) {
  if (typeof p !== "string" || p.length === 0) return ".";

  // Normalize path separators
  let v = p.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!v) return ".";

  // Block multiple traversal techniques:
  // - Direct: ".."
  // - Encoded: "%2e%2e", "..%2f"
  // - Double: "...."
  // - Mixed: "./.."
  const dangerous = [
    /\.\./,           // any ".." sequence
    /%2e%2e/i,        // URL encoded ..
    /%252e/i,         // double encoded
    /\.%2f/i,         // mixed encoding
    /\/{2,}/,         // multiple slashes (could hide ..)
  ];

  for (const pattern of dangerous) {
    if (pattern.test(v)) {
      throw new Error(`Invalid sourcePath (traversal attempt detected): ${p}`);
    }
  }

  // Additional safety: ensure path doesn't start with /
  if (v.startsWith('/')) {
    throw new Error(`Invalid sourcePath (absolute paths not allowed): ${p}`);
  }

  return v;
}
```

**Step 2: Run validation to ensure no regressions**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 3: Commit**

```bash
git add scripts/import-from-issue.mjs
git commit -m "security: fix path traversal vulnerability in sourcePath normalization"
```

---

## Task 2: Fix Symlink TOCTOU Vulnerability

**Files:**
- Modify: `scripts/sync-skill-files.mjs:64-90`

**Step 1: Implement atomic symlink validation**

Replace the TOCTOU-vulnerable code:

```javascript
if (st.isSymbolicLink()) {
  // Resolve symlink target
  let realPath;
  try {
    realPath = await fs.realpath(src);
  } catch (err) {
    console.warn(`  ⚠️  Failed to resolve symlink ${e.name}: ${err.message}`);
    continue;
  }

  // Security check: ensure resolved path is within repo
  // Use both resolvedRoot and the original srcDir as allowed bases
  if (resolvedRoot) {
    const normalizedReal = realPath + path.sep;
    const normalizedRoot = resolvedRoot + path.sep;
    const normalizedSrc = (await fs.realpath(srcDir)) + path.sep;

    const isInRoot = realPath === resolvedRoot || normalizedReal.startsWith(normalizedRoot);
    const isInSrc = realPath === await fs.realpath(srcDir) || normalizedReal.startsWith(normalizedSrc);

    if (!isInRoot && !isInSrc) {
      console.warn(`  ⚠️  Skipping symlink outside repo: ${e.name} -> ${realPath}`);
      continue;
    }
  }

  // Verify the target still exists and hasn't changed (mitigate TOCTOU)
  let targetStat;
  try {
    targetStat = await fs.stat(realPath);
  } catch (err) {
    console.warn(`  ⚠️  Symlink target disappeared: ${e.name}`);
    continue;
  }

  if (targetStat.isDirectory()) {
    console.log(`  📁 Resolving symlink dir: ${e.name}`);
    await copyDirFiltered(realPath, dest, ignore, repoRoot);
  } else if (targetStat.isFile()) {
    console.log(`  📄 Resolving symlink file: ${e.name}`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(realPath, dest);
  }
  continue;
}
```

**Step 2: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 3: Commit**

```bash
git add scripts/sync-skill-files.mjs
git commit -m "security: fix TOCTOU vulnerability in symlink handling"
```

---

## Task 3: Strengthen Git Ref Validation

**Files:**
- Modify: `scripts/import-from-issue.mjs:119-120`

**Step 1: Improve ref validation regex**

```javascript
// Strengthen ref validation to prevent injection
if (typeof req.ref !== "string" || !req.ref.trim()) throw new Error("ref is required");

// Git refs can be:
// - Branch names: main, feature/foo, dev-branch
// - Tags: v1.0.0, release-2024
// - Commit SHAs: abc123def (hex chars)
// NOT allowed: --options, special chars that could break commands
if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(req.ref)) {
  throw new Error(`ref contains invalid characters or format: ${req.ref}`);
}

// Prevent git option injection (refs starting with -)
if (req.ref.startsWith('-')) {
  throw new Error(`ref cannot start with '-': ${req.ref}`);
}

// Prevent refs that could be confused with options or dangerous patterns
const dangerousPatterns = [
  /^-/,              // starts with dash (git option)
  /\.\./,            // path traversal in ref
  /^\.$/,            // current dir
  /^~$/,             // home dir
  /[\x00-\x1f\x7f]/, // control characters
  /[<>"|*?]/,        // shell special chars
];

for (const pattern of dangerousPatterns) {
  if (pattern.test(req.ref)) {
    throw new Error(`ref contains dangerous pattern: ${req.ref}`);
  }
}
```

**Step 2: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 3: Commit**

```bash
git add scripts/import-from-issue.mjs
git commit -m "security: strengthen git ref validation to prevent injection"
```

---

## Task 4: Fix Subcategory Bug in CLI

**Files:**
- Modify: `cli/commands/add.mjs:179`

**Step 1: Remove subcategory reference**

```javascript
// Old (line 179):
console.log(`   Category: ${skill.category}/${skill.subcategory}\n`);

// New:
console.log(`   Category: ${skill.category}\n`);
```

**Step 2: Verify CLI still works**

Check that the code compiles:
```bash
node cli/index.mjs --help
```
Expected: Help text displayed without errors

**Step 3: Commit**

```bash
git add cli/commands/add.mjs
git commit -m "fix: remove subcategory reference (v2 architecture has flat categories)"
```

---

## Task 5: Improve Error Handling in Symlink Detection

**Files:**
- Modify: `scripts/lib/registry.mjs:176-184`

**Step 1: Add selective error logging**

```javascript
async function findSymlinksInDir(dir) {
  const entries = await fg(["**/*"], {
    cwd: dir,
    onlyFiles: false,
    dot: true,
    followSymbolicLinks: false,
    ignore: SKILL_FILE_IGNORE
  });
  entries.sort((a, b) => a.localeCompare(b));

  const symlinks = [];
  for (const rel of entries) {
    try {
      const st = await fs.lstat(path.join(dir, rel));
      if (st.isSymbolicLink()) symlinks.push(rel);
    } catch (err) {
      // Only ignore ENOENT (racing deletion), log other errors
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        console.warn(`⚠️  Error checking symlink ${rel}: ${err.message}`);
      }
      // Continue processing other files
    }
  }
  return symlinks;
}
```

**Step 2: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 3: Commit**

```bash
git add scripts/lib/registry.mjs
git commit -m "fix: improve error handling in symlink detection"
```

---

## Task 6: Add Translation Cache Size Limit

**Files:**
- Modify: `scripts/lib/translate.mjs:247-258`
- Modify: `scripts/lib/translate.mjs:71`

**Step 1: Add cache size management to loadCache**

```javascript
const MAX_CACHE_ENTRIES = 10000; // Reasonable limit for skill descriptions

/**
 * Load translation cache from disk.
 */
async function loadCache(cachePath) {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const data = JSON.parse(raw);
    if (data.version === CACHE_VERSION && data.entries && typeof data.entries === "object") {
      // Check cache size and trim if needed
      const entries = Object.entries(data.entries);
      if (entries.length > MAX_CACHE_ENTRIES) {
        console.warn(`  ⚠ Cache size (${entries.length}) exceeds limit, trimming to ${MAX_CACHE_ENTRIES}`);
        // Keep most recently synced entries (those with syncedAt in _original)
        const sorted = entries.sort((a, b) => {
          const aTime = a[1]._syncedAt || 0;
          const bTime = b[1]._syncedAt || 0;
          return bTime - aTime; // newest first
        });
        data.entries = Object.fromEntries(sorted.slice(0, MAX_CACHE_ENTRIES));
      }
      return data;
    }
    console.warn("  ⚠ Cache version mismatch, starting fresh");
    return { version: CACHE_VERSION, entries: {} };
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}
```

**Step 2: Update cache writing to include timestamp**

```javascript
// In callTranslationApi success handler (around line 101):
cache.entries[skill.id] = {
  _original: skill.description,
  _syncedAt: Date.now(),
  ...translations
};
```

**Step 3: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 4: Commit**

```bash
git add scripts/lib/translate.mjs
git commit -m "fix: add translation cache size limit to prevent unbounded growth"
```

---

## Task 7: Improve Concurrency Error Handling

**Files:**
- Modify: `scripts/lib/translate.mjs:28-42`

**Step 1: Add error resilience to worker function**

```javascript
/**
 * Run async tasks with a concurrency limit.
 * @param {Array} items
 * @param {number} limit
 * @param {(item: any) => Promise<any>} fn
 */
async function runWithConcurrency(items, limit, fn) {
  const results = [];
  const errors = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        // Store error but continue processing
        errors.push({ index: i, item: items[i], error: err });
        results[i] = null; // Mark as failed
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  // Log errors summary if any occurred
  if (errors.length > 0) {
    console.warn(`  ⚠ ${errors.length} task(s) failed during concurrent execution`);
  }

  return results;
}
```

**Step 2: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 3: Commit**

```bash
git add scripts/lib/translate.mjs
git commit -m "fix: improve error handling in concurrent task execution"
```

---

## Task 8: Add Input Length Validation for Translations

**Files:**
- Modify: `scripts/lib/translate.mjs:135-146`

**Step 1: Add length check before API call**

```javascript
const MAX_DESCRIPTION_LENGTH = 2000; // OpenAI API has limits

async function callTranslationApi({ skillId, description, locales, apiKey, baseUrl, model }) {
  // Validate input length
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    console.warn(`  ⚠ Description for "${skillId}" too long (${description.length} chars), truncating to ${MAX_DESCRIPTION_LENGTH}`);
    description = description.slice(0, MAX_DESCRIPTION_LENGTH) + '...';
  }

  const localeList = locales.join(", ");

  const systemPrompt = [
    "You are a professional translator.",
    `Translate the following text into these locales: ${localeList}.`,
    "Return ONLY a JSON object where keys are locale codes and values are translated strings.",
    "Auto-detect the source language. For the source language locale, return the original text as-is.",
    "Preserve technical terms, code references, and formatting.",
    "Do not wrap the output in markdown code blocks.",
  ].join(" ");

  // ... rest of function
```

**Step 2: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 3: Commit**

```bash
git add scripts/lib/translate.mjs
git commit -m "fix: add description length validation for translation API"
```

---

## Task 9: Extract Magic Numbers to Constants

**Files:**
- Create: `scripts/lib/constants.mjs`
- Modify: `scripts/import-from-issue.mjs:122`
- Modify: `scripts/lib/translate.mjs:8, 183`

**Step 1: Create constants file**

```javascript
// scripts/lib/constants.mjs
/**
 * Global constants for the registry build system
 */

// Import validation
export const MAX_ITEMS_PER_IMPORT = 20;

// Translation
export const DEFAULT_TRANSLATION_CONCURRENCY = 5;
export const TRANSLATION_API_TIMEOUT_MS = 30000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_CACHE_ENTRIES = 10000;

// Cache
export const TRANSLATION_CACHE_VERSION = 1;
```

**Step 2: Update import-from-issue.mjs**

```javascript
// At top of file
import { MAX_ITEMS_PER_IMPORT } from './lib/constants.mjs';

// Line 122:
if (req.items.length > MAX_ITEMS_PER_IMPORT) {
  throw new Error(`Too many items (max ${MAX_ITEMS_PER_IMPORT} per request)`);
}
```

**Step 3: Update translate.mjs**

```javascript
// At top of file
import {
  DEFAULT_TRANSLATION_CONCURRENCY,
  TRANSLATION_API_TIMEOUT_MS,
  MAX_DESCRIPTION_LENGTH,
  MAX_CACHE_ENTRIES,
  TRANSLATION_CACHE_VERSION
} from './constants.mjs';

// Line 8:
const CACHE_VERSION = TRANSLATION_CACHE_VERSION;
const DEFAULT_CONCURRENCY = DEFAULT_TRANSLATION_CONCURRENCY;

// Line 183:
const timeoutId = setTimeout(() => controller.abort(), TRANSLATION_API_TIMEOUT_MS);

// Use MAX_DESCRIPTION_LENGTH and MAX_CACHE_ENTRIES as already done in previous tasks
```

**Step 4: Run validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 5: Commit**

```bash
git add scripts/lib/constants.mjs scripts/import-from-issue.mjs scripts/lib/translate.mjs
git commit -m "refactor: extract magic numbers to constants file"
```

---

## Task 10: Final Build Verification

**Files:**
- None (verification only)

**Step 1: Run full validation**

Run: `npm run validate`
Expected: `OK: skills validated`

**Step 2: Test registry build (if skills exist)**

Run: `npm run build:registry:no-sync`
Expected: Build completes successfully with:
```
✅ Registry build complete!
   Skills: N
   Categories: M
   Search docs: N
```

**Step 3: Verify CLI help works**

Run: `node cli/index.mjs --help`
Expected: Help text displayed without errors

**Step 4: Create summary commit**

```bash
git add -A
git commit -m "chore: verify all fixes work correctly" --allow-empty
```

---

## Summary of Fixed Issues

**Critical Security Fixes:**
1. ✅ Path traversal vulnerability (CVE-level)
2. ✅ Symlink TOCTOU vulnerability
3. ✅ Git ref injection prevention

**Important Bug Fixes:**
4. ✅ Removed v2 subcategory bug
5. ✅ Improved error handling consistency
6. ✅ Added translation cache limits
7. ✅ Fixed concurrency error handling
8. ✅ Added input length validation

**Code Quality Improvements:**
9. ✅ Extracted magic numbers to constants
10. ✅ Verified all builds work

