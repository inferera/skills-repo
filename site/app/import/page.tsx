"use client";

import { useEffect, useMemo, useState } from "react";
import YAML from "yaml";

import { REPO_SLUG } from "@/lib/config";

type GhRepo = {
  full_name: string;
  default_branch: string;
};

type GhTreeItem = {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
};

type DetectedSkill = {
  sourcePath: string;
  skillYamlPath: string;
  skillMdPath: string;
  manifestKind: "x" | "legacy";
  id: string;
  title: string;
  description: string;
  tags: string[];
  agents: string[];
};

type RegistryCategories = {
  categories: Array<{ id: string; title: string; subcategories: Array<{ id: string; title: string }> }>;
};

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  let v = input.trim();
  if (!v) return null;
  v = v.replace(/^git\+/, "").replace(/\.git$/, "");
  v = v.replace(/^https?:\/\/github\.com\//, "");
  v = v.replace(/^github\.com\//, "");
  v = v.replace(/^\/+|\/+$/g, "");
  const parts = v.split("/");
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  const repo = parts[1]!;
  if (!owner || !repo) return null;
  return { owner, repo };
}

function encodePath(p: string) {
  // Keep "/" but escape spaces and other URL-unsafe characters.
  return encodeURI(p);
}

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${url}`);
  return (await res.json()) as T;
}

async function ghRepo(owner: string, repo: string): Promise<GhRepo> {
  return ghJson<GhRepo>(`https://api.github.com/repos/${owner}/${repo}`);
}

