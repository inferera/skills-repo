"use client";

import { useMemo, useState } from "react";

import { REPO_SLUG } from "@/lib/config";

import { CommandBlockClient } from "@/components/CommandBlockClient";

const AGENTS: Array<{ id: string; label: string }> = [
  { id: "codex", label: "Codex" },
  { id: "claude-code", label: "Claude Code" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "opencode", label: "OpenCode" }
];

export function QuickInstallClient({ skillId, declaredAgents }: { skillId: string; declaredAgents?: string[] }) {
  const declared = useMemo(() => new Set((declaredAgents ?? []).filter(Boolean)), [declaredAgents]);
  const defaultAgent = declaredAgents?.find((a) => AGENTS.some((x) => x.id === a)) ?? "codex";
  const [agent, setAgent] = useState(defaultAgent);

  const cmd = useMemo(() => {
    const parts = ["npx", "skillhub@latest", "add", skillId, "--agent", agent];
    if (REPO_SLUG) parts.push("--registry", REPO_SLUG);
    return parts.join(" ");
  }, [agent, skillId]);

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div>
        <label style={{ display: "block", fontWeight: 800, letterSpacing: "-0.01em" }}>Agent</label>
        <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)} style={{ marginTop: 8 }}>
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {declared.size > 0 && !declared.has(a.id) ? " (not declared)" : ""}
            </option>
          ))}
        </select>
      </div>

      <CommandBlockClient command={cmd} />

      <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
        Uses the planned installer CLI. If <code>--registry</code> is present, it points to this registry repo.
      </div>
    </div>
  );
}

