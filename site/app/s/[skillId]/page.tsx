import fs from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SkillMiniCard } from "@/components/SkillMiniCard";
import { QuickInstallClient } from "@/components/QuickInstallClient";
import { REPO_URL } from "@/lib/config";
import { getSkillById, loadRegistryIndex } from "@/lib/registry";

export const dynamicParams = false;

const FILE_PREVIEW_MAX_BYTES = 80 * 1024;
const FILE_PREVIEW_MAX_CODE_LINES = 220;
const CSV_PREVIEW_MAX_ROWS = 28;
const CSV_PREVIEW_MAX_COLS = 12;

type FileTreeNode = {
  name: string;
  path: string;
  children: Map<string, FileTreeNode>;
  isFile: boolean;
};

type FilePreview =
  | { kind: "skip"; reason: string }
  | { kind: "binary"; reason: string }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "markdown"; text: string; truncated: boolean }
  | { kind: "csv"; headers: string[]; rows: string[][]; truncated: boolean };

type FileMeta = {
  path: string;
  name: string;
  size: number;
  ext: string;
  githubUrl: string;
  preview: FilePreview;
};

export async function generateStaticParams() {
  const index = await loadRegistryIndex();
  return index.skills.map((s) => ({ skillId: s.id }));
}

export async function generateMetadata({ params }: { params: { skillId: string } }): Promise<Metadata> {
  const skill = await getSkillById(params.skillId);
  if (!skill) return { title: "Skill not found" };
  return {
    title: skill.title,
    description: skill.description,
    openGraph: {
      title: skill.title,
      description: skill.description,
      type: "article"
    }
  };
}

function buildFileTree(paths: string[]) {
  const root: FileTreeNode = { name: "", path: "", children: new Map(), isFile: false };

  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let cur: FileTreeNode = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      let existing = cur.children.get(part);
      if (!existing) {
        existing = { name: part, path: acc, children: new Map(), isFile: i === parts.length - 1 };
        cur.children.set(part, existing);
      }
      cur = existing;
      if (i === parts.length - 1) cur.isFile = true;
    }
  }

  const toSorted = (n: FileTreeNode): FileTreeNode[] => {
    const dirs: FileTreeNode[] = [];
    const files: FileTreeNode[] = [];
    for (const child of n.children.values()) {
      (child.isFile ? files : dirs).push(child);
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  };

  return { root, toSorted };
}

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

function isProbablyBinary(buf: Buffer) {
  // NUL is a strong indicator of binary.
  return buf.includes(0);
}

