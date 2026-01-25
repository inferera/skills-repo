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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,320px)] gap-5 items-start">
      {/* Main content area */}
      <div className="min-w-0 grid gap-4 order-2 lg:order-1">
        <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-[260px] flex-[1_1_520px]">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="m-0 text-[30px] tracking-tight">{skill.title}</h1>
                <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                  {skill.category}/{skill.subcategory}
                </span>
              </div>
              <p className="text-muted mt-2.5 text-base leading-relaxed">
                {skill.description}
              </p>

              <div className="flex gap-2 flex-wrap mt-3.5">
                {(skill.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 flex-wrap items-center">
              <Link
                className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm"
                href={`/c/${skill.category}/${skill.subcategory}`}
              >
                Back to list
              </Link>
              {sourceRepo ? (
                <a
                  className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 font-semibold shadow-primary transition-all duration-150 hover:-translate-y-px hover:from-accent-ink hover:to-accent-ink"
                  href={sourceRepo}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source repo
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="m-0 text-lg">Files</h2>
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
              {filePaths.length} files
            </span>
          </div>
          <p className="text-muted mt-2 leading-relaxed">
            Expand to preview CSV and code files. Default collapsed for scanability.
          </p>
          <div className="border border-border rounded-[14px] p-3 bg-white/60 font-mono text-[13px] leading-relaxed mt-3">
            <Tree node={tree.root} toSorted={tree.toSorted} fileMeta={fileMeta} />
          </div>
        </section>

        <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]" id="instructions">
          <h2 className="m-0 text-lg">Instructions</h2>
          <div className="h-2.5" />
          <article className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {markdown}
            </ReactMarkdown>
          </article>
        </section>
      </div>

      {/* Sidebar - mobile first, sticky on desktop */}
      <aside className="min-w-0 grid gap-3.5 order-1 lg:order-2 lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-116px)] lg:overflow-y-auto">
        <section className="bg-surface-strong border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-4">
          <h2 className="m-0 text-base">Quick install</h2>
          <p className="text-muted mt-2 leading-relaxed">
            Install this skill into a target agent environment.
          </p>
          <div className="h-3" />
          <QuickInstallClient skillId={skill.id} declaredAgents={skill.agents} />
        </section>

        <section className="bg-surface-strong border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-4">
          <h2 className="m-0 text-base">Metadata</h2>
          <div className="h-3" />

          <dl className="m-0 grid gap-2.5">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
              <dt className="font-mono text-xs text-text/62">id</dt>
              <dd className="font-semibold min-w-0 break-words m-0">{skill.id}</dd>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
              <dt className="font-mono text-xs text-text/62">path</dt>
              <dd className="font-semibold min-w-0 break-words m-0">{skill.repoPath}</dd>
            </div>
            {skill.license ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">license</dt>
                <dd className="font-semibold min-w-0 break-words m-0">{skill.license}</dd>
              </div>
            ) : null}
            {(skill.runtime ?? []).length > 0 ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">runtime</dt>
                <dd className="font-semibold min-w-0 break-words m-0">{(skill.runtime ?? []).join(", ")}</dd>
              </div>
            ) : null}
            {(skill.agents ?? []).length > 0 ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">agents</dt>
                <dd className="font-semibold min-w-0 break-words m-0">{(skill.agents ?? []).join(", ")}</dd>
              </div>
            ) : null}
            {sourceRepo ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">source</dt>
                <dd className="font-semibold min-w-0 break-words m-0">
                  <a href={sourceRepo} target="_blank" rel="noreferrer" className="underline">
                    {stripHttps(sourceRepo)}
                  </a>
                </dd>
              </div>
            ) : null}
            {sourcePath ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">sourcePath</dt>
                <dd className="font-semibold min-w-0 break-words m-0">{sourcePath}</dd>
              </div>
            ) : null}
            {sourceRef ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">ref</dt>
                <dd className="font-semibold min-w-0 break-words m-0">{sourceRef}</dd>
              </div>
            ) : null}
            {sourceCommit ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 items-baseline">
                <dt className="font-mono text-xs text-text/62">commit</dt>
                <dd className="font-semibold min-w-0 break-words m-0">{sourceCommit.slice(0, 10)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {related.length > 0 ? (
          <section className="bg-surface-strong border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-4">
            <h2 className="m-0 text-base">Related</h2>
            <p className="text-muted mt-2 leading-relaxed">
              Similar category + overlapping tags.
            </p>
            <div className="grid gap-3 mt-3">
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
    <ul className="m-0 pl-[18px] list-none first:pl-0">
      {children.map((c) => {
        if (!c.isFile) {
          return (
            <li key={c.path} className="my-1">
              <details open={false}>
                <summary className="cursor-pointer list-none flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] min-w-0 hover:bg-black/4 before:content-['+_'] before:text-text/55 [&[open]>summary]:before:content-['-_']">
                  <span className="text-text/76 font-semibold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {c.name}/
                  </span>
                  <span className="ml-auto text-text/55 text-xs shrink-0">{countFiles(c)} files</span>
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
              <summary className="cursor-pointer list-none flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] min-w-0 hover:bg-black/4 before:content-['+_'] before:text-text/55 [details[open]>&]:before:content-['-_']">
                <span className="text-text/88 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</span>
                <span className="ml-auto text-text/55 text-xs shrink-0">{formatBytes(size)}</span>
              </summary>
              <div className="mt-2.5 pt-2.5 px-2.5 pb-1 border-t border-black/12">
                {preview?.kind === "skip" ? (
                  <p className="text-muted m-0 leading-relaxed">
                    {preview.reason}{" "}
                    {c.path === "SKILL.md" ? (
                      <a href="#instructions" className="underline">
                        Jump to instructions.
                      </a>
                    ) : null}
                  </p>
                ) : null}

                {preview?.kind === "binary" ? (
                  <p className="text-muted m-0 leading-relaxed">{preview.reason}</p>
                ) : null}

                {preview?.kind === "csv" ? (
                  <div className="grid gap-2.5">
                    <div className="overflow-auto border border-border rounded-[14px] bg-white/75">
                      <table className="w-full border-collapse font-mono text-xs">
                        <thead>
                          <tr>
                            {preview.headers.slice(0, CSV_PREVIEW_MAX_COLS).map((h, i) => (
                              <th
                                key={`${c.path}-h-${i}`}
                                className="sticky top-0 bg-bg/96 py-2 px-2.5 border-t-0 border-b border-black/10 text-left whitespace-nowrap z-[1]"
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
                                  className="py-2 px-2.5 border-t border-black/10 text-left whitespace-nowrap"
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
                      <p className="text-muted m-0 leading-relaxed">Preview truncated.</p>
                    ) : null}
                  </div>
                ) : null}

                {preview?.kind === "markdown" ? (
                  <div className="grid gap-2.5">
                    <article className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                        {preview.text}
                      </ReactMarkdown>
                    </article>
                    {preview.truncated ? (
                      <p className="text-muted m-0 leading-relaxed">Preview truncated.</p>
                    ) : null}
                  </div>
                ) : null}

                {preview?.kind === "text" ? (
                  <div className="grid gap-2.5">
                    <pre className="overflow-x-auto border border-border bg-[rgba(11,11,16,0.92)] text-white/92 rounded-[14px] p-3.5 font-mono text-[12.5px] leading-relaxed m-0">
                      <code>{preview.text}</code>
                    </pre>
                    {preview.truncated ? (
                      <p className="text-muted m-0 leading-relaxed">Preview truncated.</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2.5 flex-wrap mt-2.5">
                  {githubUrl ? (
                    <a
                      className="inline-flex items-center justify-center gap-2.5 px-2.5 py-2 rounded-[10px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm text-[13px]"
                      href={githubUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
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
