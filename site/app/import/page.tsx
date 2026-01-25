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
  try {
    const direct = await ghJson<{ tree: GhTreeItem[] }>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    );
    return direct.tree ?? [];
  } catch {
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
    <div className="grid gap-4">
      <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
        <h1 className="m-0 text-[28px] tracking-tight">Import from GitHub</h1>
        <p className="text-muted mt-2 leading-relaxed">
          Paste a repo URL. We detect `.x_skill.yaml + SKILL.md` pairs (or legacy `skill.yaml`). You select what to import, then open a PR
          via an issue-triggered GitHub Action.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 mt-3.5">
          <div>
            <label className="block font-bold tracking-tight">Source repo</label>
            <input
              className="w-full border border-border bg-white/95 rounded-[14px] px-3.5 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(15,23,42,0.05)] mt-2 focus-visible:outline-2 focus-visible:outline-accent/45 focus-visible:outline-offset-2 focus-visible:border-accent/35"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </div>
          <div>
            <label className="block font-bold tracking-tight">Ref (optional)</label>
            <input
              className="w-full border border-border bg-white/95 rounded-[14px] px-3.5 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(15,23,42,0.05)] mt-2 focus-visible:outline-2 focus-visible:outline-accent/45 focus-visible:outline-offset-2 focus-visible:border-accent/35"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="main"
            />
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap mt-3 items-center">
          <button
            className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 font-semibold shadow-primary transition-all duration-150 hover:-translate-y-px hover:from-accent-ink hover:to-accent-ink disabled:opacity-55 disabled:pointer-events-none"
            onClick={() => void onParse()}
            disabled={loading}
          >
            {loading ? "Parsing…" : "Parse repo"}
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
            anonymous GitHub API (rate-limited)
          </span>
          {!REPO_SLUG ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
              set NEXT_PUBLIC_REPO_SLUG to enable PR flow
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="bg-surface border border-[rgba(255,45,143,0.45)] rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-3.5 mt-3">
            <strong>Error</strong>
            <div className="h-2" />
            <pre className="m-0 whitespace-pre-wrap font-mono">{error}</pre>
          </div>
        ) : null}
      </section>

      {detected.length > 0 ? (
        <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="m-0 text-lg">Detected skills</h2>
              <p className="text-muted mt-2 leading-relaxed">
                Select items and choose a target category/subcategory.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
              {selectedItems.length} / {detected.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
            <div>
              <label className="block font-bold tracking-tight">Target category</label>
              <select
                className="w-full border border-border bg-white/95 rounded-[14px] px-3.5 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(15,23,42,0.05)] mt-2 focus-visible:outline-2 focus-visible:outline-accent/45 focus-visible:outline-offset-2 focus-visible:border-accent/35"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold tracking-tight">Target subcategory</label>
              <select
                className="w-full border border-border bg-white/95 rounded-[14px] px-3.5 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(15,23,42,0.05)] mt-2 focus-visible:outline-2 focus-visible:outline-accent/45 focus-visible:outline-offset-2 focus-visible:border-accent/35"
                value={targetSubcategory}
                onChange={(e) => setTargetSubcategory(e.target.value)}
              >
                {subcategoryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2.5 flex-wrap mt-3 items-center">
            <a
              className={`inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 font-semibold shadow-primary transition-all duration-150 hover:-translate-y-px hover:from-accent-ink hover:to-accent-ink ${!issueUrl ? "opacity-55 pointer-events-none" : ""}`}
              href={issueUrl || "#"}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!issueUrl}
            >
              Open import issue
            </a>
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
              maintainers label: import-approved
            </span>
          </div>

          <div className="grid gap-2.5 mt-3.5">
            {detected.map((s) => (
              <label
                key={s.sourcePath}
                className="block bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-3.5 cursor-pointer"
              >
                <div className="flex gap-3 items-start">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[s.sourcePath])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [s.sourcePath]: e.target.checked }))}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <strong className="text-base">{s.title}</strong>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                        {s.id}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                        {s.manifestKind === "x" ? ".x_skill.yaml" : "skill.yaml"}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                        {s.sourcePath}
                      </span>
                    </div>
                    <p className="text-muted mt-2 leading-relaxed">
                      {s.description || "No description"}
                    </p>
                    <div className="flex gap-2 flex-wrap mt-2.5">
                      {s.tags.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55"
                        >
                          #{t}
                        </span>
                      ))}
                      {s.agents.slice(0, 4).map((a) => (
                        <span
                          key={a}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55"
                        >
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
