"use client";

import { useMemo, useState, useCallback } from "react";

import { useI18n } from "@/components/I18nProvider";
import { getLocalizedText } from "@/lib/i18n";
import { REPO_SLUG } from "@/lib/config";
import type { RegistryCategories, RegistryIndex, RegistrySkill } from "@/lib/types";

const MAX_SKILLS_PER_IMPORT = 20;

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
  tags: string[];
  // For conflict resolution
  newId?: string; // If user wants to rename
};

// Conflict type
type ConflictType = "none" | "same-id" | "same-source";

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  let v = input.trim();
  if (!v) return null;
  v = v.replace(/^git\+/, "").replace(/\.git$/, "");

  // Support common SSH forms like: git@github.com:owner/repo
  const sshMatch = v.match(/^git@github\.com:([^/]+)\/(.+)$/);
  if (sshMatch) {
    const owner = sshMatch[1]?.trim();
    const repo = sshMatch[2]?.split("/")[0]?.trim();
    if (!owner || !repo) return null;
    return { owner, repo };
  }

  // Support ssh://git@github.com/owner/repo
  v = v.replace(/^ssh:\/\/git@github\.com\//, "");
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

  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const idMatch = frontmatter.match(/^id:\s*["']?(.+?)["']?\s*$/m);

  if (titleMatch) result.title = titleMatch[1];
  if (descMatch) result.description = descMatch[1];
  if (idMatch) result.id = idMatch[1];

  return result;
}

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
    tags: string[];
    isUpdate: boolean;
  }>;
}) {
  const newCount = args.items.filter((it) => !it.isUpdate).length;
  const updateCount = args.items.filter((it) => it.isUpdate).length;

  // Build compact YAML - only essential fields (v2: no subcategory)
  const itemLines = args.items.map((it) => {
    const lines = [
      `  - sourcePath: ${it.sourcePath}`,
      `    id: ${it.id}`,
      `    title: ${it.title}`,
      `    targetCategory: ${it.targetCategory}`,
    ];
    if (it.isUpdate) {
      lines.push(`    isUpdate: true`);
    }
    if (it.tags.length > 0) {
      lines.push(`    tags: [${it.tags.join(", ")}]`);
    }
    return lines.join("\n");
  });

  const block = [
    "<!-- skillhub-import:v2",
    `sourceRepo: ${args.sourceRepoUrl}`,
    `ref: ${args.ref}`,
    "items:",
    ...itemLines,
    "-->"
  ].join("\n");

  // Minimal summary - details are in the YAML block
  const summary = [
    `Submit ${args.items.length} skill(s): ${newCount} new, ${updateCount} update.`,
    "",
    "Add label `import-approved` to trigger the import workflow.",
    "",
    block,
  ].join("\n");

  return summary;
}

