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
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Agent</label>
        <select
          className="w-full h-10 px-3 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {declared.size > 0 && !declared.has(a.id) ? " (not declared)" : ""}
            </option>
          ))}
        </select>
      </div>

      <CommandBlockClient command={cmd} />

      <p className="text-xs text-muted">
        Uses the planned installer CLI. The <code className="px-1 py-0.5 rounded bg-accent-muted text-accent text-[0.9em]">--registry</code> flag points to this registry.
      </p>
    </div>
  );
}
