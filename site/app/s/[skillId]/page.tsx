import fs from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { SkillMiniCard } from "@/components/SkillMiniCard";
import { T } from "@/components/T";
import { QuickInstallClient } from "@/components/QuickInstallClient";
import { FileTreeClient } from "@/components/FileTreeClient";
import { MarkdownCodeBlock } from "@/components/CodeBlock";
import { REPO_URL } from "@/lib/config";
import type { MessageKey } from "@/lib/i18n";
import { loadAgentConfigs } from "@/lib/agents";
import { getSkillById, loadRegistryIndex } from "@/lib/registry";

export const dynamicParams = false;

// Increased limits to avoid truncation
const FILE_PREVIEW_MAX_BYTES = 512 * 1024; // 512KB
const FILE_PREVIEW_MAX_CODE_LINES = 2000;
const CSV_PREVIEW_MAX_ROWS = 100;
const CSV_PREVIEW_MAX_COLS = 20;

const MARKDOWN_COMPONENTS: Components = {
  table({ node, ...props }) {
    void node;
    return (
      <div className="markdown-table-wrap">
        <table {...props} />
      </div>
    );
  },
  code(props) {
    const { className, children, ...rest } = props;
    const isInline = !className?.includes("language-");
    return (
      <MarkdownCodeBlock inline={isInline} className={className} {...rest}>
        {children}
      </MarkdownCodeBlock>
    );
  },
};

type FileTreeNode = {
  name: string;
  path: string;
  children: FileTreeNode[];
  isFile: boolean;
};

type FilePreview =
  | { kind: "skip"; reason: string | { key: MessageKey; params?: Record<string, string | number> } }
  | { kind: "binary"; reason: string | { key: MessageKey; params?: Record<string, string | number> } }
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

// Parse YAML frontmatter from SKILL.md
type FrontmatterData = Record<string, string | string[] | undefined>;

function parseSkillFrontmatter(content: string): { frontmatter: FrontmatterData; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const frontmatter: FrontmatterData = {};

  for (const line of frontmatterLines) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const key = match[1]!;
      let value = match[2]!.trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parse arrays like [a, b, c]
      if (value.startsWith("[") && value.endsWith("]")) {
        const arrContent = value.slice(1, -1);
        frontmatter[key] = arrContent.split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
      } else {
        frontmatter[key] = value;
      }
    }
  }

  const body = lines.slice(endIndex + 1).join("\n");
  return { frontmatter, body };
}

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

