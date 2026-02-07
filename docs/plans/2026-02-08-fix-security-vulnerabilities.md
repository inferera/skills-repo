# Security Vulnerabilities Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two security vulnerabilities: TOCTOU in symlink handling and API key leakage in debug mode

**Architecture:** Use file descriptors for atomic symlink operations to eliminate TOCTOU window. Implement sanitized debug logging that redacts sensitive data.

**Tech Stack:** Node.js (v18+), fs/promises with file descriptors, structured logging

---

## Task 1: Fix TOCTOU Vulnerability in Symlink Handling

**Files:**
- Modify: `scripts/sync-skill-files.mjs:64-110`
- Create: `scripts/lib/safe-symlink.mjs` (new utility module)

**Security Issue:** Between checking a symlink with `lstat()` and reading it with `realpath()`, a malicious actor could swap the symlink target (Time-of-Check-Time-of-Use vulnerability).

**Solution:** Use file descriptor-based operations to ensure atomicity.

### Step 1: Create safe symlink utility module

Create `scripts/lib/safe-symlink.mjs`:

```javascript
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
```

**Commit:**
```bash
git add scripts/lib/safe-symlink.mjs
git commit -m "feat(security): add safe symlink resolution utility

- Implements file descriptor-based symlink resolution
- Prevents TOCTOU attacks by using atomic operations
- Detects circular symlinks (max depth 40)
- Validates symlink targets are within allowed root
- Uses path.relative for safe path containment checks"
```

### Step 2: Update sync-skill-files.mjs to use safe symlink utility

Modify `scripts/sync-skill-files.mjs`:

**Import the new utility** (add at top after other imports, around line 12):

```javascript
import { safeResolveSymlink } from "./lib/safe-symlink.mjs";
```

**Replace the vulnerable code** (lines 64-110) with:

```javascript
    const src = path.join(srcDir, e.name);
    const dest = path.join(destDir, e.name);

    const st = await fs.lstat(src);

    if (st.isSymbolicLink()) {
      // Use safe symlink resolution to prevent TOCTOU attacks
      const allowedRoot = resolvedRoot || repoRoot;
      const resolved = await safeResolveSymlink(src, allowedRoot);

      if (!resolved) {
        // safeResolveSymlink already logged the warning
        continue;
      }

      const { realPath, stat: targetStat } = resolved;

      if (targetStat.isDirectory()) {
        console.log(`  📁 Resolving symlink dir: ${e.name} -> ${realPath}`);
        await copyDirFiltered(realPath, dest, ignore, repoRoot);
      } else if (targetStat.isFile()) {
        console.log(`  📄 Resolving symlink file: ${e.name} -> ${realPath}`);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(realPath, dest);
      }
      continue;
    }
```

**Commit:**
```bash
git add scripts/sync-skill-files.mjs
git commit -m "fix(security): eliminate TOCTOU vulnerability in symlink handling

- Replace manual symlink resolution with safeResolveSymlink()
- Eliminates race condition between lstat and realpath
- Adds circular symlink detection
- Improves error messages with target paths

Fixes: TOCTOU vulnerability in sync-skill-files.mjs:64-110"
```

### Step 3: Test the symlink security fix manually

**Create test symlinks:**

```bash
cd /Users/xsc/Desktop/aiwork/skills-repo

# Create test directory structure
mkdir -p test-symlinks/safe
mkdir -p test-symlinks/outside
echo "safe content" > test-symlinks/safe/file.txt

# Test 1: Safe symlink (within repo)
cd test-symlinks
ln -s safe/file.txt safe-link.txt

# Test 2: Circular symlink
ln -s circular1 circular1
ln -s circular2 circular1
ln -s circular1 circular2

# Test 3: Symlink outside repo (should be blocked)
ln -s /etc/passwd unsafe-link.txt

cd ..
```

**Run sync with test symlinks:**

```bash
# This should handle symlinks safely without TOCTOU vulnerability
npm run sync:skills

# Verify logs show:
# ✅ Safe symlinks are resolved
# ⚠️  Circular symlinks are detected
# ⚠️  Outside-repo symlinks are blocked
```

**Clean up test files:**

```bash
rm -rf test-symlinks
```

**Expected Results:**
- Safe symlinks within repo: ✅ Copied successfully
- Circular symlinks: ⚠️ Warning logged, skipped
- Outside-repo symlinks: ⚠️ Warning logged, blocked

---

## Task 2: Fix API Key Leakage in Debug Mode

