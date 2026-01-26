import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fg from "fast-glob";
import YAML from "yaml";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Parse SKILL.md frontmatter (YAML between --- markers)
function parseSkillMdFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return {};

  const frontmatter = lines.slice(1, endIndex).join("\n");
  const result = {};

  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);

  if (titleMatch) result.title = titleMatch[1];
  if (descMatch) result.description = descMatch[1];

  return result;
}

// Extract first paragraph as description (after frontmatter and title)
function extractDescriptionFromMarkdown(content) {
  // Strip frontmatter
  let md = content;
  if (md.startsWith("---\n")) {
    const end = md.indexOf("\n---\n", 4);
    if (end !== -1) {
      md = md.slice(end + 5);
    }
  }

  md = md.trim();
  if (!md) return "";

  const lines = md.split("\n");

  // Skip leading title (# ...)
  if (lines[0]?.startsWith("#")) {
    lines.shift();
    while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  }

  // Get first paragraph
  const para = [];
  for (const line of lines) {
    if (line.trim() === "") break;
    para.push(line);
  }

  const text = para.join(" ").trim();
  return text;
}

function run(cmd, args, opts = {}) {
  let res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
}

function extractImportBlock(issueBody) {
  let marker = "<!-- skillhub-import:v2";
  let start = issueBody.indexOf(marker);
  // Fallback to v1 for backward compatibility
  if (start === -1) {
    marker = "<!-- skillhub-import:v1";
    start = issueBody.indexOf(marker);
  }
  if (start === -1) throw new Error("Missing import block marker: <!-- skillhub-import:v2 (or v1)");
  let end = issueBody.indexOf("-->", start);
  if (end === -1) throw new Error("Missing import block terminator: -->");
  let inner = issueBody.slice(start + marker.length, end).trim();
  if (!inner) throw new Error("Empty import block");
  return inner;
}

function assertSlug(label, value) {
  if (typeof value !== "string" || !SLUG_RE.test(value)) {
    throw new Error(`${label} must match ${SLUG_RE}: ${String(value)}`);
  }
}

function normalizeSourcePath(p) {
  if (typeof p !== "string" || p.length === 0) return ".";
  let v = p.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!v) return ".";
  if (v.includes("..")) throw new Error(`Invalid sourcePath (.. not allowed): ${p}`);
  return v;
}

function parseRequest(issueBody) {
  let yamlText = extractImportBlock(issueBody);
  let req = YAML.parse(yamlText);

  if (!req || typeof req !== "object") throw new Error("Import block is not a YAML object");
  if (typeof req.sourceRepo !== "string" || !req.sourceRepo.startsWith("https://github.com/")) {
    throw new Error(`sourceRepo must be a https://github.com/... URL. Got: ${String(req.sourceRepo)}`);
  }
  if (typeof req.ref !== "string" || !req.ref.trim()) throw new Error("ref is required");
  if (!Array.isArray(req.items) || req.items.length === 0) throw new Error("items must be a non-empty list");
  if (req.items.length > 20) throw new Error("Too many items (max 20 per request)");

  let items = req.items.map((it, idx) => {
    if (!it || typeof it !== "object") throw new Error(`items[${idx}] must be an object`);

    let sourcePath = normalizeSourcePath(it.sourcePath ?? ".");
    let targetCategory = it.targetCategory;
    let targetSubcategory = it.targetSubcategory;
    assertSlug(`items[${idx}].targetCategory`, targetCategory);
    assertSlug(`items[${idx}].targetSubcategory`, targetSubcategory);

    // Required fields for .x_skill.yaml generation
    let id = typeof it.id === "string" ? it.id.trim() : undefined;
    if (!id) throw new Error(`items[${idx}].id is required`);
    assertSlug(`items[${idx}].id`, id);

    let title = typeof it.title === "string" ? it.title.trim() : id;

    // Optional fields
    let tags = Array.isArray(it.tags) ? it.tags.filter(t => typeof t === "string" && t.trim()).map(t => t.trim()) : [];
    let isUpdate = it.isUpdate === true || it.isUpdate === "true";

    return { sourcePath, targetCategory, targetSubcategory, id, title, tags, isUpdate };
  });

  return {
    sourceRepo: req.sourceRepo,
    ref: req.ref,
    items
  };
}

