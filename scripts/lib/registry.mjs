// scripts/lib/registry.mjs (v2 - flat categories + cache support)
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { getBuildConfig } from "./config.mjs";

export const SKILL_YAML_GLOB = "skills/*/*/.x_skill.yaml";

const SKILL_FILE_IGNORE = [
  "**/.git",
  "**/.git/**",
  "**/node_modules",
  "**/node_modules/**",
  "**/.next",
  "**/.next/**",
  "**/dist",
  "**/dist/**",
  "**/out",
  "**/out/**",
  "**/__pycache__",
  "**/__pycache__/**",
  "**/*.pyc",
  "**/*.pyo",
  "**/.DS_Store"
];

export function splitPath(p) {
  return p.replaceAll("\\", "/").split("/").filter(Boolean);
}

export function humanizeSlug(slug) {
  // Slug -> "Title Case" while preserving common abbreviations like "UI" / "UX".
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      let upper = part.toUpperCase();
      if (upper === "UI" || upper === "UX" || upper === "CLI" || upper === "API") return upper;
      return part.slice(0, 1).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

export async function readYamlFile(filePath) {
  let raw = await readText(filePath);
  try {
    return YAML.parse(raw);
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse YAML: ${filePath}\n${msg}`);
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadSkillSchema() {
  let schemaPath = path.join("schemas", "skill.schema.json");
  let raw = await readText(schemaPath);
  try {
    return JSON.parse(raw);
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON schema: ${schemaPath}\n${msg}`);
  }
}