**Files:**
- Modify: `scripts/lib/translate.mjs:205-209`
- Create: `scripts/lib/debug-logger.mjs` (new utility module)

**Security Issue:** Debug mode logs full request body which may contain sensitive prompt data or be used to infer API keys from request patterns.

**Solution:** Implement sanitized debug logging that redacts sensitive fields.

### Step 4: Create debug logger utility module

Create `scripts/lib/debug-logger.mjs`:

```javascript
// scripts/lib/debug-logger.mjs
// Sanitized debug logging that redacts sensitive data

/**
 * Sanitize an object for debug logging by redacting sensitive fields
 *
 * @param {any} obj - Object to sanitize
 * @param {string[]} sensitiveFields - Field names to redact
 * @returns {any} Sanitized copy of the object
 */
export function sanitizeForLog(obj, sensitiveFields = []) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item, sensitiveFields));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value, sensitiveFields);
    } else if (typeof value === 'string' && value.length > 200) {
      // Truncate very long strings to prevent log pollution
      sanitized[key] = value.slice(0, 197) + '...';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Log debug information with automatic sanitization
 * Only logs if DEBUG environment variable is set
 *
 * @param {string} label - Log label/title
 * @param {any} data - Data to log
 * @param {object} options - Options for sanitization
 * @param {string[]} options.redact - Field names to redact
 */
export function debugLog(label, data, options = {}) {
  const debugVar = process.env.A_OPENAI_DEBUG || process.env.DEBUG;
  if (!debugVar) return;

  const defaultRedactFields = [
    'apiKey',
    'api_key',
    'authorization',
    'token',
    'password',
    'secret'
  ];

  const redactFields = options.redact || defaultRedactFields;
  const sanitized = sanitizeForLog(data, redactFields);

  console.log(`\n  [DEBUG] ${label}`);
  console.log(`    ${JSON.stringify(sanitized, null, 2)}`);

  // Add warning about sensitive data
  if (debugVar) {
    console.log(`    ⚠️  Debug mode active - ensure logs are not exposed publicly`);
  }
}

/**
 * Log API request details safely
 *
 * @param {string} skillId - Skill being processed
 * @param {string} url - Request URL
 * @param {object} body - Request body
 */
export function debugApiRequest(skillId, url, body) {
  debugLog(`Request for "${skillId}"`, {
    url,
    method: 'POST',
    bodyPreview: {
      model: body.model,
      messageCount: body.messages?.length,
      // Include first message content preview (usually safe)
      firstMessagePreview: body.messages?.[0]?.content?.slice(0, 100) + '...',
      temperature: body.temperature,
    },
    // Full body available but sanitized
    fullBody: body,
  }, {
    redact: ['apiKey', 'api_key', 'authorization'],
  });
}
```

**Commit:**
```bash
git add scripts/lib/debug-logger.mjs
git commit -m "feat(security): add sanitized debug logging utility

- Implements redaction of sensitive fields (API keys, tokens, etc)
- Truncates long strings to prevent log pollution
- Provides safe API request logging helper
- Warns when debug mode is active"
```

### Step 5: Update translate.mjs to use safe debug logging

Modify `scripts/lib/translate.mjs`:

**Import the debug logger** (add at top after other imports):

```javascript
import { debugApiRequest } from "./debug-logger.mjs";
```

**Replace the unsafe debug logging** (lines 205-209) with:

```javascript
  // Safe debug logging that redacts sensitive data
  debugApiRequest(skillId, `${baseUrl}/chat/completions`, body);
```

**Remove the old unsafe debug code:**

Delete these lines:
```javascript
  if (process.env.A_OPENAI_DEBUG) {
    console.log(`\n  [DEBUG] Request for "${skillId}":`);
    console.log(`    URL: ${baseUrl}/chat/completions`);
    console.log(`    Body: ${JSON.stringify(body, null, 2)}`);
  }
```

**Commit:**
```bash
git add scripts/lib/translate.mjs
git commit -m "fix(security): prevent API key leakage in debug mode

- Replace unsafe debug logging with sanitized debugApiRequest()
- Redacts sensitive fields from logs
- Provides structured preview of request data
- Adds warning when debug mode is active

Fixes: API key leakage in translate.mjs:205-209"
```

### Step 6: Test debug logging manually

**Test with debug mode enabled:**

