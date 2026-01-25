import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";

import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

export const SKILL_YAML_GLOB = "skills/*/*/*/skill.yaml";

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
  if (!markdown.startsWith("---\n")) return markdown;
  let end = markdown.indexOf("\n---\n", 4);
  if (end === -1) return markdown;
  return markdown.slice(end + "\n---\n".length);
}

export function extractSummary(markdown) {
  // First paragraph after stripping frontmatter and the top title.
  let md = stripFrontmatter(markdown).trim();
  if (!md) return "";

  let lines = md.split("\n");

  // Drop leading title block (# ...)
  if (lines[0]?.startsWith("#")) {
    // Remove until first blank line after the first heading line.
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

export function parseSkillYamlPath(skillYamlPath) {
  let parts = splitPath(skillYamlPath);
  let skillsIdx = parts.indexOf("skills");
  if (skillsIdx === -1) throw new Error(`Invalid skill path (missing skills/): ${skillYamlPath}`);
  let category = parts[skillsIdx + 1];
  let subcategory = parts[skillsIdx + 2];
  let skillId = parts[skillsIdx + 3];
  let fileName = parts[skillsIdx + 4];
  if (!category || !subcategory || !skillId || fileName !== "skill.yaml") {
    throw new Error(`Invalid skill path shape: ${skillYamlPath}`);
  }
  let skillDir = parts.slice(0, skillsIdx + 4).join("/");
  return { category, subcategory, skillId, skillDir };
}

export async function listSkillFiles(skillDir) {
  let entries = await fg(["**/*"], {
    cwd: skillDir,
    onlyFiles: true,
    dot: false,
    ignore: ["**/.git/**", "**/node_modules/**", "**/.next/**", "**/dist/**", "**/out/**"]
  });
  entries.sort((a, b) => a.localeCompare(b));
  return entries.map((p) => ({ path: p, kind: "file" }));
}

export async function scanSkills({ includeFiles = true, includeSummary = true } = {}) {
  let schema = await loadSkillSchema();
  let validate = createValidator(schema);

  let skillYamlPaths = await fg([SKILL_YAML_GLOB], { onlyFiles: true, dot: false });
  skillYamlPaths.sort((a, b) => a.localeCompare(b));

  let errors = [];
  let skills = [];
  let seenIds = new Map(); // id -> path

  for (let skillYamlPath of skillYamlPaths) {
    let { category, subcategory, skillId, skillDir } = parseSkillYamlPath(skillYamlPath);
    let skillMdPath = `${skillDir}/SKILL.md`;

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
      errors.push(`Skill id mismatch: ${skillYamlPath}\n- folder: ${skillId}\n- skill.yaml: ${meta.id}`);
      continue;
    }

    if (seenIds.has(meta.id)) {
      errors.push(`Duplicate skill id: ${meta.id}\n- ${seenIds.get(meta.id)}\n- ${skillYamlPath}`);
      continue;
    }
    seenIds.set(meta.id, skillYamlPath);

    if (!(await fileExists(skillMdPath))) {
      errors.push(`Missing SKILL.md: ${skillMdPath}`);
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
        files = await listSkillFiles(skillDir);
      } catch (err) {
        errors.push(`Failed to list files: ${skillDir}\n${String(err)}`);
        continue;
      }
    }

    skills.push({
      ...meta,
      category,
      subcategory,
      repoPath: skillDir,
      summary,
      files
    });
  }

  return { skills, errors };
}

export async function loadCategoriesFromRepo(skills) {
  let categories = new Map(); // id -> {id,title,description,subcategories: Map}

  for (let s of skills) {
    if (!categories.has(s.category)) {
      categories.set(s.category, {
        id: s.category,
        title: humanizeSlug(s.category),
        description: "",
        subcategories: new Map()
      });
    }
    let cat = categories.get(s.category);
    if (!cat.subcategories.has(s.subcategory)) {
      cat.subcategories.set(s.subcategory, {
        id: s.subcategory,
        title: humanizeSlug(s.subcategory),
        description: ""
      });
    }
  }

  // Optional overrides from _category.yaml files.
  for (let [catId, cat] of categories) {
    let catMetaPath = `skills/${catId}/_category.yaml`;
    if (await fileExists(catMetaPath)) {
      let meta = await readYamlFile(catMetaPath);
      if (meta?.id && meta.id !== catId) {
        throw new Error(`Category id mismatch: ${catMetaPath}\n- folder: ${catId}\n- _category.yaml: ${meta.id}`);
      }
      if (meta?.title) cat.title = meta.title;
      if (meta?.description) cat.description = meta.description;
    }
    for (let [subId, sub] of cat.subcategories) {
      let subMetaPath = `skills/${catId}/${subId}/_category.yaml`;
      if (await fileExists(subMetaPath)) {
        let meta = await readYamlFile(subMetaPath);
        if (meta?.id && meta.id !== subId) {
          throw new Error(
            `Subcategory id mismatch: ${subMetaPath}\n- folder: ${subId}\n- _category.yaml: ${meta.id}`
          );
        }
        if (meta?.title) sub.title = meta.title;
        if (meta?.description) sub.description = meta.description;
      }
    }
  }

  // Serialize to JSON-friendly shape.
  let categoryList = Array.from(categories.values())
    .map((cat) => ({
      id: cat.id,
      title: cat.title,
      description: cat.description,
      subcategories: Array.from(cat.subcategories.values()).sort((a, b) => a.id.localeCompare(b.id))
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return categoryList;
}

export function buildSearchDocs(skills) {
  return skills.map((s) => ({
    id: s.id,
    category: s.category,
    subcategory: s.subcategory,
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
