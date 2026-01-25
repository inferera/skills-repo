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
    <div className="grid gap-2.5">
      <div>
        <label className="block font-extrabold tracking-tight">Agent</label>
        <select
          className="w-full border border-border bg-white/95 rounded-[14px] px-3.5 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(15,23,42,0.05)] mt-2 focus-visible:outline-2 focus-visible:outline-accent/45 focus-visible:outline-offset-2 focus-visible:border-accent/35"
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

      <div className="text-muted text-[13px] leading-relaxed">
        Uses the planned installer CLI. If <code className="border border-black/12 bg-white/70 px-1.5 py-0.5 rounded-[8px] font-mono text-[0.92em]">--registry</code> is present, it points to this registry repo.
      </div>
    </div>
  );
}
