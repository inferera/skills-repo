import fs from "node:fs/promises";
import path from "node:path";

import type { RegistryCategories, RegistryIndex, RegistrySkill } from "@/lib/types";

async function readJsonFile<T>(absPath: string): Promise<T> {
  const raw = await fs.readFile(absPath, "utf8");
  return JSON.parse(raw) as T;
}

async function tryReadJson<T>(absPath: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(absPath);
  } catch {
    return null;
  }
}

function siteRoot() {
  return process.cwd();
}

export async function loadRegistryIndex(): Promise<RegistryIndex> {
  // Prefer the site-local public artifact, fall back to repo-root registry output.
  const a = path.join(siteRoot(), "public", "registry", "index.json");
  const b = path.join(siteRoot(), "..", "registry", "index.json");

  const fromA = await tryReadJson<RegistryIndex>(a);
  if (fromA) return fromA;

  const fromB = await tryReadJson<RegistryIndex>(b);
  if (fromB) return fromB;

  throw new Error(
    [
      "Missing registry index.",
      "Run from repo root: `npm install` then `npm run build:registry`.",
      `Tried: ${a}`,
      `Tried: ${b}`
    ].join("\n")
  );
}

export async function loadRegistryCategories(): Promise<RegistryCategories> {
  const a = path.join(siteRoot(), "public", "registry", "categories.json");
  const b = path.join(siteRoot(), "..", "registry", "categories.json");

  const fromA = await tryReadJson<RegistryCategories>(a);
  if (fromA) return fromA;

  const fromB = await tryReadJson<RegistryCategories>(b);
  if (fromB) return fromB;

  // Categories can be derived from the index for local dev, but we keep it explicit in CI.
  const index = await loadRegistryIndex();
  const map = new Map<string, Map<string, true>>();
  for (const s of index.skills) {
    if (!map.has(s.category)) map.set(s.category, new Map());
    map.get(s.category)!.set(s.subcategory, true);
  }

  return {
    specVersion: 1,
    generatedAt: index.generatedAt,
    categories: Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([catId, subs]) => ({
        id: catId,
        title: catId,
        subcategories: Array.from(subs.keys())
          .sort((a, b) => a.localeCompare(b))
          .map((subId) => ({ id: subId, title: subId }))
      }))
  };
}

export async function getSkillById(skillId: string): Promise<RegistrySkill | null> {
  const index = await loadRegistryIndex();
  return index.skills.find((s) => s.id === skillId) ?? null;
}

export function repoFilePath(repoPath: string): string {
  // Repo root is one level above `site/`.
  return path.resolve(siteRoot(), "..", repoPath);
}
