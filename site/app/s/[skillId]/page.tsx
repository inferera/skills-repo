import fs from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
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

export async function generateMetadata({
  params
}: {
  params: Promise<{ skillId: string }>;
}): Promise<Metadata> {
  const { skillId } = await params;
  const skill = await getSkillById(skillId);
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

export default async function SkillPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  const index = await loadRegistryIndex();
  const skill = await getSkillById(skillId);
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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,320px)] gap-6 items-start">
      {/* Main content area */}
      <div className="min-w-0 space-y-6 order-2 lg:order-1">
        {/* Header card */}
        <section className="p-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-[260px] flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-heading text-3xl font-bold text-foreground">{skill.title}</h1>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
                  {skill.category}/{skill.subcategory}
                </span>
              </div>
              <p className="text-secondary mt-3 leading-relaxed">
                {skill.description}
              </p>

              {(skill.tags ?? []).length > 0 && (
                <div className="flex gap-2 flex-wrap mt-4">
                  {(skill.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 flex-wrap items-center">
              <Link
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background-secondary text-foreground font-medium hover:border-border-hover hover:bg-card transition-colors"
                href={`/c/${skill.category}/${skill.subcategory}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back
              </Link>
              {sourceRepo ? (
                <a
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
                  href={sourceRepo}
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
                  Source
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* Files card */}
        <section className="p-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-heading text-xl font-semibold text-foreground">Files</h2>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
              {filePaths.length} files
            </span>
          </div>
          <p className="text-secondary mt-2">
            Expand to preview CSV and code files.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-background-secondary border border-border font-mono text-sm overflow-x-auto">
            <Tree node={tree.root} toSorted={tree.toSorted} fileMeta={fileMeta} />
          </div>
        </section>

        {/* Instructions card */}
        <section className="p-6 bg-card border border-border rounded-xl overflow-hidden" id="instructions">
          <h2 className="font-heading text-xl font-semibold text-foreground">Instructions</h2>
          <div className="mt-4">
            <article className="markdown min-w-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {markdown}
              </ReactMarkdown>
            </article>
          </div>
        </section>
      </div>

      {/* Sidebar - mobile first, sticky on desktop */}
      <aside className="min-w-0 space-y-4 order-1 lg:order-2 lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-116px)] lg:overflow-y-auto">
        {/* Quick install card */}
        <section className="p-5 bg-card border border-border rounded-xl">
          <h2 className="font-heading text-lg font-semibold text-foreground">Quick Install</h2>
          <p className="text-secondary text-sm mt-2">
            Install this skill into a target agent.
          </p>
          <div className="mt-4">
            <QuickInstallClient skillId={skill.id} declaredAgents={skill.agents} />
          </div>
        </section>

        {/* Metadata card */}
        <section className="p-5 bg-card border border-border rounded-xl">
          <h2 className="font-heading text-lg font-semibold text-foreground">Metadata</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-xs text-muted w-20 shrink-0">id</dt>
              <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.id}</dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-xs text-muted w-20 shrink-0">path</dt>
              <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.repoPath}</dd>
            </div>
            {skill.license ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">license</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.license}</dd>
              </div>
            ) : null}
            {(skill.runtime ?? []).length > 0 ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">runtime</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{(skill.runtime ?? []).join(", ")}</dd>
              </div>
            ) : null}
            {(skill.agents ?? []).length > 0 ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">agents</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{(skill.agents ?? []).join(", ")}</dd>
              </div>
            ) : null}
            {sourceRepo ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">source</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">
                  <a href={sourceRepo} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {stripHttps(sourceRepo)}
                  </a>
                </dd>
              </div>
            ) : null}
            {sourcePath ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">sourcePath</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{sourcePath}</dd>
              </div>
            ) : null}
            {sourceRef ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">ref</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{sourceRef}</dd>
              </div>
            ) : null}
            {sourceCommit ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0">commit</dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{sourceCommit.slice(0, 10)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Related skills card */}
        {related.length > 0 ? (
          <section className="p-5 bg-card border border-border rounded-xl">
            <h2 className="font-heading text-lg font-semibold text-foreground">Related</h2>
            <p className="text-secondary text-sm mt-2">
              Similar category + overlapping tags.
            </p>
            <div className="mt-4 space-y-3">
              {related.map((s) => (
                <SkillMiniCard key={s.id} skill={s} />
              ))}
            </div>
          </section>
        ) : null}
      </aside>
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
    <ul className="m-0 pl-4 list-none first:pl-0">
      {children.map((c) => {
        if (!c.isFile) {
          return (
            <li key={c.path} className="my-1">
              <details open={false}>
                <summary className="cursor-pointer list-none flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 hover:bg-card before:content-['+'] before:w-4 before:text-muted [&[open]]:before:content-['-']">
                  <span className="text-foreground font-medium min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {c.name}/
                  </span>
                  <span className="ml-auto text-muted text-xs shrink-0">{countFiles(c)} files</span>
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
          <li key={c.path} className="my-1">
            <details open={false}>
              <summary className="cursor-pointer list-none flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 hover:bg-card before:content-['+'] before:w-4 before:text-muted [details[open]>&]:before:content-['-']">
                <span className="text-foreground min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</span>
                <span className="ml-auto text-muted text-xs shrink-0">{formatBytes(size)}</span>
              </summary>
              <div className="mt-3 pt-3 px-2 pb-1 border-t border-border">
                {preview?.kind === "skip" ? (
                  <p className="text-secondary text-sm">
                    {preview.reason}{" "}
                    {c.path === "SKILL.md" ? (
                      <a href="#instructions" className="text-accent hover:underline">
                        Jump to instructions.
                      </a>
                    ) : null}
                  </p>
                ) : null}

                {preview?.kind === "binary" ? (
                  <p className="text-secondary text-sm">{preview.reason}</p>
                ) : null}

                {preview?.kind === "csv" ? (
                  <div className="space-y-3">
                    <div className="overflow-auto border border-border rounded-lg bg-card">
                      <table className="w-full border-collapse font-mono text-xs">
                        <thead>
                          <tr>
                            {preview.headers.slice(0, CSV_PREVIEW_MAX_COLS).map((h, i) => (
                              <th
                                key={`${c.path}-h-${i}`}
                                className="sticky top-0 bg-background-secondary py-2 px-3 border-b border-border text-left whitespace-nowrap text-foreground font-medium"
                              >
                                {h || `col_${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.slice(0, CSV_PREVIEW_MAX_ROWS).map((r, idx) => (
                            <tr key={`${c.path}-r-${idx}`}>
                              {preview.headers.slice(0, CSV_PREVIEW_MAX_COLS).map((_, i) => (
                                <td
                                  key={`${c.path}-r-${idx}-c-${i}`}
                                  className="py-2 px-3 border-t border-border text-left whitespace-nowrap text-secondary"
                                >
                                  {r[i] ?? ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {preview.truncated ? (
                      <p className="text-muted text-sm">Preview truncated.</p>
                    ) : null}
                  </div>
                ) : null}

                {preview?.kind === "markdown" ? (
                  <div className="space-y-3">
                    <article className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                        {preview.text}
                      </ReactMarkdown>
                    </article>
                    {preview.truncated ? (
                      <p className="text-muted text-sm">Preview truncated.</p>
                    ) : null}
                  </div>
                ) : null}

                {preview?.kind === "text" ? (
                  <div className="space-y-3">
                    <pre className="overflow-x-auto bg-[#0f172a] text-[#e2e8f0] rounded-lg p-4 font-mono text-xs leading-relaxed">
                      <code>{preview.text}</code>
                    </pre>
                    {preview.truncated ? (
                      <p className="text-muted text-sm">Preview truncated.</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2 flex-wrap mt-3">
                  {githubUrl ? (
                    <a
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:border-border-hover transition-colors"
                      href={githubUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                      </svg>
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
