import fs from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SkillCard } from "@/components/SkillCard";
import { getSkillById, loadRegistryIndex } from "@/lib/registry";

export const dynamicParams = false;

type FileTreeNode = {
  name: string;
  path: string;
  children: Map<string, FileTreeNode>;
  isFile: boolean;
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

export default async function SkillPage({ params }: { params: { skillId: string } }) {
  const index = await loadRegistryIndex();
  const skill = await getSkillById(params.skillId);
  if (!skill) notFound();

  const abs = path.resolve(process.cwd(), "..", skill.repoPath, "SKILL.md");
  const markdown = await fs.readFile(abs, "utf8");

  const related = index.skills
    .filter((s) => s.id !== skill.id && s.category === skill.category)
    .filter((s) => {
      if (!skill.tags?.length || !s.tags?.length) return false;
      const set = new Set(skill.tags);
      return s.tags.some((t) => set.has(t));
    })
    .slice(0, 6);

  const filePaths = (skill.files ?? []).map((f) => f.path);
  const tree = buildFileTree(filePaths);

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
              {(skill.agents ?? []).map((a) => (
                <span key={a} className="chip">
                  {a}
                </span>
              ))}
              {(skill.runtime ?? []).map((r) => (
                <span key={r} className="chip">
                  {r}
                </span>
              ))}
              {skill.license ? <span className="chip">{skill.license}</span> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" href={`/c/${skill.category}/${skill.subcategory}`}>
              Back to list
            </Link>
            {skill.source?.repo ? (
              <a className="btn primary" href={skill.source.repo} target="_blank" rel="noreferrer">
                Source repo
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Instructions</h2>
        <div style={{ height: 10 }} />
        <article className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Files</h2>
          <span className="chip">{filePaths.length} files</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <div
            style={{
              border: "1px solid rgba(11, 11, 16, 0.14)",
              borderRadius: 14,
              padding: 12,
              background: "rgba(255, 255, 255, 0.6)"
            }}
          >
            <Tree node={tree.root} toSorted={tree.toSorted} />
          </div>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Related</h2>
          <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            Same category, overlapping tags.
          </p>
          <div className="grid cards" style={{ marginTop: 14 }}>
            {related.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Tree({ node, toSorted }: { node: FileTreeNode; toSorted: (n: FileTreeNode) => FileTreeNode[] }) {
  const children = toSorted(node);
  if (children.length === 0) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontFamily: '"JetBrains Mono", ui-monospace', fontSize: 13, lineHeight: 1.6 }}>
      {children.map((c) => (
        <li key={c.path}>
          <span style={{ color: c.isFile ? "rgba(11, 11, 16, 0.85)" : "rgba(11, 11, 16, 0.72)" }}>
            {c.isFile ? c.name : `${c.name}/`}
          </span>
          {!c.isFile ? <Tree node={c} toSorted={toSorted} /> : null}
        </li>
      ))}
    </ul>
  );
}