async function copyDirChecked(srcDir, destDir, limits, excludePatterns = []) {
  await fs.mkdir(destDir, { recursive: true });
  let entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (let e of entries) {
    // Skip common non-skill directories and files
    if (e.name === ".git" || e.name === "node_modules" || e.name === ".next" || e.name === "dist" || e.name === "out") continue;
    // Skip .x_skill.yaml and skill.yaml from source (we generate our own)
    if (e.name === ".x_skill.yaml" || e.name === "skill.yaml") continue;
    // Skip any excluded patterns
    if (excludePatterns.some(p => e.name === p || e.name.match(new RegExp(p)))) continue;

    let src = path.join(srcDir, e.name);
    let dest = path.join(destDir, e.name);

    let st = await fs.lstat(src);
    if (st.isSymbolicLink()) {
      console.warn(`⚠️  Skipping symlink: ${src}`);
      continue;
    }

    if (st.isDirectory()) {
      await copyDirChecked(src, dest, limits, excludePatterns);
      continue;
    }

    if (!st.isFile()) continue;

    limits.files += 1;
    limits.bytes += st.size;
    if (limits.files > limits.maxFiles) throw new Error(`Import too large: file limit exceeded (${limits.maxFiles})`);
    if (limits.bytes > limits.maxBytes) throw new Error(`Import too large: byte limit exceeded (${limits.maxBytes})`);

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let issueBody = process.env.ISSUE_BODY ?? "";
  if (!issueBody.trim()) throw new Error("ISSUE_BODY is empty (workflow must pass github.event.issue.body)");

  let req = parseRequest(issueBody);

  let tmp = await fs.mkdtemp(path.join(os.tmpdir(), "skillhub-import-"));
  let srcRepoDir = path.join(tmp, "source");

  console.log(`Cloning ${req.sourceRepo} @ ${req.ref}`);
  try {
    run("git", ["clone", "--depth", "1", "--branch", req.ref, req.sourceRepo, srcRepoDir]);
  } catch {
    run("git", ["clone", req.sourceRepo, srcRepoDir]);
    run("git", ["-C", srcRepoDir, "checkout", req.ref]);
  }

  let commitSha = spawnSync("git", ["-C", srcRepoDir, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (commitSha.status !== 0) throw new Error("Failed to resolve source commit SHA");
  let commit = (commitSha.stdout ?? "").trim();

  let imported = [];

  for (let item of req.items) {
    let srcSkillDir = item.sourcePath === "." ? srcRepoDir : path.join(srcRepoDir, item.sourcePath);
    let srcSkillMd = path.join(srcSkillDir, "SKILL.md");

    // Only require SKILL.md to exist
    if (!(await pathExists(srcSkillMd))) {
      throw new Error(`Missing SKILL.md at sourcePath: ${item.sourcePath}`);
    }

    // Read SKILL.md and extract description
    let skillMdContent = await fs.readFile(srcSkillMd, "utf8");
    let frontmatter = parseSkillMdFrontmatter(skillMdContent);
    let description = frontmatter.description || extractDescriptionFromMarkdown(skillMdContent);
    if (!description) {
      description = item.title; // Fallback to title if no description found
    }

    let destSkillDir = path.join("skills", item.targetCategory, item.targetSubcategory, item.id);

    // If updating, find and remove any existing skill with the same ID (even in different category)
    if (item.isUpdate) {
      // Use fast-glob to find all skills with matching ID
      const existingSkills = await fg([`skills/*/*/${item.id}/.x_skill.yaml`], { onlyFiles: true, dot: true });

      for (const existingPath of existingSkills) {
        const existingDir = existingPath.replace(/\/.x_skill\.yaml$/, "");

        // Only remove if it's different from the destination
        if (existingDir !== destSkillDir) {
          console.log(`Removing old skill location: ${existingDir}`);
          await fs.rm(existingDir, { recursive: true });
        }
      }

      // Also remove destination if it exists
      if (await pathExists(destSkillDir)) {
        console.log(`Updating existing skill: ${destSkillDir}`);
        await fs.rm(destSkillDir, { recursive: true });
      }
    } else {
      // For new skills, check if destination already exists
      if (await pathExists(destSkillDir)) {
        throw new Error(`Destination already exists: ${destSkillDir}. Set isUpdate: true to update.`);
      }

      // Also check if this ID exists anywhere else
      const existingSkills = await fg([`skills/*/*/${item.id}/.x_skill.yaml`], { onlyFiles: true, dot: true });
      if (existingSkills.length > 0) {
        throw new Error(`Skill with ID "${item.id}" already exists at: ${existingSkills[0].replace(/\/.x_skill\.yaml$/, "")}. Set isUpdate: true to update.`);
      }
    }

    let limits = { files: 0, bytes: 0, maxFiles: 2500, maxBytes: 50 * 1024 * 1024 };
    await copyDirChecked(srcSkillDir, destSkillDir, limits);

    // Generate .x_skill.yaml from issue content + SKILL.md description
    let meta = {
      specVersion: 1,
      id: item.id,
      title: item.title,
      description: description,
      tags: item.tags.length > 0 ? item.tags : undefined,
      links: {
        docs: "./SKILL.md"
      },
      source: {
        repo: req.sourceRepo,
        path: item.sourcePath,
        ref: req.ref,
        commit
      }
    };

    // Remove undefined fields
    Object.keys(meta).forEach(key => {
      if (meta[key] === undefined) delete meta[key];
    });

    let destManifest = path.join(destSkillDir, ".x_skill.yaml");
    await fs.writeFile(destManifest, YAML.stringify(meta), "utf8");

    imported.push({ id: item.id, dest: destSkillDir, sourcePath: item.sourcePath, isUpdate: item.isUpdate });
  }

  console.log(`Imported ${imported.length} skill(s):`);
  for (let i of imported) console.log(`- ${i.id} -> ${i.dest} (from ${i.sourcePath})${i.isUpdate ? " [UPDATE]" : ""}`);
}

await main();