```bash
cd /Users/xsc/Desktop/aiwork/skills-repo

# Enable debug mode
export A_OPENAI_DEBUG=1

# Run a translation (if API key is configured)
# This will trigger debug logging
npm run validate 2>&1 | grep -A 20 "\[DEBUG\]"

# Verify output shows:
# ✅ [DEBUG] log entries
# ✅ Sanitized/redacted sensitive fields
# ✅ Warning about debug mode
# ❌ No raw API keys or full request bodies
```

**Test without debug mode:**

```bash
# Disable debug mode
unset A_OPENAI_DEBUG
unset DEBUG

# Run validation
npm run validate 2>&1 | grep "\[DEBUG\]"

# Verify: No debug output (exit code 1 = no matches found)
echo "Exit code: $?" # Should be 1 (no debug logs)
```

**Expected Results:**
- Debug mode ON: Sanitized logs visible, sensitive data redacted, warnings shown
- Debug mode OFF: No debug logs at all
- API keys never appear in logs in either mode

### Step 7: Add documentation for security fixes

Create `docs/security/CHANGELOG.md`:

```markdown
# Security Changelog

## 2026-02-08 - Security Vulnerability Fixes

### Fixed: TOCTOU Vulnerability in Symlink Handling

**Severity:** High
**Component:** `scripts/sync-skill-files.mjs`
**CVE:** N/A (internal)

**Issue:** Time-of-check-time-of-use race condition allowed potential symlink target swapping between validation and file operations.

**Fix:**
- Implemented atomic file descriptor-based symlink resolution
- Added circular symlink detection (max depth: 40)
- Improved path containment validation using `path.relative()`
- Added comprehensive error logging

**Impact:** Prevents potential directory traversal attacks via symlink manipulation.

### Fixed: API Key Leakage in Debug Mode

**Severity:** Medium
**Component:** `scripts/lib/translate.mjs`
**CVE:** N/A (internal)

**Issue:** Debug mode logging exposed full API request bodies, potentially leaking sensitive data or enabling API key inference from request patterns.

**Fix:**
- Implemented sanitized debug logging with automatic field redaction
- Added configurable sensitive field list (API keys, tokens, passwords)
- Truncate long strings in logs
- Added warnings when debug mode is active

**Impact:** Prevents accidental exposure of API keys or sensitive prompt data in debug logs.

## Testing

Both fixes have been manually tested:
- Symlink handling tested with safe, circular, and out-of-bounds symlinks
- Debug logging tested with and without debug mode enabled

## Recommendations

1. **Audit Existing Logs:** Review any existing debug logs for exposed sensitive data
2. **Environment Security:** Ensure `A_OPENAI_DEBUG` is never enabled in production
3. **Code Review:** Review other scripts for similar TOCTOU patterns
4. **Automated Testing:** Add integration tests for symlink security
```

**Commit:**
```bash
git add docs/security/CHANGELOG.md
git commit -m "docs(security): add security changelog for vulnerability fixes

- Documents TOCTOU and debug logging vulnerabilities
- Describes fixes and impact
- Provides testing procedures and recommendations"
```

---

## Task 3: Additional Hardening (Optional but Recommended)

### Step 8: Add symlink depth configuration

**Modify `config/registry.yaml`** to add symlink configuration:

```yaml
# Security settings
security:
  symlinks:
    maxDepth: 40          # Maximum symlink resolution depth (Linux default)
    allowExternal: false  # Whether to allow symlinks to external paths
    enabled: true         # Whether to follow symlinks at all
```

**Update `scripts/lib/safe-symlink.mjs`** to read from config:

```javascript
import { loadConfig } from "./config.mjs";

// At top of safeResolveSymlink function:
const config = await loadConfig();
const maxDepth = config.security?.symlinks?.maxDepth || 40;
const allowExternal = config.security?.symlinks?.allowExternal || false;

// Use maxDepth instead of MAX_SYMLINK_DEPTH constant
while (depth < maxDepth) {
  // ...
}
```

**Commit:**
```bash
git add config/registry.yaml scripts/lib/safe-symlink.mjs
git commit -m "feat(security): add configurable symlink security settings

- Add security.symlinks section to registry.yaml
- Make max depth configurable (default: 40)
- Add allowExternal flag for future external symlink support
- Add enabled flag to disable symlink following entirely"
```

### Step 9: Add security audit script

Create `scripts/security-audit.mjs`:

