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
