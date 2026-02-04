import fs from "node:fs/promises";
import path from "node:path";
import { deepStrictEqual } from "node:assert/strict";

import { buildSearchDocs, loadCategoriesFromRepo, scanSkills } from "./lib/registry.mjs";
import { loadConfig } from "./lib/config.mjs";

function normalizeGeneratedAt(obj) {
  if (Array.isArray(obj)) return obj.map(normalizeGeneratedAt);
  if (!obj || typeof obj !== "object") return obj;
  let out = {};
  for (let [k, v] of Object.entries(obj)) {
    if (k === "generatedAt") out[k] = "__IGNORED__";
    else out[k] = normalizeGeneratedAt(v);
  }
  return out;
}

async function readJsonFile(relPath) {
  let raw = await fs.readFile(relPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON: ${relPath}\n${msg}`);
  }
}

async function main() {
  let config = await loadConfig();
  let { skills, errors } = await scanSkills({ includeFiles: true, includeSummary: true, config });
  if (errors.length > 0) {
    console.error(errors.join("\n\n"));
    process.exit(1);
  }

  let categories = await loadCategoriesFromRepo(skills, config);
  let expectedIndex = { specVersion: 2, generatedAt: "__IGNORED__", skills };
  let expectedCategories = { specVersion: 2, generatedAt: "__IGNORED__", categories };
  let expectedSearch = { specVersion: 2, generatedAt: "__IGNORED__", docs: buildSearchDocs(skills) };

  let actualIndex = await readJsonFile(path.join("registry", "index.json"));
  let actualCategories = await readJsonFile(path.join("registry", "categories.json"));
  let actualSearch = await readJsonFile(path.join("registry", "search-index.json"));

  try {
    deepStrictEqual(normalizeGeneratedAt(actualIndex), normalizeGeneratedAt(expectedIndex));
    deepStrictEqual(normalizeGeneratedAt(actualCategories), normalizeGeneratedAt(expectedCategories));
    deepStrictEqual(normalizeGeneratedAt(actualSearch), normalizeGeneratedAt(expectedSearch));
  } catch {
    console.error(
      [
        "Registry outputs are out of date.",
        "",
        "Fix:",
        "  npm run build:registry",
        "  git add registry/*.json",
        "",
        "Reason:",
        "  The CLI fetches registry/index.json from the repository. If it isn't updated and committed, CLI users won't see changes."
      ].join("\n")
    );
    process.exit(1);
  }

  console.log("OK: registry outputs are up to date");
}

await main();