export function ImportClient({
  initialCategories,
  initialRegistryIndex,
}: {
  initialCategories: RegistryCategories;
  initialRegistryIndex: RegistryIndex;
}) {
  const { t, locale } = useI18n();
  const [repoInput, setRepoInput] = useState("");
  const [refInput, setRefInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceRepoUrl, setSourceRepoUrl] = useState<string>("");
  const [resolvedRef, setResolvedRef] = useState<string>("");

  const firstCategory = initialCategories.categories[0];
  const defaultCategory = firstCategory?.id ?? "";
  const [categories] = useState<RegistryCategories>(initialCategories);
  const [registryIndex] = useState<RegistryIndex>(initialRegistryIndex);

  const [detected, setDetected] = useState<DetectedSkill[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [skillMetadata, setSkillMetadata] = useState<Record<string, SkillMetadata>>({});
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Tab state: "new" or "update"
  const [activeTab, setActiveTab] = useState<"new" | "update">("new");

  const categoryOptions = useMemo(() => categories?.categories ?? [], [categories]);

  // Check if a skill already exists in registry
  const checkExistingSkill = useCallback((skillId: string, sourceRepo: string, sourcePath: string): { conflict: ConflictType; existing?: RegistrySkill } => {
    if (!registryIndex) return { conflict: "none" };

    // Check for same source (same repo + same path) - this is an update
    const sameSource = registryIndex.skills.find(
      (s) => s.source?.repo === sourceRepo && s.source?.path === sourcePath
    );
    if (sameSource) {
      return { conflict: "same-source", existing: sameSource };
    }

    // Check for same ID - potential conflict
    const sameId = registryIndex.skills.find((s) => s.id === skillId);
    if (sameId) {
      return { conflict: "same-id", existing: sameId };
    }

    return { conflict: "none" };
  }, [registryIndex]);

  // Categorize detected skills into new/update
  const { newSkills, updateSkills } = useMemo(() => {
    const newList: Array<DetectedSkill & { conflict: ConflictType; existing?: RegistrySkill }> = [];
    const updateList: Array<DetectedSkill & { conflict: ConflictType; existing?: RegistrySkill }> = [];

    for (const skill of detected) {
      const { conflict, existing } = checkExistingSkill(skill.id, sourceRepoUrl, skill.sourcePath);
      const item = { ...skill, conflict, existing };

      if (conflict === "same-source") {
        updateList.push(item);
      } else {
        newList.push(item);
      }
    }

    return { newSkills: newList, updateSkills: updateList };
  }, [detected, sourceRepoUrl, checkExistingSkill]);

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

  // Count selected skills
  const selectedCount = useMemo(() => {
    return Object.values(selected).filter(Boolean).length;
  }, [selected]);

  // Handle selection with max limit
  const handleSelect = useCallback((sourcePath: string, checked: boolean) => {
    if (checked && selectedCount >= MAX_SKILLS_PER_IMPORT) {
      return; // Don't allow selecting more than max
    }
    setSelected((prev) => ({ ...prev, [sourcePath]: checked }));
  }, [selectedCount]);

  const selectedItems = useMemo(() => detected.filter((d) => selected[d.sourcePath]), [detected, selected]);

  // Build review URL with encoded data
  const reviewData = useMemo(() => {
    if (selectedItems.length === 0 || !sourceRepoUrl || !resolvedRef) return null;
    return {
      sourceRepo: sourceRepoUrl,
      ref: resolvedRef,
      items: selectedItems.map((s) => {
        const meta = skillMetadata[s.sourcePath];
        const { conflict } = checkExistingSkill(s.id, sourceRepoUrl, s.sourcePath);
        const finalId = meta?.newId || s.id;
        // isUpdate is true if:
        // 1. Same source (definitely an update)
        // 2. Same ID and no newId provided (user wants to replace existing skill)
        const isUpdate = conflict === "same-source" || (conflict === "same-id" && !meta?.newId);
        return {
          sourcePath: s.sourcePath,
          id: finalId,
          title: s.title,
          description: s.description,
          targetCategory: meta?.category ?? defaultCategory,
          tags: meta?.tags ?? [],
          isUpdate,
        };
      })
    };
  }, [selectedItems, sourceRepoUrl, resolvedRef, skillMetadata, defaultCategory, checkExistingSkill]);

  const issueUrl = useMemo(() => {
    if (!REPO_SLUG) return "";
    if (!reviewData) return "";

    // Check if all selected items have valid metadata (v2: no subcategory)
    const allHaveMetadata = reviewData.items.every((it) => it.targetCategory);
    if (!allHaveMetadata) return "";

    let repoSlug = sourceRepoUrl;
    if (repoSlug.startsWith("https://github.com/")) repoSlug = repoSlug.slice("https://github.com/".length);
    else if (repoSlug.startsWith("http://github.com/")) repoSlug = repoSlug.slice("http://github.com/".length);
    const title = `Submit skills from ${repoSlug}`;
    const body = buildIssueBody({
      sourceRepoUrl,
      ref: resolvedRef,
      items: reviewData.items
    });

    return `https://github.com/${REPO_SLUG}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }, [sourceRepoUrl, resolvedRef, reviewData]);

  async function onParse() {
    setError(null);
    setDetected([]);
    setSelected({});
    setSkillMetadata({});
    setExpandedSkill(null);
    setSourceRepoUrl("");
    setResolvedRef("");
    setActiveTab("new");
    setLoading(true);

    try {
      const parsed = parseRepoUrl(repoInput);
      if (!parsed) throw new Error(t("import.error.invalidRepoUrl"));

      const repo = await ghRepo(parsed.owner, parsed.repo);
      const ref = refInput.trim() || repo.default_branch;
      const fullRepoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
      setSourceRepoUrl(fullRepoUrl);
      setResolvedRef(ref);

      const tree = await ghTree(parsed.owner, parsed.repo, ref);
      const blobs = new Set(tree.filter((t) => t.type === "blob").map((t) => t.path));

      // Only look for SKILL.md files
      let candidates = Array.from(blobs)
        .filter((p) => p.endsWith("/SKILL.md") || p === "SKILL.md")
        .map((skillMdPath) => {
          const dir = skillMdPath === "SKILL.md" ? "" : skillMdPath.replace(/\/SKILL\.md$/, "");
          return { dir, skillMdPath };
        });

      candidates = candidates.slice(0, 50); // Fetch up to 50 candidates

      const detectedSkills: DetectedSkill[] = [];
      const initialMetadata: Record<string, SkillMetadata> = {};

      for (const c of candidates) {
        try {
          const mdContent = await ghFileText(parsed.owner, parsed.repo, c.skillMdPath, ref);

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

          // Check for existing skill to pre-fill category
          const { existing } = checkExistingSkill(id, fullRepoUrl, sourcePath);
          initialMetadata[sourcePath] = {
            category: existing?.category ?? defaultCategory,
            tags: [],
          };
        } catch {
          continue;
        }
      }

      setDetected(detectedSkills);
      // Auto-select up to MAX_SKILLS_PER_IMPORT skills
      const autoSelect: Record<string, boolean> = {};
      detectedSkills.slice(0, MAX_SKILLS_PER_IMPORT).forEach((s) => {
        autoSelect[s.sourcePath] = true;
      });
      setSelected(autoSelect);
      setSkillMetadata(initialMetadata);

      // Switch to update tab if there are update skills
      const hasUpdates = detectedSkills.some((s) => {
        const { conflict } = checkExistingSkill(s.id, fullRepoUrl, s.sourcePath);
        return conflict === "same-source";
      });
      if (hasUpdates) {
        setActiveTab("update");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Render skill card
  function renderSkillCard(
    s: DetectedSkill & { conflict: ConflictType; existing?: RegistrySkill },
    isUpdateTab: boolean
  ) {
    const meta = skillMetadata[s.sourcePath];
    const isExpanded = expandedSkill === s.sourcePath;
    const isSelected = Boolean(selected[s.sourcePath]);
    const canSelect = isSelected || selectedCount < MAX_SKILLS_PER_IMPORT;

    return (
      <div
        key={s.sourcePath}
        className={`rounded-xl border transition-colors ${
          isSelected
            ? "bg-accent-muted/50 border-accent/30"
            : "bg-background-secondary border-border"
        }`}
      >
        {/* Skill header row */}
        <div className="p-4">
          <div className="flex gap-4 items-start">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleSelect(s.sourcePath, e.target.checked)}
              disabled={!canSelect && !isSelected}
              className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">{s.title}</span>
                <span className="px-2 py-0.5 rounded text-xs font-mono text-muted bg-card border border-border">
                  {meta?.newId || s.id}
                </span>
                {meta && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono text-accent bg-accent-muted">
                    {meta.category}
                  </span>
                )}
                {/* Conflict badges */}
                {isUpdateTab && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                    {t("import.skillCard.updateBadge")}
                  </span>
                )}
                {!isUpdateTab && s.conflict === "same-id" && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                    {t("import.skillCard.idConflictBadge")}
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
              {/* Conflict warning */}
              {!isUpdateTab && s.conflict === "same-id" && s.existing && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t("import.skillCard.sameIdConflict", {
                      id: s.id,
                      category: s.existing.category,
                    })}
                  </p>
                </div>
              )}
              {isUpdateTab && s.existing && (
                <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t("import.skillCard.updateNotice", {
                      id: s.existing.id,
                      category: s.existing.category,
                    })}
                  </p>
                </div>
              )}
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
              title={t("import.skillCard.editMetadata")}
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
              {/* Rename option for ID conflicts */}
              {!isUpdateTab && s.conflict === "same-id" && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    {t("import.skillCard.newSkillIdLabel")}
                  </label>
                  <input
                    type="text"
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors font-mono"
                    placeholder={s.id}
                    value={meta.newId || ""}
                    onChange={(e) => updateSkillMetadata(s.sourcePath, { newId: e.target.value || undefined })}
                  />
                  <p className="text-xs text-muted mt-1">
                    {t("import.skillCard.replaceExistingHint")}
                  </p>
                </div>
              )}

              {/* Category and Subcategory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">{t("import.skillCard.categoryLabel")}</label>
                  <select
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent transition-colors"
                    value={meta.category}
                    onChange={(e) => {
                      updateSkillMetadata(s.sourcePath, {
                        category: e.target.value,
                      });
                    }}
                  >
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {getLocalizedText(c.title, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">{t("import.skillCard.tagsLabel")}</label>
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
                    placeholder={t("import.skillCard.addTagPlaceholder")}
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
                    {t("common.add")}
                  </button>
                </div>
              </div>

              {/* Source info (read-only) */}
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted">
                  <span className="font-medium">{t("import.skillCard.sourceLabel")}</span> {s.skillMdPath}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <section className="p-6 bg-card border border-border rounded-xl">
        <h1 className="font-heading text-3xl font-bold text-foreground">{t("import.header.title")}</h1>
        <p className="text-secondary mt-3 leading-relaxed">
          {t("import.header.description.beforeSkillMd")}{" "}
          <code className="px-1.5 py-0.5 rounded bg-background-secondary text-accent text-sm font-mono">SKILL.md</code>
          {t("import.header.description.afterSkillMd", { max: MAX_SKILLS_PER_IMPORT })}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("import.header.sourceRepoLabel")}</label>
            <input
              className="w-full h-11 px-4 bg-background-secondary border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder={t("import.header.repoPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("import.header.branchLabel")}</label>
            <input
              className="w-full h-11 px-4 bg-background-secondary border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder={t("import.header.branchPlaceholder")}
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
                {t("import.header.parsing")}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                {t("import.header.parseRepository")}
              </>
            )}
          </button>
          <span className="px-3 py-1.5 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
            {t("import.header.usesAnonymousApi")}
          </span>
          {!REPO_SLUG && (
            <span className="px-3 py-1.5 rounded-md text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              {t("import.header.setRepoSlugHint")}
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
                <p className="font-medium text-red-800 dark:text-red-200">{t("common.error")}</p>
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
              <h2 className="font-heading text-xl font-semibold text-foreground">{t("import.detected.title")}</h2>
              <p className="text-secondary mt-2">
                {t("import.detected.description")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-md text-sm font-mono ${
                selectedCount >= MAX_SKILLS_PER_IMPORT
                  ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                  : "text-accent bg-accent-muted"
              }`}>
                {t("import.detected.selectedCount", { selected: selectedCount, max: MAX_SKILLS_PER_IMPORT })}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 border-b border-border">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "new"
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t("import.detected.tabNew", { count: newSkills.length })}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("update")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "update"
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t("import.detected.tabUpdate", { count: updateSkills.length })}
              </button>
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
              {t("import.detected.openIssue")}
            </a>
            <span className="px-3 py-1.5 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
              {t("import.detected.maintainersLabel")}
            </span>
          </div>

          {/* Skill list */}
          <div className="mt-6 space-y-3">
            {activeTab === "new" && (
              <>
                {newSkills.length === 0 ? (
                  <div className="text-center py-8 text-muted">
                    {t("import.detected.emptyNew")}
                  </div>
                ) : (
                  newSkills.map((s) => renderSkillCard(s, false))
                )}
              </>
            )}
            {activeTab === "update" && (
              <>
                {updateSkills.length === 0 ? (
                  <div className="text-center py-8 text-muted">
                    {t("import.detected.emptyUpdate")}
                  </div>
                ) : (
                  updateSkills.map((s) => renderSkillCard(s, true))
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