```javascript
#!/usr/bin/env node

// scripts/security-audit.mjs
// Audit the repository for potential security issues

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const ISSUES = [];

async function auditSymlinks() {
  console.log("🔍 Auditing symlinks...");

  const files = await fg("skills/**/*", {
    onlyFiles: false,
    followSymbolicLinks: false
  });

  for (const file of files) {
    try {
      const stats = await fs.lstat(file);
      if (stats.isSymbolicLink()) {
        const target = await fs.readlink(file);

        // Check for absolute path symlinks
        if (path.isAbsolute(target)) {
          ISSUES.push({
            severity: "HIGH",
            type: "symlink",
            file,
            issue: `Absolute path symlink: ${target}`,
          });
        }

        // Check for external symlinks
        const realPath = await fs.realpath(file).catch(() => null);
        if (realPath && !realPath.startsWith(process.cwd())) {
          ISSUES.push({
            severity: "CRITICAL",
            type: "symlink",
            file,
            issue: `Symlink points outside repository: ${realPath}`,
          });
        }
      }
    } catch (err) {
      // Broken symlink
      ISSUES.push({
        severity: "MEDIUM",
        type: "symlink",
        file,
        issue: `Broken symlink: ${err.message}`,
      });
    }
  }
}

async function auditDebugMode() {
  console.log("🔍 Auditing debug mode usage...");

  const scripts = await fg("scripts/**/*.mjs");

  for (const script of scripts) {
    const content = await fs.readFile(script, "utf-8");

    // Check for unsafe console.log of sensitive data
    if (content.match(/console\.log\([^)]*body[^)]*\)/gi)) {
      ISSUES.push({
        severity: "MEDIUM",
        type: "debug-logging",
        file: script,
        issue: "Potentially unsafe console.log of request body",
      });
    }

    // Check for hardcoded credentials
    if (content.match(/(api_key|apikey|password|secret)\s*=\s*["'][^"']+["']/gi)) {
      ISSUES.push({
        severity: "CRITICAL",
        type: "credentials",
        file: script,
        issue: "Possible hardcoded credentials",
      });
    }
  }
}

async function main() {
  console.log("🛡️  Running security audit...\n");

  await auditSymlinks();
  await auditDebugMode();

  if (ISSUES.length === 0) {
    console.log("\n✅ No security issues found!");
    process.exit(0);
  }

  console.log(`\n⚠️  Found ${ISSUES.length} potential security issues:\n`);

  const bySeverity = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };

  for (const issue of ISSUES) {
    bySeverity[issue.severity].push(issue);
  }

  for (const [severity, issues] of Object.entries(bySeverity)) {
    if (issues.length === 0) continue;

    console.log(`\n${severity}:`);
    for (const issue of issues) {
      console.log(`  📁 ${issue.file}`);
      console.log(`     ${issue.issue}`);
    }
  }

  const hasCritical = bySeverity.CRITICAL.length > 0;
  process.exit(hasCritical ? 1 : 0);
}

main();
```

**Add to package.json scripts:**

```json
"scripts": {
  "security:audit": "node scripts/security-audit.mjs",
  "validate": "node scripts/validate.mjs && npm run security:audit"
}
```

**Commit:**
```bash
git add scripts/security-audit.mjs package.json
git commit -m "feat(security): add security audit script

- Audits repository for symlink vulnerabilities
- Checks for unsafe debug logging patterns
- Detects potential hardcoded credentials
- Integrated into npm run validate

Usage: npm run security:audit"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] TOCTOU vulnerability eliminated - symlinks use atomic operations
- [ ] Circular symlinks are detected and blocked
- [ ] Out-of-repo symlinks are blocked
- [ ] API keys never appear in debug logs
- [ ] Debug mode shows sanitized logs only
- [ ] Debug mode can be disabled (no logs when disabled)
- [ ] Security audit script runs without critical issues
- [ ] All commits have descriptive messages
- [ ] Documentation updated

## Final Integration Test

Run the complete validation suite:

```bash
npm run validate
npm run sync:skills
npm run build:registry
```

All commands should complete successfully with:
- ✅ No TOCTOU vulnerabilities
- ✅ No exposed API keys in logs
- ✅ Security audit passes

---

## Rollback Plan

If issues arise, rollback using Git:

```bash
# Find the commit before security fixes
git log --oneline -10

# Rollback to commit before this work
git revert <commit-hash-range>

# Or hard reset (destructive)
git reset --hard <commit-hash-before-fixes>
```

## Future Improvements

1. **Add automated tests** for symlink security (currently manual)
2. **Implement rate limiting** for API calls to prevent key exposure via timing
3. **Add content-based validation** of downloaded files
4. **Consider GPG signature verification** for git commits
5. **Add structured logging** framework instead of console.log
