import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseGitHubRepoSlug } from "./github.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJsonFile(absPath) {
  const raw = await fs.readFile(absPath, "utf8");
  return JSON.parse(raw);
}

export async function readLocalRegistryIndex() {
  const localPath = path.resolve(__dirname, "..", "..", "registry", "index.json");
  return await readJsonFile(localPath);
}

export function getRawIndexUrl(registryUrl, ref) {
  const { owner, repo } = parseGitHubRepoSlug(registryUrl);
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/registry/index.json`;
}

export async function fetchRegistryIndex(registryUrl, ref) {
  const url = getRawIndexUrl(registryUrl, ref);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    try {
      return await readLocalRegistryIndex();
    } catch {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load registry index.\n- url: ${url}\n- error: ${msg}`);
    }
  }
}

export function findSkillById(index, skillId) {
  const skills = index?.skills ?? [];
  return skills.find((s) => s.id === skillId) ?? null;
}

