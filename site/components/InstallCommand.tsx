"use client";

import { useState } from "react";

type Agent = "claude" | "codex" | "opencode" | "cursor" | "antigravity";
type Scope = "project" | "global";

const AGENTS: Record<Agent, { label: string; dir: string }> = {
  claude: { label: "Claude Code", dir: ".claude/skills" },
  codex: { label: "Codex", dir: ".codex/skills" },
  opencode: { label: "OpenCode", dir: ".opencode/skills" },
  cursor: { label: "Cursor", dir: ".cursor/skills" },
  antigravity: { label: "Antigravity", dir: ".antigravity/skills" },
};

interface InstallCommandProps {
  skillId: string;
  category: string;
  subcategory: string;
  repoUrl?: string;
}

export function InstallCommand({
  skillId,
  category,
  subcategory,
  repoUrl = "https://github.com/xue1213888/skills-repo"
}: InstallCommandProps) {
  const [agent, setAgent] = useState<Agent>("claude");
  const [scope, setScope] = useState<Scope>("project");
  const [copied, setCopied] = useState(false);

  const agentConfig = AGENTS[agent];
  const installPath = scope === "project" ? agentConfig.dir : `~/${agentConfig.dir}`;

  // Extract repo slug from URL
  const repoSlug = repoUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  const skillPath = `skills/${category}/${subcategory}/${skillId}`;

  // Generate install command using curl and tar
  const command = `# Install ${skillId} to ${installPath}
mkdir -p "${agentConfig.dir}/${skillId}"
curl -sL "${repoUrl}/archive/refs/heads/main.tar.gz" | \\
  tar -xz --strip-components=5 \\
  "${repoSlug.replace("/", "-")}-main/${skillPath}" \\
  --exclude=".x_skill.yaml" \\
  -C "${agentConfig.dir}/${skillId}/"`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Agent Selection */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Agent</label>
        <select
          className="w-full h-11 px-4 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors"
          value={agent}
          onChange={(e) => setAgent(e.target.value as Agent)}
        >
          {Object.entries(AGENTS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Scope Selection */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Scope</label>
        <div className="flex gap-3">
          <button
            type="button"
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
              scope === "project"
                ? "bg-accent text-white"
                : "bg-card border border-border text-foreground hover:bg-card-hover"
            }`}
            onClick={() => setScope("project")}
          >
            Project
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
              scope === "global"
                ? "bg-accent text-white"
                : "bg-card border border-border text-foreground hover:bg-card-hover"
            }`}
            onClick={() => setScope("global")}
          >
            Global
          </button>
        </div>
      </div>

      {/* Install Path */}
      <div className="p-3 bg-background-secondary rounded-lg border border-border">
        <p className="text-xs text-muted mb-1">Install to:</p>
        <p className="text-sm font-mono text-accent">{installPath}/{skillId}</p>
      </div>

      {/* Install Command */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Install Command</label>
        <div className="relative">
          <pre className="bg-[#0d1117] text-[#e6edf3] p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap break-all">
            {command}
          </pre>
          <button
            type="button"
            className="absolute top-3 right-3 p-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] transition-colors"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[#e6edf3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="text-sm text-secondary">
        <p>This copies the skill files to the {scope} skills directory for {agentConfig.label}. The{" "}
          <code className="px-1.5 py-0.5 rounded bg-background-secondary text-accent font-mono text-xs">
            .x_skill.yaml
          </code>{" "}
          file is excluded (internal metadata).
        </p>
      </div>
    </div>
  );
}