async function readFileSnippet(filePath: string, maxBytes: number) {
  const fh = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function parseCsvPreview(input: string, maxRows: number, maxCols: number) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row.slice(0, maxCols));
    row = [];
  };

  while (i < input.length) {
    const ch = input[i]!;

    if (inQuotes) {
      if (ch === "\"") {
        // Escaped quote
        if (input[i + 1] === "\"") {
          field += "\"";
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      // Handle CRLF
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      pushField();
      pushRow();
      i += 1;
      if (rows.length >= maxRows) break;
      continue;
    }

    field += ch;
    i += 1;
  }

  if (rows.length < maxRows && (field.length > 0 || row.length > 0)) {
    pushField();
    pushRow();
  }

  const rawHeaders = rows[0] ?? [];
  const body = rows.slice(1);
  const maxSeenCols = Math.max(rawHeaders.length, ...body.map((r) => r.length), 0);
  const colCount = Math.min(maxCols, maxSeenCols);
  const headers =
    rawHeaders.length > 0 ? rawHeaders.slice(0, colCount) : Array.from({ length: colCount }, (_, idx) => `col_${idx + 1}`);
  const clippedBody = body.map((r) => r.slice(0, colCount));
  const truncated = rows.length >= maxRows || i < input.length;
  return { headers, rows: clippedBody, truncated };
}

function countFiles(node: FileTreeNode): number {
  if (node.isFile) return 1;
  let total = 0;
  for (const child of node.children.values()) total += countFiles(child);
  return total;
}

function stripHttps(url: string) {
  return url.replace(/^https?:\/\//, "");
}

export default async function SkillPage({ params }: { params: { skillId: string } }) {
  const index = await loadRegistryIndex();
  const skill = await getSkillById(params.skillId);
  if (!skill) notFound();

  const abs = path.resolve(process.cwd(), "..", skill.repoPath, "SKILL.md");
  const markdown = await fs.readFile(abs, "utf8");

  const related = index.skills
    .filter((s) => s.id !== skill.id && (s.category === skill.category || s.subcategory === skill.subcategory))
    .filter((s) => {
      if (!skill.tags?.length || !s.tags?.length) return false;
      const set = new Set(skill.tags);
      return s.tags.some((t) => set.has(t));
    })
    .slice(0, 6);

  const filePaths = (skill.files ?? []).map((f) => f.path);
  const tree = buildFileTree(filePaths);

  const skillDir = path.resolve(process.cwd(), "..", skill.repoPath);
  const fileMeta = new Map<string, FileMeta>();

  for (const p of filePaths) {
    const name = p.split("/").pop() ?? p;
    const ext = path.extname(p).toLowerCase();
    const absPath = path.join(skillDir, p);
    const githubUrl = REPO_URL ? `${REPO_URL}/blob/main/${skill.repoPath}/${p}` : "";

    let size = 0;
    try {
      const st = await fs.stat(absPath);
      size = st.size;
    } catch {
      fileMeta.set(p, {
        path: p,
        name,
        ext,
        size: 0,
        githubUrl,
        preview: { kind: "skip", reason: "Missing file on disk (unexpected during static build)." }
      });
      continue;
    }

    if (p === "SKILL.md") {
      fileMeta.set(p, { path: p, name, ext, size, githubUrl, preview: { kind: "skip", reason: "Rendered below." } });
      continue;
    }

    const buf = await readFileSnippet(absPath, FILE_PREVIEW_MAX_BYTES);
    if (isProbablyBinary(buf)) {
      fileMeta.set(p, {
        path: p,
        name,
        ext,
        size,
        githubUrl,
        preview: { kind: "binary", reason: "Binary file preview is not supported." }
      });
      continue;
    }

    const text = buf.toString("utf8");
    const truncatedByBytes = size > FILE_PREVIEW_MAX_BYTES;

    if (ext === ".csv") {
      const parsed = parseCsvPreview(text, CSV_PREVIEW_MAX_ROWS, CSV_PREVIEW_MAX_COLS);
      fileMeta.set(p, {
        path: p,
        name,
        ext,
        size,
        githubUrl,
        preview: { kind: "csv", headers: parsed.headers, rows: parsed.rows, truncated: parsed.truncated || truncatedByBytes }
      });
      continue;
    }

    if (ext === ".md") {
      const lines = text.split(/\r?\n/);
      const clipped = lines.slice(0, FILE_PREVIEW_MAX_CODE_LINES).join("\n");
      fileMeta.set(p, {
        path: p,
        name,
        ext,
        size,
        githubUrl,
        preview: { kind: "markdown", text: clipped, truncated: truncatedByBytes || lines.length > FILE_PREVIEW_MAX_CODE_LINES }
      });
      continue;
    }

    const lines = text.split(/\r?\n/);
    const clipped = lines.slice(0, FILE_PREVIEW_MAX_CODE_LINES).join("\n");
    fileMeta.set(p, {
      path: p,
      name,
      ext,
      size,
      githubUrl,
      preview: { kind: "text", text: clipped, truncated: truncatedByBytes || lines.length > FILE_PREVIEW_MAX_CODE_LINES }
    });
  }

  const sourceRepo = skill.source?.repo ?? "";
  const sourcePath = skill.source?.path ?? "";
  const sourceRef = skill.source?.ref ?? "";
  const sourceCommit = skill.source?.commit ?? "";

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260, flex: "1 1 520px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.02em" }}>{skill.title}</h1>
              <span className="chip">
                {skill.category}/{skill.subcategory}
              </span>
            </div>
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.55 }}>
              {skill.description}
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {(skill.tags ?? []).map((t) => (
                <span key={t} className="chip">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" href={`/c/${skill.category}/${skill.subcategory}`}>
              Back to list
            </Link>
            {sourceRepo ? (
              <a className="btn primary" href={sourceRepo} target="_blank" rel="noreferrer">
                Source repo
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className="skillDetailLayout">
        <div className="skillMain">
          <section className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Files</h2>
              <span className="chip">{filePaths.length} files</span>
            </div>
            <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
              Expand to preview CSV and code files. Default collapsed for scanability.
            </p>
            <div className="fileTree" style={{ marginTop: 12 }}>
              <Tree node={tree.root} toSorted={tree.toSorted} fileMeta={fileMeta} />
            </div>
          </section>

          <section className="card" style={{ padding: 18 }} id="instructions">
            <h2 style={{ margin: 0, fontSize: 18 }}>Instructions</h2>
            <div style={{ height: 10 }} />
            <article className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          </section>
        </div>

        <aside className="skillAside">
          <section className="card strong" style={{ padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Quick install</h2>
            <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
              Install this skill into a target agent environment.
            </p>
            <div style={{ height: 12 }} />
            <QuickInstallClient skillId={skill.id} declaredAgents={skill.agents} />
          </section>

          <section className="card strong" style={{ padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Metadata</h2>
            <div style={{ height: 12 }} />

            <div className="metaDl">
              <div className="metaRow">
                <span className="metaKey">id</span>
                <span className="metaVal">{skill.id}</span>
              </div>
              <div className="metaRow">
                <span className="metaKey">path</span>
                <span className="metaVal">{skill.repoPath}</span>
              </div>
              {skill.license ? (
                <div className="metaRow">
                  <span className="metaKey">license</span>
                  <span className="metaVal">{skill.license}</span>
                </div>
              ) : null}
              {(skill.runtime ?? []).length > 0 ? (
                <div className="metaRow">
                  <span className="metaKey">runtime</span>
                  <span className="metaVal">{(skill.runtime ?? []).join(", ")}</span>
                </div>
              ) : null}
              {(skill.agents ?? []).length > 0 ? (
                <div className="metaRow">
                  <span className="metaKey">agents</span>
                  <span className="metaVal">{(skill.agents ?? []).join(", ")}</span>
                </div>
              ) : null}
              {sourceRepo ? (
                <div className="metaRow">
                  <span className="metaKey">source</span>
                  <a className="metaVal" href={sourceRepo} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                    {stripHttps(sourceRepo)}
                  </a>
                </div>
              ) : null}
              {sourcePath ? (
                <div className="metaRow">
                  <span className="metaKey">sourcePath</span>
                  <span className="metaVal">{sourcePath}</span>
                </div>
              ) : null}
              {sourceRef ? (
                <div className="metaRow">
                  <span className="metaKey">ref</span>
                  <span className="metaVal">{sourceRef}</span>
                </div>
              ) : null}
              {sourceCommit ? (
                <div className="metaRow">
                  <span className="metaKey">commit</span>
                  <span className="metaVal">{sourceCommit.slice(0, 10)}</span>
                </div>
              ) : null}
            </div>
          </section>

          {related.length > 0 ? (
            <section className="card strong" style={{ padding: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Related</h2>
              <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
                Similar category + overlapping tags.
              </p>
              <div className="grid" style={{ marginTop: 12 }}>
                {related.map((s) => (
                  <SkillMiniCard key={s.id} skill={s} />
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Tree({
  node,
  toSorted,
  fileMeta
}: {
  node: FileTreeNode;
  toSorted: (n: FileTreeNode) => FileTreeNode[];
  fileMeta: Map<string, FileMeta>;
}) {
  const children = toSorted(node);
  if (children.length === 0) return null;
  return (
    <ul>
      {children.map((c) => {
        if (!c.isFile) {
          return (
            <li key={c.path}>
              <details open={false}>
                <summary>
                  <span className="fileTreeDir">{c.name}/</span>
                  <span className="fileTreeMeta">{countFiles(c)} files</span>
                </summary>
                <Tree node={c} toSorted={toSorted} fileMeta={fileMeta} />
              </details>
            </li>
          );
        }

        const meta = fileMeta.get(c.path);
        const size = meta?.size ?? 0;
        const githubUrl = meta?.githubUrl ?? "";
        const preview = meta?.preview;

        return (
          <li key={c.path}>
            <details open={false}>
              <summary>
                <span className="fileTreeFile">{c.name}</span>
                <span className="fileTreeMeta">{formatBytes(size)}</span>
              </summary>
              <div className="filePreview">
                {preview?.kind === "skip" ? (
                  <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                    {preview.reason}{" "}
                    {c.path === "SKILL.md" ? (
                      <a href="#instructions" style={{ textDecoration: "underline" }}>
                        Jump to instructions.
                      </a>
                    ) : null}
                  </p>
                ) : null}

                {preview?.kind === "binary" ? (
                  <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                    {preview.reason}
                  </p>
                ) : null}

                {preview?.kind === "csv" ? (
                  <div className="grid" style={{ gap: 10 }}>
                    <div className="csvTableWrap">
                      <table className="csvTable">
                        <thead>
                          <tr>
                            {preview.headers.slice(0, CSV_PREVIEW_MAX_COLS).map((h, i) => (
                              <th key={`${c.path}-h-${i}`}>{h || `col_${i + 1}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.slice(0, CSV_PREVIEW_MAX_ROWS).map((r, idx) => (
                            <tr key={`${c.path}-r-${idx}`}>
                              {preview.headers.slice(0, CSV_PREVIEW_MAX_COLS).map((_, i) => (
                                <td key={`${c.path}-r-${idx}-c-${i}`}>{r[i] ?? ""}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {preview.truncated ? (
                      <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                        Preview truncated.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {preview?.kind === "markdown" ? (
                  <div className="grid" style={{ gap: 10 }}>
                    <article className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.text}</ReactMarkdown>
                    </article>
                    {preview.truncated ? (
                      <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                        Preview truncated.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {preview?.kind === "text" ? (
                  <div className="grid" style={{ gap: 10 }}>
                    <pre className="codeBlock">
                      <code>{preview.text}</code>
                    </pre>
                    {preview.truncated ? (
                      <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                        Preview truncated.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="filePreviewActions">
                  {githubUrl ? (
                    <a className="btn small" href={githubUrl} target="_blank" rel="noreferrer">
                      View on GitHub
                    </a>
                  ) : null}
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