export async function loadCategorySchema() {
  let schemaPath = path.join("schemas", "category.schema.json");
  let raw = await readText(schemaPath);
  try {
    return JSON.parse(raw);
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON schema: ${schemaPath}\n${msg}`);
  }
}

export function createValidator(schema) {
  let ajv = new Ajv({
    allErrors: true,
    allowUnionTypes: true
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function stripFrontmatter(markdown) {
  // Remove a leading YAML frontmatter block ("--- ... ---") if present.
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) return markdown;
  let end = markdown.search(/\r?\n---\r?\n/);
  if (end === -1) return markdown;
  let matchLen = markdown.slice(end).match(/\r?\n---\r?\n/)[0].length;
  return markdown.slice(end + matchLen);
}

export function extractSummary(markdown) {
  // First paragraph after stripping frontmatter and the top title.
  let md = stripFrontmatter(markdown).trim();
  if (!md) return "";

  let lines = md.split("\n");

  // Drop leading title block (# ...)
  if (lines[0]?.startsWith("#")) {
    lines.shift();
    while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  }

  let para = [];
  for (let line of lines) {
    if (line.trim() === "") break;
    para.push(line);
  }
  return para.join("\n").trim();
}

/**
 * Parse skill YAML path (v2 - flat structure)
 * skills/{category}/{skill-id}/.x_skill.yaml
 */
export function parseSkillYamlPath(skillYamlPath) {
  let parts = splitPath(skillYamlPath);
  let skillsIdx = parts.indexOf("skills");
  if (skillsIdx === -1) throw new Error(`Invalid skill path (missing skills/): ${skillYamlPath}`);

  let category = parts[skillsIdx + 1];
  let skillId = parts[skillsIdx + 2];
  let fileName = parts[skillsIdx + 3];

  if (!category || !skillId || fileName !== ".x_skill.yaml") {
    throw new Error(`Invalid skill path shape (expected skills/{category}/{id}/.x_skill.yaml): ${skillYamlPath}`);
  }

  let skillDir = parts.slice(0, skillsIdx + 3).join("/");
  return { category, skillId, skillDir };
}

export async function listSkillFiles(skillDir) {
  let entries = await fg(["**/*"], {
    cwd: skillDir,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: SKILL_FILE_IGNORE
  });
  entries.sort((a, b) => a.localeCompare(b));
  return entries.map((p) => ({ path: p, kind: "file" }));
}

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
    } catch {
      // Ignore racing/missing paths
    }
  }
  return symlinks;
}

/**
 * Scan all skills (v2 - with cache support)
 */
export async function scanSkills({ includeFiles = true, includeSummary = true, config = null } = {}) {
  let schema = await loadSkillSchema();
  let validate = createValidator(schema);

  // Get cache directory from config
  let cacheDir = '.cache/skills';
  if (config) {
    const buildConfig = getBuildConfig(config);
    cacheDir = buildConfig.cacheDir;
  }

  let skillYamlPaths = await fg([SKILL_YAML_GLOB], { onlyFiles: true, dot: true });
  skillYamlPaths.sort((a, b) => a.localeCompare(b));

  let errors = [];
  let skills = [];
  let seenIds = new Map(); // id -> path

  // Check for legacy filenames
  let legacyYamlPaths = await fg(["skills/*/*/skill.yaml"], { onlyFiles: true, dot: false });
  legacyYamlPaths.sort((a, b) => a.localeCompare(b));
  for (let legacyPath of legacyYamlPaths) {
    let skillDir = legacyPath.replace(/\/skill\.yaml$/, "");
    let canonicalPath = `${skillDir}/.x_skill.yaml`;
    if (await fileExists(canonicalPath)) {
      errors.push(`Legacy manifest should be removed: ${legacyPath}\n- canonical: ${canonicalPath}`);
    } else {
      errors.push(`Legacy manifest filename is not supported: ${legacyPath}\n- rename to: ${canonicalPath}`);
    }
  }

  for (let skillYamlPath of skillYamlPaths) {
    let { category, skillId, skillDir } = parseSkillYamlPath(skillYamlPath);

    // Check for symlinks
    const symlinks = await findSymlinksInDir(skillDir);
    if (symlinks.length > 0) {
      errors.push(
        [`Symlinks are not allowed in skill directories: ${skillDir}`, ...symlinks.map((p) => `- ${p}`)].join("\n")
      );
      continue;
    }

    let meta;
    try {
      meta = await readYamlFile(skillYamlPath);
    } catch (err) {
      errors.push(String(err));
      continue;
    }

    if (!validate(meta)) {
      errors.push(
        [
          `Schema validation failed: ${skillYamlPath}`,
          ...(validate.errors ?? []).map((e) => `- ${e.instancePath || "/"} ${e.message ?? ""}`.trim())
        ].join("\n")
      );
      continue;
    }

    if (meta.id !== skillId) {
      errors.push(`Skill id mismatch: ${skillYamlPath}\n- folder: ${skillId}\n- .x_skill.yaml: ${meta.id}`);
      continue;
    }

    if (meta.category !== category) {
      errors.push(`Skill category mismatch: ${skillYamlPath}\n- folder: ${category}\n- .x_skill.yaml: ${meta.category}`);
      continue;
    }

    if (seenIds.has(meta.id)) {
      errors.push(`Duplicate skill id: ${meta.id}\n- ${seenIds.get(meta.id)}\n- ${skillYamlPath}`);
      continue;
    }
    seenIds.set(meta.id, skillYamlPath);

    // Try to read from cache first, fallback to skillDir
    const skillCacheDir = path.join(cacheDir, skillId);
    const skillMdCachePath = path.join(skillCacheDir, 'SKILL.md');
    const skillMdLocalPath = path.join(skillDir, 'SKILL.md');

    let skillMdPath = null;
    const cacheExists = await fileExists(skillMdCachePath);
    const localExists = await fileExists(skillMdLocalPath);

    if (cacheExists) {
      skillMdPath = skillMdCachePath;
    } else if (localExists) {
      skillMdPath = skillMdLocalPath;
    } else if (meta.source?.repo) {
      // External source skill - SKILL.md will be fetched during sync
      // Skip SKILL.md check during validation, but warn if not synced
      if (includeSummary || includeFiles) {
        // Building registry requires files - they should have been synced
        errors.push(`Missing SKILL.md for external skill: ${skillId}\nRun 'npm run sync:skills' first to fetch files from ${meta.source.repo}`);
        continue;
      }
      // Validation-only mode: OK to proceed without SKILL.md
    } else {
      // Local skill without source.repo must have SKILL.md
      errors.push(`Missing SKILL.md: ${skillMdLocalPath}`);
      continue;
    }

    let summary = "";
    if (includeSummary) {
      try {
        summary = extractSummary(await readText(skillMdPath));
      } catch (err) {
        errors.push(`Failed to read SKILL.md: ${skillMdPath}\n${String(err)}`);
        continue;
      }
    }

    let files = [];
    if (includeFiles) {
      try {
        // Try cache first
        const fileSourceDir = await fileExists(skillCacheDir) ? skillCacheDir : skillDir;
        files = await listSkillFiles(fileSourceDir);
      } catch (err) {
        errors.push(`Failed to list files: ${skillDir}\n${String(err)}`);
        continue;
      }
    }

    skills.push({
      ...meta,
      repoPath: skillDir,
      summary,
      files
    });
  }

  return { skills, errors };
}

/**
 * Load categories (v2 - flat structure with i18n)
 */
export async function loadCategoriesFromRepo(skills, config = null) {
  let categories = new Map(); // id -> {id,title,description,icon,order}
  let categorySchema = await loadCategorySchema();
  let validateCategory = createValidator(categorySchema);

  // First, populate from existing skills
  for (let s of skills) {
    if (!categories.has(s.category)) {
      categories.set(s.category, {
        id: s.category,
        title: humanizeSlug(s.category),
        description: "",
        icon: null,
        order: 999
      });
    }
  }

  // Second, scan for all _category.yaml files
  const categoryFiles = await fg(["skills/*/_category.yaml"], { onlyFiles: true, dot: false });

  for (let categoryPath of categoryFiles) {
    const parts = splitPath(categoryPath);
    const catId = parts[1]; // skills/category-id/_category.yaml

    if (!categories.has(catId)) {
      categories.set(catId, {
        id: catId,
        title: humanizeSlug(catId),
        description: "",
        icon: null,
        order: 999
      });
    }

    let cat = categories.get(catId);

    try {
      let meta = await readYamlFile(categoryPath);

      // Validate category metadata
      if (!validateCategory(meta)) {
        console.warn(`⚠️  Category validation failed: ${categoryPath}`);
        console.warn(validateCategory.errors);
        continue;
      }

      if (meta.id && meta.id !== catId) {
        throw new Error(`Category id mismatch: ${categoryPath}\n- folder: ${catId}\n- _category.yaml: ${meta.id}`);
      }

      if (meta.title) cat.title = meta.title;
      if (meta.description) cat.description = meta.description;
      if (meta.icon) cat.icon = meta.icon;
      if (typeof meta.order === 'number') cat.order = meta.order;
    } catch (err) {
      console.warn(`⚠️  Failed to load category metadata: ${categoryPath}`, err.message);
    }
  }

  // Serialize to JSON-friendly shape, sorted by order then id
  let categoryList = Array.from(categories.values())
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });

  return categoryList;
}

/**
 * Build search index (v2 - no subcategory)
 */
export function buildSearchDocs(skills) {
  return skills.map((s) => ({
    id: s.id,
    category: s.category,
    title: s.title,
    tags: s.tags ?? [],
    agents: s.agents ?? [],
    text: [s.title, s.description, (s.tags ?? []).join(" "), s.summary].filter(Boolean).join("\n")
  }));
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}
