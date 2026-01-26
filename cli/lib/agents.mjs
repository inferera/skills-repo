import path from "node:path";
import os from "node:os";

export const AGENTS = {
  claude: {
    label: "Claude Code",
    projectDir: ".claude/skills",
    globalDir: path.join(os.homedir(), ".claude/skills")
  },
  codex: {
    label: "Codex",
    projectDir: ".codex/skills",
    globalDir: path.join(os.homedir(), ".codex/skills")
  },
  opencode: {
    label: "OpenCode",
    projectDir: ".opencode/skills",
    globalDir: path.join(os.homedir(), ".opencode/skills")
  },
  cursor: {
    label: "Cursor",
    projectDir: ".cursor/skills",
    globalDir: path.join(os.homedir(), ".cursor/skills")
  },
  antigravity: {
    label: "Antigravity",
    projectDir: ".antigravity/skills",
    globalDir: path.join(os.homedir(), ".antigravity/skills")
  }
};

