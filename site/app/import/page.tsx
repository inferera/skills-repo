"use client";

import { useEffect, useMemo, useState } from "react";

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
  skillMdPath: string;
  id: string;
  title: string;
  description: string;
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

// Parse SKILL.md frontmatter (YAML between --- markers)
function parseSkillMdFrontmatter(content: string): { title?: string; description?: string; id?: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return {};

  const frontmatter = lines.slice(1, endIndex).join("\n");
  const result: { title?: string; description?: string; id?: string } = {};

  // Simple YAML parsing for title and description
  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const idMatch = frontmatter.match(/^id:\s*["']?(.+?)["']?\s*$/m);

  if (titleMatch) result.title = titleMatch[1];
  if (descMatch) result.description = descMatch[1];
  if (idMatch) result.id = idMatch[1];

  return result;
}

// Extract title from first # heading in markdown
function extractTitleFromMarkdown(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
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

      // Only look for SKILL.md files - no need for .x_skill.yaml
      let candidates = Array.from(blobs)
        .filter((p) => p.endsWith("/SKILL.md") || p === "SKILL.md")
        .map((skillMdPath) => {
          const dir = skillMdPath === "SKILL.md" ? "" : skillMdPath.replace(/\/SKILL\.md$/, "");
          return {
            dir,
            skillMdPath
          };
        });

      candidates = candidates.slice(0, 20);

      const detectedSkills: DetectedSkill[] = [];
      for (const c of candidates) {
        try {
          const mdContent = await ghFileText(parsed.owner, parsed.repo, c.skillMdPath, ref);

          // Try to extract metadata from SKILL.md frontmatter or content
          const frontmatter = parseSkillMdFrontmatter(mdContent);
          const headingTitle = extractTitleFromMarkdown(mdContent);

          const id = frontmatter.id || c.dir.split("/").pop() || c.dir || "unknown";
          const title = frontmatter.title || headingTitle || id;
          const description = frontmatter.description || "";

          detectedSkills.push({
            sourcePath: c.dir || ".",
            skillMdPath: c.skillMdPath,
            id,
            title,
            description
          });
        } catch {
          // Skip if we can't read the file
          continue;
        }
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
    <div className="space-y-6">
      {/* Header section */}
      <section className="p-6 bg-card border border-border rounded-xl">
        <h1 className="font-heading text-3xl font-bold text-foreground">Import from GitHub</h1>
        <p className="text-secondary mt-3 leading-relaxed">
          Paste a repo URL. We detect directories with <code className="px-1.5 py-0.5 rounded bg-background-secondary text-accent text-sm font-mono">SKILL.md</code> files.
          Select what to import, then open a PR via an issue-triggered GitHub Action.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Source Repository</label>
            <input
              className="w-full h-11 px-4 bg-background-secondary border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Branch/Tag (optional)</label>
            <input
              className="w-full h-11 px-4 bg-background-secondary border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="main"
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap mt-5 items-center">
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => void onParse()}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Parsing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                Parse Repository
              </>
            )}
          </button>
          <span className="px-3 py-1.5 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
            Uses anonymous GitHub API (rate-limited)
          </span>
          {!REPO_SLUG && (
            <span className="px-3 py-1.5 rounded-md text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              Set NEXT_PUBLIC_REPO_SLUG to enable PR flow
            </span>
          )}
        </div>

        {error && (
          <div className="mt-5 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Error</p>
                <pre className="mt-1 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap font-mono">{error}</pre>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Detected skills section */}
      {detected.length > 0 && (
        <section className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">Detected Skills</h2>
              <p className="text-secondary mt-2">
                Select items and choose a target category/subcategory.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-md text-sm font-mono text-accent bg-accent-muted">
              {selectedItems.length} / {detected.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Target Category</label>
              <select
                className="w-full h-11 px-4 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors"
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
              <label className="block text-sm font-medium text-foreground mb-2">Target Subcategory</label>
              <select
                className="w-full h-11 px-4 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors"
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

          <div className="flex gap-3 flex-wrap mt-5 items-center">
            <a
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium transition-colors ${
                !issueUrl ? "opacity-50 cursor-not-allowed" : "hover:bg-accent-hover"
              }`}
              href={issueUrl || "#"}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!issueUrl}
              onClick={(e) => !issueUrl && e.preventDefault()}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              Open Import Issue
            </a>
            <span className="px-3 py-1.5 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
              Maintainers label: import-approved
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {detected.map((s) => (
              <label
                key={s.sourcePath}
                className={`block p-4 rounded-xl border cursor-pointer transition-colors ${
                  selected[s.sourcePath]
                    ? "bg-accent-muted border-accent/30"
                    : "bg-background-secondary border-border hover:border-border-hover"
                }`}
              >
                <div className="flex gap-4 items-start">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[s.sourcePath])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [s.sourcePath]: e.target.checked }))}
                    className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{s.title}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono text-muted bg-card border border-border">
                        {s.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono text-muted bg-card border border-border">
                        {s.sourcePath}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-secondary text-sm mt-2">
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
