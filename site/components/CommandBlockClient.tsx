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
    <div className="commandWrap">
      <pre className="codeBlock command" aria-label="Command">
        <code>{command}</code>
      </pre>
      <button className="btn small" type="button" onClick={() => void onCopy()}>
        {status === "copied" ? "Copied" : status === "error" ? "Copy failed" : "Copy"}
      </button>
    </div>
  );
}