function buildFileTree(paths: string[]): FileTreeNode[] {
  type BuildNode = {
    name: string;
    path: string;
    children: Map<string, BuildNode>;
    isFile: boolean;
  };

  const root: BuildNode = { name: "", path: "", children: new Map(), isFile: false };

  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let cur: BuildNode = root;
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

  const toSorted = (n: BuildNode): FileTreeNode[] => {
    const dirs: BuildNode[] = [];
    const files: BuildNode[] = [];
    for (const child of n.children.values()) {
      (child.isFile ? files : dirs).push(child);
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files].map((node) => ({
      name: node.name,
      path: node.path,
      isFile: node.isFile,
      children: toSorted(node)
    }));
  };

  return toSorted(root);
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

function stripHttps(url: string) {
  return url.replace(/^https?:\/\//, "");
}

// Frontmatter table component
function FrontmatterTable({ data }: { data: FrontmatterData }) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return null;

  return (
    <div
      className="bg-background-secondary border-border"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "24px",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td
                className="text-muted bg-card"
                style={{
                  padding: "10px 16px",
                  fontWeight: 500,
                  fontSize: "13px",
                  width: "140px",
                  verticalAlign: "top",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {key}
              </td>
              <td
                className="text-foreground"
                style={{
                  padding: "10px 16px",
                  fontSize: "14px",
                }}
              >
                {Array.isArray(value) ? (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {value.map((v, i) => (
                      <span
                        key={i}
                        className="text-accent bg-accent-muted"
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                ) : (
                  value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SkillPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  const index = await loadRegistryIndex();
  const skill = await getSkillById(skillId);
  if (!skill) notFound();

  const abs = path.resolve(process.cwd(), "..", skill.repoPath, "SKILL.md");
  const rawMarkdown = await fs.readFile(abs, "utf8");

  // Parse frontmatter from SKILL.md
  const { frontmatter, body: markdownBody } = parseSkillFrontmatter(rawMarkdown);

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
  const fileMetaList: FileMeta[] = [];

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
      fileMetaList.push({
        path: p,
        name,
        ext,
        size: 0,
        githubUrl,
        preview: { kind: "skip", reason: { key: "filePreview.reasonMissing" } }
      });
      continue;
    }

    if (p === "SKILL.md") {
      fileMetaList.push({
        path: p,
        name,
        ext,
        size,
        githubUrl,
        preview: { kind: "skip", reason: { key: "filePreview.reasonRenderedBelow" } }
      });
      continue;
    }

    const buf = await readFileSnippet(absPath, FILE_PREVIEW_MAX_BYTES);
    if (isProbablyBinary(buf)) {
      fileMetaList.push({
        path: p,
        name,
        ext,
        size,
        githubUrl,
        preview: { kind: "binary", reason: { key: "filePreview.reasonBinaryUnsupported" } }
      });
      continue;
    }

    const text = buf.toString("utf8");
    const truncatedByBytes = size > FILE_PREVIEW_MAX_BYTES;

    if (ext === ".csv") {
      const parsed = parseCsvPreview(text, CSV_PREVIEW_MAX_ROWS, CSV_PREVIEW_MAX_COLS);
      fileMetaList.push({
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
      fileMetaList.push({
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
    fileMetaList.push({
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
  const agentConfigs = await loadAgentConfigs();

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
                <T k="skill.back" />
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
                  <T k="skill.sourceButton" />
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* Files card */}
        <section className="p-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-heading text-xl font-semibold text-foreground"><T k="skill.files" /></h2>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
              <T k="skill.filesCount" params={{ count: filePaths.length }} />
            </span>
          </div>
          <p className="text-secondary mt-2">
            <T k="skill.filesDescription" />
          </p>
          <div className="mt-4 p-4 rounded-lg bg-background-secondary border border-border overflow-x-auto">
            <FileTreeClient tree={tree} fileMeta={fileMetaList} />
          </div>
        </section>

        {/* Instructions card */}
        <section className="p-6 bg-card border border-border rounded-xl overflow-hidden" id="instructions">
          <h2 className="font-heading text-xl font-semibold text-foreground"><T k="skill.instructions" /></h2>
          <div className="mt-4">
            {/* Frontmatter table */}
            {Object.keys(frontmatter).length > 0 && (
              <FrontmatterTable data={frontmatter} />
            )}
            {/* Markdown body */}
            <article className="markdown min-w-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {markdownBody}
              </ReactMarkdown>
            </article>
          </div>
        </section>
      </div>

      {/* Sidebar - mobile first, sticky on desktop */}
      <aside className="min-w-0 space-y-4 order-1 lg:order-2 lg:sticky lg:top-[var(--app-header-height)] lg:max-h-[calc(100vh-var(--app-header-height)-24px)] lg:overflow-y-auto">
        {/* Quick install card */}
        <section className="p-5 bg-card border border-border rounded-xl">
          <h2 className="font-heading text-lg font-semibold text-foreground"><T k="skill.quickInstall" /></h2>
          <p className="text-secondary text-sm mt-2">
            <T k="skill.quickInstallDescription" />
          </p>
          <div className="mt-4">
            <QuickInstallClient skillId={skill.id} declaredAgents={skill.agents} agentConfigs={agentConfigs} />
          </div>
        </section>

        {/* Metadata card */}
        <section className="p-5 bg-card border border-border rounded-xl">
          <h2 className="font-heading text-lg font-semibold text-foreground"><T k="skill.metadata" /></h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.id" /></dt>
              <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.id}</dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.path" /></dt>
              <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.repoPath}</dd>
            </div>
            {skill.createdAt ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.createdAt" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.createdAt}</dd>
              </div>
            ) : null}
            {skill.updatedAt ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.updatedAt" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.updatedAt}</dd>
              </div>
            ) : null}
            {skill.license ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.license" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{skill.license}</dd>
              </div>
            ) : null}
            {(skill.runtime ?? []).length > 0 ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.runtime" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{(skill.runtime ?? []).join(", ")}</dd>
              </div>
            ) : null}
            {(skill.agents ?? []).length > 0 ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.agents" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{(skill.agents ?? []).join(", ")}</dd>
              </div>
            ) : null}
            {sourceRepo ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.source" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">
                  <a href={sourceRepo} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {stripHttps(sourceRepo)}
                  </a>
                </dd>
              </div>
            ) : null}
            {sourcePath ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.sourcePath" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{sourcePath}</dd>
              </div>
            ) : null}
            {sourceRef ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.ref" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{sourceRef}</dd>
              </div>
            ) : null}
            {sourceCommit ? (
              <div className="flex items-baseline gap-3">
                <dt className="font-mono text-xs text-muted w-20 shrink-0"><T k="meta.commit" /></dt>
                <dd className="text-sm font-medium text-foreground min-w-0 break-words">{sourceCommit.slice(0, 10)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Related skills card */}
        {related.length > 0 ? (
          <section className="p-5 bg-card border border-border rounded-xl">
            <h2 className="font-heading text-lg font-semibold text-foreground"><T k="skill.related" /></h2>
            <p className="text-secondary text-sm mt-2">
              <T k="skill.relatedDescription" />
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
