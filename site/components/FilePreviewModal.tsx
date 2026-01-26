"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export type FilePreview =
  | { kind: "skip"; reason: string }
  | { kind: "binary"; reason: string }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "markdown"; text: string; truncated: boolean }
  | { kind: "csv"; headers: string[]; rows: string[][]; truncated: boolean };

export type FileMeta = {
  path: string;
  name: string;
  size: number;
  ext: string;
  githubUrl: string;
  preview: FilePreview;
};

const MARKDOWN_COMPONENTS: Components = {
  table({ node, ...props }) {
    void node;
    return (
      <div className="markdown-table-wrap">
        <table {...props} />
      </div>
    );
  }
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const num = i === 0 ? `${Math.round(v)}` : v.toFixed(v >= 10 ? 1 : 2);
  return `${num} ${units[i]}`;
}

export function FilePreviewModal({
  file,
  onClose
}: {
  file: FileMeta | null;
  onClose: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (file) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [file, handleKeyDown]);

  if (!file) return null;

  const preview = file.preview;

  const modalContent = (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div
        className="modal-content bg-card border-border"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          borderRadius: "16px",
          border: "1px solid var(--color-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="bg-background-secondary"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <div
              className="bg-accent-muted"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg className="text-accent" style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 className="text-foreground" style={{ margin: 0, fontSize: "16px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </h3>
              <div className="text-muted" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginTop: "2px" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.path}</span>
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--color-text-muted)", flexShrink: 0 }} />
                <span style={{ flexShrink: 0 }}>{formatBytes(file.size)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background-color 150ms",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-card-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            aria-label="Close"
          >
            <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {preview.kind === "skip" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", textAlign: "center" }}>
              <div className="bg-background-secondary" style={{ width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <svg className="text-muted" style={{ width: "32px", height: "32px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <p className="text-secondary" style={{ margin: 0 }}>{preview.reason}</p>
            </div>
          )}

          {preview.kind === "binary" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", textAlign: "center" }}>
              <div className="bg-background-secondary" style={{ width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <svg className="text-muted" style={{ width: "32px", height: "32px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <p className="text-secondary" style={{ margin: 0 }}>{preview.reason}</p>
            </div>
          )}

          {preview.kind === "csv" && (
            <div>
              <div className="bg-background-secondary border-border" style={{ overflow: "auto", border: "1px solid var(--color-border)", borderRadius: "12px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th
                          key={`h-${i}`}
                          className="text-foreground bg-card"
                          style={{
                            position: "sticky",
                            top: 0,
                            padding: "12px 16px",
                            borderBottom: "1px solid var(--color-border)",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                        >
                          {h || `col_${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, idx) => (
                      <tr key={`r-${idx}`}>
                        {preview.headers.map((_, i) => (
                          <td
                            key={`r-${idx}-c-${i}`}
                            className="text-secondary"
                            style={{
                              padding: "12px 16px",
                              borderTop: "1px solid var(--color-border)",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r[i] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.truncated && (
                <p className="text-muted" style={{ margin: "12px 0 0", fontSize: "14px", textAlign: "center" }}>Preview truncated. View full file on GitHub.</p>
              )}
            </div>
          )}

          {preview.kind === "markdown" && (
            <div>
              <article className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                  {preview.text}
                </ReactMarkdown>
              </article>
              {preview.truncated && (
                <p className="text-muted" style={{ margin: "12px 0 0", fontSize: "14px", textAlign: "center" }}>Preview truncated. View full file on GitHub.</p>
              )}
            </div>
          )}

          {preview.kind === "text" && (
            <div>
              <pre style={{
                overflow: "auto",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                borderRadius: "12px",
                padding: "20px",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                lineHeight: 1.6,
                margin: 0,
              }}>
                <code>{preview.text}</code>
              </pre>
              {preview.truncated && (
                <p className="text-muted" style={{ margin: "12px 0 0", fontSize: "14px", textAlign: "center" }}>Preview truncated. View full file on GitHub.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="bg-background-secondary"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "16px 20px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="text-muted bg-card border-border"
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                border: "1px solid var(--color-border)",
              }}
            >
              {file.ext || "file"}
            </span>
            {preview.kind !== "skip" && preview.kind !== "binary" && "truncated" in preview && preview.truncated && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "#d97706",
                  backgroundColor: "rgba(217, 119, 6, 0.1)",
                  border: "1px solid rgba(217, 119, 6, 0.2)",
                }}
              >
                Truncated
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {file.githubUrl && (
              <a
                href={file.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-accent"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: 500,
                  fontSize: "14px",
                  textDecoration: "none",
                  transition: "background-color 150ms",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-accent-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--color-accent)"}
              >
                <svg style={{ width: "16px", height: "16px" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                View on GitHub
              </a>
            )}
            <button
              onClick={onClose}
              className="text-foreground bg-card border-border"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer",
                border: "1px solid var(--color-border)",
                transition: "border-color 150ms",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-border-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--color-border)"}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
