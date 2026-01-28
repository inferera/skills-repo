// scripts/lib/config.mjs
import fs from 'node:fs/promises';
import YAML from 'yaml';

let _config = null;

/**
 * Load global configuration from config/registry.yaml
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig() {
  if (_config) return _config;

  try {
    const raw = await fs.readFile('config/registry.yaml', 'utf8');
    _config = YAML.parse(raw);
    return _config;
  } catch (error) {
    console.error('Failed to load config/registry.yaml:', error.message);
    throw error;
  }
}

/**
 * Get default locale from config
 * @param {Object} config Configuration object
 * @returns {string} Default locale ID
 */
export function getDefaultLocale(config) {
  return config.locales.find(l => l.default)?.id || 'en';
}

/**
 * Get all supported locale IDs
 * @param {Object} config Configuration object
 * @returns {string[]} Array of locale IDs
 */
export function getLocaleIds(config) {
  return config.locales.map(l => l.id);
}

/**
 * Get agent configuration by ID
 * @param {Object} config Configuration object
 * @param {string} agentId Agent identifier
 * @returns {Object|null} Agent configuration or null
 */
export function getAgentById(config, agentId) {
  return config.agents.find(a => a.id === agentId) || null;
}

/**
 * Get sync configuration
 * @param {Object} config Configuration object
 * @returns {Object} Sync configuration
 */
export function getSyncConfig(config) {
  return {
    schedule: config.sync?.schedule || '0 20 * * *',
    concurrency: config.sync?.concurrency || 10,
    limits: config.sync?.limits || {
      maxFiles: 2500,
      maxBytes: 52428800
    }
  };
}

/**
 * Get build configuration
 * @param {Object} config Configuration object
 * @returns {Object} Build configuration
 */
export function getBuildConfig(config) {
  return {
    fetchOnBuild: config.build?.fetchOnBuild !== false,
    cacheDir: config.build?.cacheDir || '.cache/skills'
  };
}
