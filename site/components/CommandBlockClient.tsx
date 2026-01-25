"use client";

import { useState } from "react";

export function CommandBlockClient({ command }: { command: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1500);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <pre className="flex-1 min-w-0 overflow-x-auto bg-[#0f172a] text-[#e2e8f0] rounded-lg px-4 py-3 font-mono text-sm m-0">
        <code>{command}</code>
      </pre>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="flex items-center justify-center px-3 bg-card border border-border rounded-lg hover:bg-card-hover hover:border-border-hover transition-colors"
        aria-label="Copy command"
      >
        {status === "copied" ? (
          <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        ) : status === "error" ? (
          <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        )}
      </button>
    </div>
  );
}
