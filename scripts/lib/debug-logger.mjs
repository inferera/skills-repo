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
