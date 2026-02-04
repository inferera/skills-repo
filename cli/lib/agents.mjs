import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FALLBACK_AGENTS = {
  claude: { label: "Claude Code", projectDir: ".claude/skills", globalDir: path.join(os.homedir(), ".claude/skills") },
  codex: { label: "Codex", projectDir: ".codex/skills", globalDir: path.join(os.homedir(), ".codex/skills") },
  opencode: { label: "OpenCode", projectDir: ".opencode/skills", globalDir: path.join(os.homedir(), ".opencode/skills") },
  cursor: { label: "Cursor", projectDir: ".cursor/skills", globalDir: path.join(os.homedir(), ".cursor/skills") },
  antigravity: {
    label: "Antigravity",
    projectDir: ".antigravity/skills",
    globalDir: path.join(os.homedir(), ".antigravity/skills")
  }
};

function expandTilde(p) {
  if (typeof p !== "string") return "";
  const v = p.trim();
  if (!v) return "";
  if (v === "~") return os.homedir();
  if (v.startsWith("~/")) return path.join(os.homedir(), v.slice(2));
  if (v.startsWith("~\\")) return path.join(os.homedir(), v.slice(2));
  return v;
}

function resolveGlobalDir(globalDir) {
  const expanded = expandTilde(globalDir);
  if (!expanded) return "";
  if (path.isAbsolute(expanded)) return expanded;
  return path.join(os.homedir(), expanded);
}

function normalizeAgentsConfig(json) {
  const agents = json?.agents;
  if (!Array.isArray(agents)) return null;

  const out = {};
  for (const a of agents) {
    const id = typeof a?.id === "string" ? a.id.trim() : "";
    const label = typeof a?.label === "string" ? a.label.trim() : "";
    const projectDir = typeof a?.projectDir === "string" ? a.projectDir.trim() : "";
    const globalDirRaw = typeof a?.globalDir === "string" ? a.globalDir.trim() : "";
    if (!id || !label || !projectDir || !globalDirRaw) continue;

    const globalDir = resolveGlobalDir(globalDirRaw);
    if (!globalDir) continue;

    out[id] = { label, projectDir, globalDir };
  }

  return Object.keys(out).length > 0 ? out : null;
}

async function loadAgents() {
  const configPath = path.resolve(__dirname, "..", "..", "registry", "agents.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const json = JSON.parse(raw);
    const normalized = normalizeAgentsConfig(json);
    if (normalized) return normalized;
  } catch (err) {
    if (err?.code !== 'ENOENT' && !(err instanceof SyntaxError)) {
      console.warn(`Warning: failed to load agents config: ${err.message}`);
    }
  }

  return FALLBACK_AGENTS;
}

export const AGENTS = await loadAgents();
