"use client";

import { useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { FilePreviewModal } from "./FilePreviewModal";
import type { FileMeta, FilePreview } from "./FilePreviewModal";

type FileTreeNode = {
  name: string;
  path: string;
  children: FileTreeNode[];
  isFile: boolean;
};

type SerializedFileMeta = {
  path: string;
  name: string;
  size: number;
  ext: string;
  githubUrl: string;
  preview: FilePreview;
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

function countFiles(node: FileTreeNode): number {
  if (node.isFile) return 1;
  let total = 0;
  for (const child of node.children) total += countFiles(child);
  return total;
}

// File icon based on extension
function FileIcon({ ext }: { ext: string }) {
  const e = ext?.toLowerCase() ?? "";
  if (e === ".md") {
    return (
      <svg style={{ width: "16px", height: "16px", color: "#3b82f6", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    );
  }
  if (e === ".csv") {
    return (
      <svg style={{ width: "16px", height: "16px", color: "#22c55e", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h2M8 17h2M14 13h2M14 17h2" />
      </svg>
    );
  }
  if ([".js", ".ts", ".tsx", ".jsx", ".py", ".json", ".yaml", ".yml"].includes(e)) {
    return (
      <svg style={{ width: "16px", height: "16px", color: "#f59e0b", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M10 12l-2 2 2 2M14 12l2 2-2 2" />
      </svg>
    );
  }
  return (
    <svg style={{ width: "16px", height: "16px", color: "var(--color-text-muted)", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function FolderNode({
  node,
  fileMeta,
  onFileClick,
  depth
}: {
  node: FileTreeNode;
  fileMeta: Map<string, SerializedFileMeta>;
  onFileClick: (file: FileMeta) => void;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 8px",
          paddingLeft: `${depth * 16 + 8}px`,
          background: "transparent",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          textAlign: "left",
          transition: "background-color 150ms",
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-card)"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
      >
        <svg
          style={{
            width: "14px",
            height: "14px",
            color: "var(--color-text-muted)",
            flexShrink: 0,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms",
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <svg style={{ width: "16px", height: "16px", color: "var(--color-accent)", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span className="text-foreground" style={{ fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
        <span className="text-muted" style={{ marginLeft: "auto", fontSize: "12px", flexShrink: 0 }}>
          {t("fileTree.filesCount", { count: countFiles(node) })}
        </span>
      </button>
      {isOpen && (
        <ul style={{ margin: 0, padding: 0 }}>
          {node.children.map((child) =>
            child.isFile ? (
              <FileNode key={child.path} node={child} fileMeta={fileMeta} onFileClick={onFileClick} depth={depth + 1} />
            ) : (
              <FolderNode key={child.path} node={child} fileMeta={fileMeta} onFileClick={onFileClick} depth={depth + 1} />
            )
          )}
        </ul>
      )}
    </li>
  );
}

function FileNode({
  node,
  fileMeta,
  onFileClick,
  depth
}: {
  node: FileTreeNode;
  fileMeta: Map<string, SerializedFileMeta>;
  onFileClick: (file: FileMeta) => void;
  depth: number;
}) {
  const meta = fileMeta.get(node.path);
  const size = meta?.size ?? 0;
  const isSkillMd = node.path === "SKILL.md";
  const { t } = useI18n();

  const handleClick = () => {
    if (meta && !isSkillMd) {
      onFileClick(meta);
    }
  };

  if (isSkillMd) {
    return (
      <li style={{ listStyle: "none" }}>
        <a
          href="#instructions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 8px",
            paddingLeft: `${depth * 16 + 30}px`,
            borderRadius: "6px",
            textDecoration: "none",
            transition: "background-color 150ms",
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-card)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          <FileIcon ext={meta?.ext ?? ""} />
          <span className="text-foreground" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: 500,
              color: "var(--color-accent)",
              backgroundColor: "var(--color-accent-muted)",
              marginLeft: "4px",
            }}
          >
            {t("fileTree.instructions")}
          </span>
          <span className="text-muted" style={{ marginLeft: "auto", fontSize: "12px", flexShrink: 0 }}>
            {formatBytes(size)}
          </span>
        </a>
      </li>
    );
  }

  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 8px",
          paddingLeft: `${depth * 16 + 30}px`,
          background: "transparent",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          textAlign: "left",
          transition: "background-color 150ms",
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-card)"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
      >
        <FileIcon ext={meta?.ext ?? ""} />
        <span className="text-foreground" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
        <span className="text-muted" style={{ marginLeft: "auto", fontSize: "12px", flexShrink: 0 }}>
          {formatBytes(size)}
        </span>
      </button>
    </li>
  );
}

export function FileTreeClient({
  tree,
  fileMeta
}: {
  tree: FileTreeNode[];
  fileMeta: SerializedFileMeta[];
}) {
  const [selectedFile, setSelectedFile] = useState<FileMeta | null>(null);

  const fileMetaMap = new Map(fileMeta.map((f) => [f.path, f]));

  return (
    <>
      <ul style={{ margin: 0, padding: 0, fontFamily: "var(--font-mono)", fontSize: "14px" }}>
        {tree.map((node) =>
          node.isFile ? (
            <FileNode key={node.path} node={node} fileMeta={fileMetaMap} onFileClick={setSelectedFile} depth={0} />
          ) : (
            <FolderNode key={node.path} node={node} fileMeta={fileMetaMap} onFileClick={setSelectedFile} depth={0} />
          )
        )}
      </ul>

      <FilePreviewModal file={selectedFile} onClose={() => setSelectedFile(null)} />
    </>
  );
}
