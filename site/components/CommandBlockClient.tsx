"use client";

import { useState } from "react";

export function CommandBlockClient({ command }: { command: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1200);
    }
  }

  return (
    <div className="flex items-start gap-2.5">
      <pre
        className="flex-1 min-w-0 overflow-x-auto border border-border bg-[rgba(11,11,16,0.92)] text-white/92 rounded-[14px] px-3.5 py-3.5 font-mono text-[12.5px] leading-relaxed m-0 whitespace-pre-wrap break-words"
        aria-label="Command"
      >
        <code>{command}</code>
      </pre>
      <button
        className="inline-flex items-center justify-center gap-2.5 px-2.5 py-2 rounded-[10px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm text-[13px]"
        type="button"
        onClick={() => void onCopy()}
      >
        {status === "copied" ? "Copied" : status === "error" ? "Copy failed" : "Copy"}
      </button>
    </div>
  );
}
