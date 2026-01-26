"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

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

// Per-skill metadata that can be edited
type SkillMetadata = {
  category: string;
  subcategory: string;
  tags: string[];
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
  items: Array<{
    sourcePath: string;
    id: string;
    title: string;
    targetCategory: string;
    targetSubcategory: string;
    tags: string[];
  }>;
}) {
  const itemLines = args.items.map((it) => {
    const lines = [
      `  - sourcePath: ${it.sourcePath}`,
      `    id: ${it.id}`,
      `    title: "${it.title.replace(/"/g, '\\"')}"`,
      `    targetCategory: ${it.targetCategory}`,
      `    targetSubcategory: ${it.targetSubcategory}`,
    ];
    if (it.tags.length > 0) {
      lines.push(`    tags:`);
      for (const tag of it.tags) {
        lines.push(`      - ${tag}`);
      }
    }
    return lines.join("\n");
  });

  const block = [
    "<!-- skillhub-import:v1",
    `sourceRepo: ${args.sourceRepoUrl}`,
    `ref: ${args.ref}`,
    "items:",
    ...itemLines,
    "-->"
  ].join("\n");

  return [
    "Importer request (created from the static site UI).",
    "",
    "Maintainers: add label `import-approved` to trigger the import PR workflow.",
    "",
    "## Skills to import",
    "",
    ...args.items.map((it) => `- **${it.title}** (\`${it.id}\`) → \`${it.targetCategory}/${it.targetSubcategory}\`${it.tags.length > 0 ? ` [${it.tags.join(", ")}]` : ""}`),
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
  // Default category/subcategory for new skills
  const [defaultCategory, setDefaultCategory] = useState<string>("");
  const [defaultSubcategory, setDefaultSubcategory] = useState<string>("");

  const [detected, setDetected] = useState<DetectedSkill[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Per-skill metadata (category, subcategory, tags)
  const [skillMetadata, setSkillMetadata] = useState<Record<string, SkillMetadata>>({});
  // Track which skill's metadata panel is expanded
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/registry/categories.json");
        if (!res.ok) return;
        const json = (await res.json()) as RegistryCategories;
        setCategories(json);
        const firstCat = json.categories[0];
        if (firstCat) {
          setDefaultCategory(firstCat.id);
          setDefaultSubcategory(firstCat.subcategories[0]?.id ?? "");
        }
      } catch {
        // optional
      }
    };
    void run();
  }, []);

  const categoryOptions = useMemo(() => categories?.categories ?? [], [categories]);

  // Get subcategories for a given category
  const getSubcategories = useCallback((categoryId: string) => {
    const cat = categoryOptions.find((c) => c.id === categoryId);
    return cat?.subcategories ?? [];
  }, [categoryOptions]);

  const defaultSubcategoryOptions = useMemo(() => getSubcategories(defaultCategory), [getSubcategories, defaultCategory]);

  useEffect(() => {
    if (!defaultSubcategoryOptions.find((s) => s.id === defaultSubcategory)) {
      setDefaultSubcategory(defaultSubcategoryOptions[0]?.id ?? "");
    }
  }, [defaultSubcategoryOptions, defaultSubcategory]);

  // Update skill metadata
  const updateSkillMetadata = useCallback((sourcePath: string, updates: Partial<SkillMetadata>) => {
    setSkillMetadata((prev) => ({
      ...prev,
      [sourcePath]: {
        ...prev[sourcePath],
        ...updates,
      } as SkillMetadata
    }));
  }, []);

  // Add tag to a skill
  const addTag = useCallback((sourcePath: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!trimmed) return;
    setSkillMetadata((prev) => {
      const current = prev[sourcePath];
      if (!current) return prev;
      if (current.tags.includes(trimmed)) return prev;
      return {
        ...prev,
        [sourcePath]: {
          ...current,
          tags: [...current.tags, trimmed],
        }
      };
    });
  }, []);

  // Remove tag from a skill
  const removeTag = useCallback((sourcePath: string, tag: string) => {
    setSkillMetadata((prev) => {
      const current = prev[sourcePath];
      if (!current) return prev;
      return {
        ...prev,
        [sourcePath]: {
          ...current,
          tags: current.tags.filter((t) => t !== tag),
        }
      };
    });
  }, []);

  const selectedItems = useMemo(() => detected.filter((d) => selected[d.sourcePath]), [detected, selected]);

  const issueUrl = useMemo(() => {
    if (!REPO_SLUG) return "";
    if (selectedItems.length === 0) return "";
    if (!sourceRepoUrl || !resolvedRef) return "";

    // Check if all selected items have valid metadata
    const allHaveMetadata = selectedItems.every((s) => {
      const meta = skillMetadata[s.sourcePath];
      return meta && meta.category && meta.subcategory;
    });
    if (!allHaveMetadata) return "";

    let repoSlug = sourceRepoUrl;
    if (repoSlug.startsWith("https://github.com/")) repoSlug = repoSlug.slice("https://github.com/".length);
    else if (repoSlug.startsWith("http://github.com/")) repoSlug = repoSlug.slice("http://github.com/".length);
    const title = `Import skills from ${repoSlug}`;
    const body = buildIssueBody({
      sourceRepoUrl,
      ref: resolvedRef,
      items: selectedItems.map((s) => ({
        sourcePath: s.sourcePath,
        id: s.id,
        title: s.title,
        targetCategory: skillMetadata[s.sourcePath]?.category ?? defaultCategory,
        targetSubcategory: skillMetadata[s.sourcePath]?.subcategory ?? defaultSubcategory,
        tags: skillMetadata[s.sourcePath]?.tags ?? [],
      }))
    });

    return `https://github.com/${REPO_SLUG}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }, [sourceRepoUrl, resolvedRef, selectedItems, skillMetadata, defaultCategory, defaultSubcategory]);

  async function onParse() {
    setError(null);
    setDetected([]);
    setSelected({});
    setSkillMetadata({});
    setExpandedSkill(null);
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
      const initialMetadata: Record<string, SkillMetadata> = {};

      for (const c of candidates) {
        try {
          const mdContent = await ghFileText(parsed.owner, parsed.repo, c.skillMdPath, ref);

          // Try to extract metadata from SKILL.md frontmatter or content
          const frontmatter = parseSkillMdFrontmatter(mdContent);
          const headingTitle = extractTitleFromMarkdown(mdContent);

          const id = frontmatter.id || c.dir.split("/").pop() || c.dir || "unknown";
          const title = frontmatter.title || headingTitle || id;
          const description = frontmatter.description || "";
          const sourcePath = c.dir || ".";

          detectedSkills.push({
            sourcePath,
            skillMdPath: c.skillMdPath,
            id,
            title,
            description
          });

          // Initialize metadata with defaults
          initialMetadata[sourcePath] = {
            category: defaultCategory,
            subcategory: defaultSubcategory,
            tags: [],
          };
        } catch {
          // Skip if we can't read the file
          continue;
        }
      }

      setDetected(detectedSkills);
      setSelected(Object.fromEntries(detectedSkills.map((s) => [s.sourcePath, true])));
      setSkillMetadata(initialMetadata);
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
                Click each skill to configure category, subcategory and tags.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-md text-sm font-mono text-accent bg-accent-muted">
              {selectedItems.length} / {detected.length} selected
            </span>
          </div>

          {/* Default category/subcategory for batch apply */}
          <div className="mt-5 p-4 bg-background-secondary rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18" />
              </svg>
              <span className="text-sm font-medium text-foreground">Default Category (for new imports)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                className="w-full h-10 px-3 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <select
                className="w-full h-10 px-3 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                value={defaultSubcategory}
                onChange={(e) => setDefaultSubcategory(e.target.value)}
              >
                {defaultSubcategoryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="mt-3 text-sm text-accent hover:underline"
              onClick={() => {
                // Apply default to all selected skills
                setSkillMetadata((prev) => {
                  const updated = { ...prev };
                  for (const s of detected) {
                    if (selected[s.sourcePath]) {
                      updated[s.sourcePath] = {
                        ...updated[s.sourcePath],
                        category: defaultCategory,
                        subcategory: defaultSubcategory,
                      } as SkillMetadata;
                    }
                  }
                  return updated;
                });
              }}
            >
              Apply to all selected skills
            </button>
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

          {/* Skill list with per-skill metadata editing */}
          <div className="mt-6 space-y-3">
            {detected.map((s) => {
              const meta = skillMetadata[s.sourcePath];
              const isExpanded = expandedSkill === s.sourcePath;
              const subcatOptions = meta ? getSubcategories(meta.category) : [];

              return (
                <div
                  key={s.sourcePath}
                  className={`rounded-xl border transition-colors ${
                    selected[s.sourcePath]
                      ? "bg-accent-muted/50 border-accent/30"
                      : "bg-background-secondary border-border"
                  }`}
                >
                  {/* Skill header row */}
                  <div className="p-4">
                    <div className="flex gap-4 items-start">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[s.sourcePath])}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [s.sourcePath]: e.target.checked }))}
                        className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{s.title}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-mono text-muted bg-card border border-border">
                            {s.id}
                          </span>
                          {meta && (
                            <span className="px-2 py-0.5 rounded text-xs font-mono text-accent bg-accent-muted">
                              {meta.category}/{meta.subcategory}
                            </span>
                          )}
                          {meta && meta.tags.length > 0 && (
                            <div className="flex gap-1">
                              {meta.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded text-xs text-muted bg-card border border-border">
                                  {tag}
                                </span>
                              ))}
                              {meta.tags.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded text-xs text-muted">+{meta.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-muted">{s.sourcePath}</span>
                        </div>
                        {s.description && (
                          <p className="text-secondary text-sm mt-2 line-clamp-2">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedSkill(isExpanded ? null : s.sourcePath)}
                        className="p-2 rounded-lg hover:bg-card transition-colors"
                        title="Edit metadata"
                      >
                        <svg
                          className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded metadata editor */}
                  {isExpanded && meta && (
                    <div className="px-4 pb-4 pt-0 border-t border-border/50">
                      <div className="pt-4 space-y-4">
                        {/* Category and Subcategory */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted mb-1.5">Category</label>
                            <select
                              className="w-full h-9 px-3 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                              value={meta.category}
                              onChange={(e) => {
                                const newCat = e.target.value;
                                const newSubcats = getSubcategories(newCat);
                                updateSkillMetadata(s.sourcePath, {
                                  category: newCat,
                                  subcategory: newSubcats[0]?.id ?? "",
                                });
                              }}
                            >
                              {categoryOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted mb-1.5">Subcategory</label>
                            <select
                              className="w-full h-9 px-3 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                              value={meta.subcategory}
                              onChange={(e) => updateSkillMetadata(s.sourcePath, { subcategory: e.target.value })}
                            >
                              {subcatOptions.map((sc) => (
                                <option key={sc.id} value={sc.id}>
                                  {sc.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Tags */}
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1.5">Tags</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {meta.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-card border border-border"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(s.sourcePath, tag)}
                                  className="text-muted hover:text-foreground"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Add tag..."
                              className="flex-1 h-9 px-3 bg-card border border-border rounded-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const input = e.currentTarget;
                                  addTag(s.sourcePath, input.value);
                                  input.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="px-3 h-9 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-card-hover transition-colors"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input) {
                                  addTag(s.sourcePath, input.value);
                                  input.value = "";
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>
                          <p className="text-xs text-muted mt-1.5">
                            Press Enter to add. Tags help with searchability.
                          </p>
                        </div>

                        {/* Source info (read-only) */}
                        <div className="pt-3 border-t border-border/50">
                          <p className="text-xs text-muted">
                            <span className="font-medium">Source:</span> {s.skillMdPath}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
