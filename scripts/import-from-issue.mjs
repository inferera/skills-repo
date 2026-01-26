import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function run(cmd, args, opts = {}) {
  let res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
}

function extractImportBlock(issueBody) {
  let marker = "<!-- skillhub-import:v1";
  let start = issueBody.indexOf(marker);
  if (start === -1) throw new Error("Missing import block marker: <!-- skillhub-import:v1");
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

    // Parse optional fields
    let id = typeof it.id === "string" ? it.id.trim() : undefined;
    let title = typeof it.title === "string" ? it.title.trim() : undefined;
    let tags = Array.isArray(it.tags) ? it.tags.filter(t => typeof t === "string" && t.trim()).map(t => t.trim()) : [];

    return { sourcePath, targetCategory, targetSubcategory, id, title, tags };
  });

  return {
    sourceRepo: req.sourceRepo,
    ref: req.ref,
    items
  };
}

async function copyDirChecked(srcDir, destDir, limits) {
  await fs.mkdir(destDir, { recursive: true });
  let entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (let e of entries) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === ".next" || e.name === "dist" || e.name === "out") continue;

    let src = path.join(srcDir, e.name);
    let dest = path.join(destDir, e.name);
    let st = await fs.lstat(src);

    if (st.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${src}`);

    if (st.isDirectory()) {
      await copyDirChecked(src, dest, limits);
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

    let srcSkillYaml = path.join(srcSkillDir, ".x_skill.yaml");
    let srcLegacyYaml = path.join(srcSkillDir, "skill.yaml");
    let srcSkillMd = path.join(srcSkillDir, "SKILL.md");
    try {
      try {
        await fs.access(srcSkillYaml);
      } catch {
        // Back-compat: accept legacy skill.yaml from older repos.
        srcSkillYaml = srcLegacyYaml;
        await fs.access(srcSkillYaml);
      }
      await fs.access(srcSkillMd);
    } catch {
      throw new Error(`Missing .x_skill.yaml (or legacy skill.yaml) or SKILL.md at sourcePath: ${item.sourcePath}`);
    }

    let metaRaw = await fs.readFile(srcSkillYaml, "utf8");
    let meta = YAML.parse(metaRaw);
    if (!meta || typeof meta !== "object" || typeof meta.id !== "string" || !meta.id) {
      throw new Error(`Invalid manifest (missing id): ${item.sourcePath}/${path.basename(srcSkillYaml)}`);
    }
    let skillId = meta.id;
    assertSlug("manifest id", skillId);

    let destSkillDir = path.join("skills", item.targetCategory, item.targetSubcategory, skillId);
    if (await pathExists(destSkillDir)) throw new Error(`Destination already exists: ${destSkillDir}`);

    let limits = { files: 0, bytes: 0, maxFiles: 2500, maxBytes: 50 * 1024 * 1024 };
    await copyDirChecked(srcSkillDir, destSkillDir, limits);

    // Normalize metadata filename in the registry repo.
    let destManifest = path.join(destSkillDir, ".x_skill.yaml");
    let destLegacy = path.join(destSkillDir, "skill.yaml");
    if (!(await pathExists(destManifest)) && (await pathExists(destLegacy))) {
      await fs.rename(destLegacy, destManifest);
    }
    if (await pathExists(destLegacy)) {
      // If both exist, or rename didn't happen for any reason, keep only the canonical filename.
      await fs.rm(destLegacy);
    }

    // Inject/overwrite source provenance and metadata from issue.
    meta.source = {
      ...(meta.source ?? {}),
      repo: req.sourceRepo,
      path: item.sourcePath,
      ref: req.ref,
      commit
    };

    // Add title from issue if provided and not already set
    if (item.title && !meta.title) {
      meta.title = item.title;
    }

    // Add tags from issue (merge with existing)
    if (item.tags && item.tags.length > 0) {
      const existingTags = Array.isArray(meta.tags) ? meta.tags : [];
      const allTags = [...new Set([...existingTags, ...item.tags])];
      meta.tags = allTags;
    }

    await fs.writeFile(destManifest, YAML.stringify(meta), "utf8");

    imported.push({ id: skillId, dest: destSkillDir, sourcePath: item.sourcePath });
  }

  console.log(`Imported ${imported.length} skill(s):`);
  for (let i of imported) console.log(`- ${i.id} -> ${i.dest} (from ${i.sourcePath})`);
}

await main();