async function ghTree(owner: string, repo: string, ref: string): Promise<GhTreeItem[]> {
  // Best-effort: tree endpoint sometimes accepts refs directly. If it fails, fall back to ref->commit->tree.
  try {
    const direct = await ghJson<{ tree: GhTreeItem[] }>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    );
    return direct.tree ?? [];
  } catch {
    // heads/<ref>
    const head = await ghJson<{ object: { sha: string } }>(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(ref)}`
    );
    const commit = await ghJson<{ tree: { sha: string } }>(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${head.object.sha}`
    );
    const tree = await ghJson<{ tree: GhTreeItem[] }>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`
    );
    return tree.tree ?? [];
  }
}

async function ghFileText(owner: string, repo: string, filePath: string, ref: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`Failed to fetch file: ${filePath} (${res.status})`);
  const json = (await res.json()) as { content?: string; encoding?: string };
  if (!json.content || json.encoding !== "base64") throw new Error(`Unexpected contents response: ${filePath}`);
  const bytes = Uint8Array.from(atob(json.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function buildIssueBody(args: {
  sourceRepoUrl: string;
  ref: string;
  targetCategory: string;
  targetSubcategory: string;
  items: Array<{ sourcePath: string }>;
}) {
  const block = [
    "<!-- skillhub-import:v1",
    `sourceRepo: ${args.sourceRepoUrl}`,
    `ref: ${args.ref}`,
    "items:",
    ...args.items.map(
      (it) =>
        `  - sourcePath: ${it.sourcePath}\n    targetCategory: ${args.targetCategory}\n    targetSubcategory: ${args.targetSubcategory}`
    ),
    "-->"
  ].join("\n");

  return [
    "Importer request (created from the static site UI).",
    "",
    "Maintainers: add label `import-approved` to trigger the import PR workflow.",
    "",
    block,
    ""
  ].join("\n");
}

export default function ImportPage() {
  const [repoInput, setRepoInput] = useState("");
  const [refInput, setRefInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceRepoUrl, setSourceRepoUrl] = useState<string>("");
  const [resolvedRef, setResolvedRef] = useState<string>("");

  const [categories, setCategories] = useState<RegistryCategories | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>("");
  const [targetSubcategory, setTargetSubcategory] = useState<string>("");

  const [detected, setDetected] = useState<DetectedSkill[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/registry/categories.json");
        if (!res.ok) return;
        const json = (await res.json()) as RegistryCategories;
        setCategories(json);
        const firstCat = json.categories[0];
        if (firstCat) {
          setTargetCategory(firstCat.id);
          setTargetSubcategory(firstCat.subcategories[0]?.id ?? "");
        }
      } catch {
        // optional
      }
    };
    void run();
  }, []);

  const categoryOptions = useMemo(() => categories?.categories ?? [], [categories]);
  const subcategoryOptions = useMemo(() => {
    const cat = categoryOptions.find((c) => c.id === targetCategory);
    return cat?.subcategories ?? [];
  }, [categoryOptions, targetCategory]);

  useEffect(() => {
    // Keep subcategory valid when category changes.
    if (!subcategoryOptions.find((s) => s.id === targetSubcategory)) {
      setTargetSubcategory(subcategoryOptions[0]?.id ?? "");
    }
  }, [subcategoryOptions, targetSubcategory]);

  const selectedItems = useMemo(() => detected.filter((d) => selected[d.sourcePath]), [detected, selected]);

  const issueUrl = useMemo(() => {
    if (!REPO_SLUG) return "";
    if (!targetCategory || !targetSubcategory) return "";
    if (selectedItems.length === 0) return "";

    if (!sourceRepoUrl || !resolvedRef) return "";
    let repoSlug = sourceRepoUrl;
    if (repoSlug.startsWith("https://github.com/")) repoSlug = repoSlug.slice("https://github.com/".length);
    else if (repoSlug.startsWith("http://github.com/")) repoSlug = repoSlug.slice("http://github.com/".length);
    const title = `Import skills from ${repoSlug}`;
    const body = buildIssueBody({
      sourceRepoUrl,
      ref: resolvedRef,
      targetCategory,
      targetSubcategory,
      items: selectedItems.map((s) => ({ sourcePath: s.sourcePath }))
    });

    return `https://github.com/${REPO_SLUG}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }, [sourceRepoUrl, resolvedRef, selectedItems, targetCategory, targetSubcategory]);

  async function onParse() {
    setError(null);
    setDetected([]);
    setSelected({});
    setSourceRepoUrl("");
    setResolvedRef("");
    setLoading(true);

    try {
      const parsed = parseRepoUrl(repoInput);
      if (!parsed) throw new Error("Invalid GitHub repo URL. Expected https://github.com/owner/repo");

      const repo = await ghRepo(parsed.owner, parsed.repo);
      const ref = refInput.trim() || repo.default_branch;
      setSourceRepoUrl(`https://github.com/${parsed.owner}/${parsed.repo}`);
      setResolvedRef(ref);

      const tree = await ghTree(parsed.owner, parsed.repo, ref);
      const blobs = new Set(tree.filter((t) => t.type === "blob").map((t) => t.path));

      let candidates = Array.from(blobs)
        .filter((p) => p.endsWith("/.x_skill.yaml") || p === ".x_skill.yaml" || p.endsWith("/skill.yaml") || p === "skill.yaml")
        .map((skillYamlPath) => {
          const isX = skillYamlPath.endsWith("/.x_skill.yaml") || skillYamlPath === ".x_skill.yaml";
          const dir =
            skillYamlPath === ".x_skill.yaml" || skillYamlPath === "skill.yaml"
              ? ""
              : isX
                ? skillYamlPath.replace(/\/\.x_skill\.yaml$/, "")
                : skillYamlPath.replace(/\/skill\.yaml$/, "");
          const skillMdPath = dir ? `${dir}/SKILL.md` : "SKILL.md";
          return {
            dir,
            skillYamlPath,
            skillMdPath,
            manifestKind: isX ? ("x" as const) : ("legacy" as const)
          };
        })
        .filter((c) => blobs.has(c.skillMdPath));

      // Hard limit to avoid blowing up anonymous API rate limits.
      candidates = candidates.slice(0, 20);

      const detectedSkills: DetectedSkill[] = [];
      for (const c of candidates) {
        const raw = await ghFileText(parsed.owner, parsed.repo, c.skillYamlPath, ref);
        const meta = YAML.parse(raw) as unknown;
        const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};

        const id = typeof m.id === "string" && m.id ? m.id : c.dir.split("/").pop() || c.dir || "unknown";
        const title = typeof m.title === "string" && m.title ? m.title : id;
        const description = typeof m.description === "string" && m.description ? m.description : "";

        const tags = Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === "string") : [];
        const agents = Array.isArray(m.agents) ? m.agents.filter((a): a is string => typeof a === "string") : [];

        detectedSkills.push({
          sourcePath: c.dir || ".",
          skillYamlPath: c.skillYamlPath,
          skillMdPath: c.skillMdPath,
          manifestKind: c.manifestKind,
          id,
          title,
          description,
          tags,
          agents
        });
      }

      setDetected(detectedSkills);
      setSelected(Object.fromEntries(detectedSkills.map((s) => [s.sourcePath, true])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em" }}>Import from GitHub</h1>
        <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
          Paste a repo URL. We detect `.x_skill.yaml + SKILL.md` pairs (or legacy `skill.yaml`). You select what to import, then open a PR
          via an issue-triggered GitHub Action.
        </p>

        <div className="formGrid" style={{ marginTop: 14 }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, letterSpacing: "-0.01em" }}>Source repo</label>
            <input
              className="input"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="https://github.com/owner/repo"
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 700, letterSpacing: "-0.01em" }}>Ref (optional)</label>
            <input
              className="input"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="main"
              style={{ marginTop: 8 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <button className="btn primary" onClick={() => void onParse()} disabled={loading}>
            {loading ? "Parsing…" : "Parse repo"}
          </button>
          <span className="chip">anonymous GitHub API (rate-limited)</span>
          {!REPO_SLUG ? <span className="chip">set NEXT_PUBLIC_REPO_SLUG to enable PR flow</span> : null}
        </div>

        {error ? (
          <div className="card" style={{ padding: 14, marginTop: 12, borderColor: "rgba(255,45,143,0.45)" }}>
            <strong>Error</strong>
            <div style={{ height: 8 }} />
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>{error}</pre>
          </div>
        ) : null}
      </section>

      {detected.length > 0 ? (
        <section className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Detected skills</h2>
              <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
                Select items and choose a target category/subcategory.
              </p>
            </div>
            <span className="chip">
              {selectedItems.length} / {detected.length} selected
            </span>
          </div>

          <div className="formGrid two" style={{ marginTop: 14 }}>
            <div>
              <label style={{ display: "block", fontWeight: 700, letterSpacing: "-0.01em" }}>Target category</label>
              <select className="input" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} style={{ marginTop: 8 }}>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 700, letterSpacing: "-0.01em" }}>Target subcategory</label>
              <select
                className="input"
                value={targetSubcategory}
                onChange={(e) => setTargetSubcategory(e.target.value)}
                style={{ marginTop: 8 }}
              >
                {subcategoryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <a className={`btn primary`} href={issueUrl || "#"} target="_blank" rel="noreferrer" aria-disabled={!issueUrl}>
              Open import issue
            </a>
            <span className="chip">maintainers label: import-approved</span>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {detected.map((s) => (
              <label key={s.sourcePath} className="card" style={{ padding: 14, display: "block" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[s.sourcePath])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [s.sourcePath]: e.target.checked }))}
                    style={{ marginTop: 4 }}
                  />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 16 }}>{s.title}</strong>
                        <span className="chip">{s.id}</span>
                        <span className="chip">{s.manifestKind === "x" ? ".x_skill.yaml" : "skill.yaml"}</span>
                        <span className="chip">{s.sourcePath}</span>
                      </div>
                    <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
                      {s.description || "No description"}
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      {s.tags.slice(0, 6).map((t) => (
                        <span key={t} className="chip">
                          #{t}
                        </span>
                      ))}
                      {s.agents.slice(0, 4).map((a) => (
                        <span key={a} className="chip">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
