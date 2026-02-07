// scripts/lib/translate.mjs — Translation engine for skill descriptions
import fs from "node:fs/promises";
import path from "node:path";

import { getLocaleIds } from "./config.mjs";
import {
  DEFAULT_TRANSLATION_CONCURRENCY,
  TRANSLATION_API_TIMEOUT_MS,
  MAX_DESCRIPTION_LENGTH,
  MAX_CACHE_ENTRIES,
  TRANSLATION_CACHE_VERSION
} from './constants.mjs';
import { debugApiRequest } from "./debug-logger.mjs";

const CACHE_VERSION = TRANSLATION_CACHE_VERSION;
const DEFAULT_CONCURRENCY = DEFAULT_TRANSLATION_CONCURRENCY;

/**
 * Resolve translation cache directory.
 * On Vercel / CI: use node_modules/.cache/ (persisted between builds).
 * Locally: use the configured build cacheDir.
 */
function resolveTranslationCacheDir(cacheDir) {
  if (process.env.VERCEL || process.env.CI) {
    return "node_modules/.cache/skill-translations";
  }
  return cacheDir;
}

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

/**
 * Translate skill descriptions to all configured languages.
 * One API call per skill, translating to all locales at once.
 * Up to CONCURRENCY skills translated in parallel.
 *
 * @param {Array} skills - Array of skill objects with `id` and `description` (string)
 * @param {Object} options
 * @param {string} options.cacheDir - Directory for translation cache
 * @param {Object} options.config - Registry config object
 * @returns {Promise<Array>} Skills with description as I18nString (or unchanged string if no API key)
 */
export async function translateSkillDescriptions(skills, { cacheDir, config }) {
  const apiKey = process.env.A_OPENAI_API_KEY;
  if (!apiKey) {
    console.log("  ⓘ  A_OPENAI_API_KEY not set, skipping description translation");
    return skills;
  }

  const baseUrl = (process.env.A_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.A_OPENAI_MODEL || "gpt-4o-mini";

  const concurrency = Math.max(1, parseInt(process.env.A_OPENAI_CONCURRENCY, 10) || DEFAULT_CONCURRENCY);
  const allLocales = config ? getLocaleIds(config) : ["en", "zh-CN", "zh-TW", "ja", "ko", "de", "es", "fr", "pt", "ru"];

  // Load cache
  const effectiveCacheDir = resolveTranslationCacheDir(cacheDir);
  const cachePath = path.join(effectiveCacheDir, "translations.json");
  let cache = await loadCache(cachePath);

  // Determine which skills need translation
  const needsTranslation = [];
  for (const skill of skills) {
    const cached = cache.entries[skill.id];
    if (cached && cached._original === skill.description) {
      const missing = allLocales.filter((l) => !cached[l]);
      if (missing.length === 0) continue;
    }
    needsTranslation.push(skill);
  }

  if (needsTranslation.length === 0) {
    console.log("  ✓ All descriptions cached, 0 API calls");
  } else {
    console.log(`  ⟳ Translating ${needsTranslation.length} skill(s) to ${allLocales.length} languages (concurrency: ${concurrency})...`);

    await runWithConcurrency(needsTranslation, concurrency, async (skill) => {
      try {
        const translations = await callTranslationApi({
          skillId: skill.id,
          description: skill.description,
          locales: allLocales,
          apiKey,
          baseUrl,
          model,
        });

        // Write into cache — original description stored under "_original" for cache invalidation
        cache.entries[skill.id] = {
          _original: skill.description,
          _syncedAt: Date.now(),
          ...translations
        };
        console.log(`    ✓ ${skill.id}`);
      } catch (err) {
        console.warn(`    ⚠ ${skill.id}: ${err.message}`);
        // Keep any existing cache entry
      }
    });

    await saveCache(cachePath, cache);
    console.log(`  ✓ Translation complete, cache saved`);
  }

  // Transform skills: description string → I18nString object
  return skills.map((skill) => {
    const cached = cache.entries[skill.id];
    if (!cached) return skill;

    const i18nDesc = {};
    for (const locale of allLocales) {
      if (cached[locale]) {
        i18nDesc[locale] = cached[locale];
      }
    }
    // Ensure "en" always has the original description
    i18nDesc.en = skill.description;

    return { ...skill, description: i18nDesc };
  });
}

/**
 * Call OpenAI API to translate a single skill description into all target locales.
 * Returns { "en": "...", "zh-CN": "...", ... }
 */
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

  // Build JSON schema for structured output — one string field per locale
  const schemaProperties = {};
  for (const locale of locales) {
    schemaProperties[locale] = { type: "string" };
  }

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: description },
    ],
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "skill_translations",
        strict: true,
        schema: {
          type: "object",
          properties: schemaProperties,
          required: locales,
          additionalProperties: false,
        },
      },
    },
  };

  // Safe debug logging that redacts sensitive data
  debugApiRequest(skillId, `${baseUrl}/chat/completions`, body);

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRANSLATION_API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await response.text();

  if (process.env.A_OPENAI_DEBUG) {
    console.log(`    Status: ${response.status}`);
    console.log(`    Response: ${rawText.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${rawText.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Response is not valid JSON for "${skillId}": ${rawText.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content ?? "";

  if (!content) {
    throw new Error(`Empty response for "${skillId}" (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"})`);
  }

  // Parse JSON (strip possible markdown fences)
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const result = {};
    for (const locale of locales) {
      if (typeof parsed[locale] === "string") {
        result[locale] = parsed[locale];
      }
    }
    return result;
  } catch (err) {
    throw new Error(`JSON parse failed for "${skillId}": ${err.message}\n    Response: ${jsonStr.slice(0, 200)}`);
  }
}

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

/**
 * Save translation cache to disk.
 */
async function saveCache(cachePath, cache) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
}
