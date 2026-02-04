import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeGitUrl(url) {
  if (typeof url !== "string") return "";
  let v = url.trim();
  if (!v) return "";
  v = v.replace(/^git\+/, "");
  v = v.replace(/\.git$/, "");
  return v;
}

export function normalizeRegistryUrl(url) {
  const v = normalizeGitUrl(url);
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

export async function getDefaultRegistryUrl() {
  const fromEnv = normalizeRegistryUrl(process.env.SKILL_REGISTRY_URL ?? "");
  if (fromEnv) return fromEnv;

  try {
    const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
    const raw = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    const repoUrl = normalizeRegistryUrl(pkg?.repository?.url ?? "");
    if (repoUrl) return repoUrl;
  } catch (err) {
    if (err?.code !== 'ENOENT' && !(err instanceof SyntaxError)) {
      console.warn(`Warning: failed to read package.json: ${err.message}`);
    }
  }

  return "";
}

export function getDefaultRegistryRef() {
  return (process.env.SKILL_REGISTRY_REF ?? "main").trim() || "main";
}

export async function getPackageVersion() {
  const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
  const raw = await fs.readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw);
  return String(pkg?.version ?? "").trim() || "0.0.0";
}

