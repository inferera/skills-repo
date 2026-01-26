"use client";

import { useMemo, useState } from "react";

import { REPO_REF, REPO_SLUG, REPO_URL } from "@/lib/config";

import { CommandBlockClient } from "@/components/CommandBlockClient";

// Agent configurations
// Each agent has its own directory structure for skills
const AGENTS = [
  {
    id: "codex",
    label: "Codex",
    projectDir: ".codex/skills",
    globalDir: "~/.codex/skills",
  },
  {
    id: "claude",
    label: "Claude Code",
    projectDir: ".claude/skills",
    globalDir: "~/.claude/skills",
  },
  {
    id: "opencode",
    label: "OpenCode",
    projectDir: ".opencode/skills",
    globalDir: "~/.opencode/skills",
  },
  {
    id: "cursor",
    label: "Cursor",
    projectDir: ".cursor/skills",
    globalDir: "~/.cursor/skills",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    projectDir: ".antigravity/skills",
    globalDir: "~/.antigravity/skills",
  },
];

type InstallScope = "project" | "global";
type InstallMethod = "npx" | "curl";

export function QuickInstallClient({
  skillId,
  repoPath,
  declaredAgents
}: {
  skillId: string;
  repoPath?: string;
  declaredAgents?: string[];
}) {
  const declared = useMemo(() => new Set((declaredAgents ?? []).filter(Boolean)), [declaredAgents]);
  const defaultAgent = declaredAgents?.find((a) => AGENTS.some((x) => x.id === a)) ?? "codex";
  const [agent, setAgent] = useState(defaultAgent);
  const [scope, setScope] = useState<InstallScope>("project");
  const [method, setMethod] = useState<InstallMethod>("npx");

  const agentConfig = AGENTS.find((a) => a.id === agent) ?? AGENTS[0];
  const targetDir = scope === "project" ? agentConfig.projectDir : agentConfig.globalDir;

  // Generate the installation command
  const cmd = useMemo(() => {
    if (!REPO_URL || !REPO_SLUG) {
      return `# Registry URL not configured`;
    }

    if (method === "npx") {
      // NPX method using GitHub
      const scopeFlag = scope === "global" ? " --scope global" : "";
      const refFlag = REPO_REF && REPO_REF !== "main" ? ` --ref ${REPO_REF}` : "";
      return `# Install ${skillId} to ${targetDir}
npx github:${REPO_SLUG} add ${skillId} --agent ${agent}${scopeFlag}${refFlag}`;
    } else {
      // Curl + tar method (portable across GitHub + BSD/GNU tar)
      if (!repoPath) return `# Missing repoPath for ${skillId}`;

      const repoName = REPO_SLUG.split("/")[1] ?? "";
      const safeRef = REPO_REF.replaceAll("/", "-");
      const archiveRoot = `${repoName}-${safeRef}`;
      const skillPath = repoPath;

      const pathParts = skillPath.split("/").filter(Boolean);
      const stripComponents = pathParts.length + 1;

      const tarballUrl = `https://codeload.github.com/${REPO_SLUG}/tar.gz/${encodeURIComponent(REPO_REF)}`;
      const memberPath = `${archiveRoot}/${skillPath}`;

      return [
        `# Install ${skillId} to ${targetDir}`,
        `mkdir -p "${targetDir}/${skillId}"`,
        `curl -fsSL "${tarballUrl}" | \\`,
        `  tar -xz -f - --strip-components=${stripComponents} \\`,
        `  --exclude=".x_skill.yaml" \\`,
        `  -C "${targetDir}/${skillId}/" \\`,
        `  "${memberPath}"`
      ].join("\n");
    }
  }, [skillId, repoPath, targetDir, agent, scope, method]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Method selector */}
      <div>
        <label className="text-foreground" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
          Method
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setMethod("npx")}
            className={method === "npx" ? "bg-accent" : "bg-background-secondary border-border"}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: method === "npx" ? "none" : "1px solid var(--color-border)",
              color: method === "npx" ? "white" : "var(--color-text)",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            NPX (Recommended)
          </button>
          <button
            type="button"
            onClick={() => setMethod("curl")}
            className={method === "curl" ? "bg-accent" : "bg-background-secondary border-border"}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: method === "curl" ? "none" : "1px solid var(--color-border)",
              color: method === "curl" ? "white" : "var(--color-text)",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            One-Line Curl
          </button>
        </div>
      </div>

      {/* Agent selector */}
      <div>
        <label className="text-foreground" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
          Agent
        </label>
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="text-foreground bg-background-secondary border-border"
          style={{
            width: "100%",
            height: "40px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {declared.size > 0 && !declared.has(a.id) ? " (not declared)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Scope selector */}
      <div>
        <label className="text-foreground" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
          Scope
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setScope("project")}
            className={scope === "project" ? "bg-accent" : "bg-background-secondary border-border"}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: scope === "project" ? "none" : "1px solid var(--color-border)",
              color: scope === "project" ? "white" : "var(--color-text)",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            Project
          </button>
          <button
            type="button"
            onClick={() => setScope("global")}
            className={scope === "global" ? "bg-accent" : "bg-background-secondary border-border"}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: scope === "global" ? "none" : "1px solid var(--color-border)",
              color: scope === "global" ? "white" : "var(--color-text)",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            Global
          </button>
        </div>
      </div>

      {/* Target directory display */}
      <div
        className="bg-background-secondary border-border"
        style={{
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="text-muted" style={{ fontSize: "12px", marginBottom: "4px" }}>
          Install to:
        </div>
        <code className="text-accent" style={{ fontSize: "13px", fontFamily: "var(--font-mono)" }}>
          {targetDir}/{skillId}
        </code>
      </div>

      {/* Install command */}
      <div>
        <label className="text-foreground" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
          Install Command
        </label>
        <CommandBlockClient command={cmd} />
      </div>

      {/* Note */}
      <p className="text-muted" style={{ fontSize: "12px", margin: 0, lineHeight: 1.5 }}>
        {method === "npx" ? (
          <>
            Uses <code className="text-accent" style={{ fontSize: "11px", padding: "1px 4px", borderRadius: "4px", backgroundColor: "var(--color-accent-muted)" }}>npx</code> to install directly from GitHub.
            No npm installation required. The <code className="text-accent" style={{ fontSize: "11px", padding: "1px 4px", borderRadius: "4px", backgroundColor: "var(--color-accent-muted)" }}>.x_skill.yaml</code> file is excluded (internal metadata).
          </>
        ) : (
          <>
            This copies the skill files to the {scope === "project" ? "project" : "global"} skills directory for {agentConfig.label}.
            The <code className="text-accent" style={{ fontSize: "11px", padding: "1px 4px", borderRadius: "4px", backgroundColor: "var(--color-accent-muted)" }}>.x_skill.yaml</code> file is excluded (internal metadata).
          </>
        )}
      </p>
    </div>
  );
}
