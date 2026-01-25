---
title: "RFC-0001: Skills Registry Repo (2-level categories + static site + importer PR bot)"
status: Draft
lastUpdated: 2026-01-25
---

# RFC-0001: Skills Registry Repo

## 0. Summary

We want an open-source repository that:

- Stores community "skills" with a predictable directory layout (2-level categories).
- Stores structured metadata per-skill for indexing and parsing.
- Builds a static website that can browse and search skills.
- Provides an importer UI: paste a GitHub repo URL, detect skills, select, then create a PR into this repo (without a backend).
- Provides a Node.js CLI to install skills into popular agent CLIs (codex, claude code, gemini cli, opencode, ...).

Constraint choices confirmed:

- Categories: exactly 2 levels.
- Skill files: `SKILL.md + skill.yaml`.
- Importer: Web UI + PR.
- Site: pure static deployment.

## 1. Goals / Non-goals

### Goals

- **Repository convention**: `skills/<category>/<subcategory>/<skill-id>/`.
- **Metadata**: `skill.yaml` is the single structured source of truth per skill.
- **Indexing**: generate `registry/*.json` for site + tooling consumption.
- **Static site**:
  - browse category list + category pages
  - skill detail page (metadata + rendered SKILL.md + file tree + related skills)
  - filter by category + keyword search (offline client-side)
- **Importer** (no backend):
  - parse a GitHub repo from the browser
  - create a PR via GitHub Actions (issue -> action -> PR) for maintainers
- **CLI**:
  - install a chosen skill into a target agent environment (project/global scopes where possible)

### Non-goals (v1)

- A dynamic backend or authenticated API.
- Private-repo imports (can be added later with GitHub App / OAuth).
- Executing untrusted code during import (we only copy files, validate, and open PR).
- A "marketplace" payment/billing system.

## 2. Repository Layout

Canonical source of truth:

```txt
skills/
  <category>/
    _category.yaml
    <subcategory>/
      _category.yaml
      <skill-id>/
        SKILL.md
        skill.yaml
        scripts/ ... (optional)
        assets/ ...  (optional)
```

Supporting folders:

```txt
docs/                     # RFCs and contributor docs
schemas/                  # JSON Schemas for validation
scripts/                  # build/validate utilities (Node)
site/                     # static site (Next.js static export)
registry/                 # build artifacts (generated; not edited by hand)
```

Notes:

- `registry/` is generated in CI on `main` and used by `site/` build. We should treat it as build output, not a hand-edited source.
- `_category.yaml` is optional but recommended to avoid "slug-only" category names in the UI.

## 3. Skill Format

### 3.1 Skill directory identity

- `skill-id` is globally unique across the repo.
- `skill-id` is the directory name of the skill folder.
- `skill-id` must match pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

### 3.2 Required files

- `SKILL.md`: human-readable instructions (rendered on the site; used by agents).
- `skill.yaml`: structured metadata for indexing/validation.

### 3.3 `SKILL.md` conventions (v1)

To keep instructions portable across installers/agents:

- Any referenced local files should be described as **relative to the skill root** (the directory containing `SKILL.md`).
- Prefer commands that work after `cd <skill-root>`.
- Avoid hardcoding paths like `skills/...` or tool-specific paths like `~/.codex/skills/...` in command examples.

### 3.4 `skill.yaml` spec (v1)

Minimal required fields:

```yaml
specVersion: 1
id: my-skill-id
title: Human readable title
description: One paragraph description
```

Recommended fields:

```yaml
license: MIT
authors:
  - name: your-handle
tags: [tag-1, tag-2]
agents: [codex, claude-code]
runtime: [node>=18, python>=3.9]
links:
  homepage: https://example.com
  docs: ./SKILL.md
source:
  repo: https://github.com/OWNER/REPO
  path: skills/somewhere/my-skill-id
  ref: main
  commit: abcdef0123456789
related: [another-skill-id]
```

Semantics:

- `agents`: capability hints for filtering (installer support may lag).
- `runtime`: human-oriented constraints; not enforced by the repo except optional lint rules.
- `source`: is primarily for imported skills; locally-authored skills can omit it.
- `links.docs` should usually be `./SKILL.md`.

## 4. Generated Registry Data (for site + tools)

We generate machine-readable JSON from `skills/**/skill.yaml` and `skills/**/SKILL.md`.

Files:

- `registry/categories.json` (2-level tree)
- `registry/index.json` (full skill list)
- `registry/search-index.json` (optional prebuilt search payload)

### 4.1 `registry/categories.json`

Shape:

```json
{
  "specVersion": 1,
  "generatedAt": "2026-01-25T00:00:00.000Z",
  "categories": [
    {
      "id": "design",
      "title": "Design",
      "description": "…",
      "subcategories": [
        { "id": "ui-ux", "title": "UI/UX", "description": "…" }
      ]
    }
  ]
}
```

- The `title/description` can come from `_category.yaml` if present; otherwise derive from the slug.

### 4.2 `registry/index.json`

Shape (v1):

```json
{
  "specVersion": 1,
  "generatedAt": "2026-01-25T00:00:00.000Z",
  "skills": [
    {
      "id": "ui-ux-pro-max",
      "title": "UI/UX Pro Max",
      "description": "…",
      "category": "design",
      "subcategory": "ui-ux",
      "repoPath": "skills/design/ui-ux/ui-ux-pro-max",
      "tags": ["ui", "ux"],
      "agents": ["codex"],
      "runtime": ["python>=3.9"],
      "license": "MIT",
      "authors": [{ "name": "xsc" }],
      "links": { "docs": "./SKILL.md" },
      "source": { "repo": "https://github.com/OWNER/REPO", "ref": "main" },
      "related": ["another-skill-id"],
      "summary": "First paragraph of SKILL.md…",
      "files": [
        { "path": "SKILL.md", "kind": "file" },
        { "path": "scripts/search.py", "kind": "file" }
      ]
    }
  ]
}
```

Notes:

- `summary` should be extracted as the first non-empty paragraph under the top heading in `SKILL.md`.
- `files` should exclude `.git`, `node_modules`, build outputs, and large binaries by default.

### 4.3 `registry/search-index.json`

Option A (simplest): do not prebuild; the site loads `index.json` and builds a client-side index.

Option B (better UX at scale): ship a minimal payload:

```json
{
  "specVersion": 1,
  "generatedAt": "2026-01-25T00:00:00.000Z",
  "docs": [
    {
      "id": "ui-ux-pro-max",
      "category": "design",
      "subcategory": "ui-ux",
      "title": "UI/UX Pro Max",
      "tags": ["ui", "ux"],
      "agents": ["codex"],
      "text": "title + description + tags + summary"
    }
  ]
}
```

## 5. Static Site

Recommendation: **Next.js (App Router) with static export** (pre-rendered HTML per route for good SEO; small client JS for search/import).

Routes:

- `/` home: search + featured/latest
- `/categories` category browser (2-level list/tree)
- `/c/<category>/<subcategory>` listing page with filters
- `/s/<skill-id>` skill detail page (render `SKILL.md`, show metadata, file tree)
- `/import` importer UI (repo URL -> select -> generate issue link)

Search/filtering:

- Use client-side search (FlexSearch or Lunr).
- Filters: category/subcategory, tags, agents, runtime keywords.

SEO:

- Pre-render all category and skill pages at build time (no runtime SSR).
- Use per-page metadata (title/description/Open Graph) derived from `registry/index.json`.
- Generate `sitemap.xml` and `robots.txt` during the build and ship them as static files.

Build inputs:

- Site build reads `registry/*.json` from the repo workspace (built in the same CI job).

## 6. Importer (pure static, creates PR via Actions)

### 6.1 Why "issue -> action -> PR"

In a pure static site, creating a PR directly from the browser requires GitHub OAuth token exchange, which is not a safe/reliable baseline for v1.

Instead:

- Browser can read public repo contents via GitHub API (CORS allowed).
- PR creation is delegated to GitHub Actions in this repo (server-side), triggered by a maintainer-approved issue label.

### 6.2 UI flow (`/import`)

1. Input: GitHub repo URL (and optional ref).
2. Browser calls GitHub API:
   - Resolve default branch.
   - Fetch file tree recursively.
   - Detect directories containing both `skill.yaml` and `SKILL.md`.
   - Fetch and parse `skill.yaml` for each candidate.
3. Show detected skills list with checkboxes.
4. User selects target `<category>/<subcategory>`.
5. UI generates a link to open a new issue in this repo with a prefilled body (includes a machine-readable block).
6. Maintainer reviews the issue; adds label `import-approved`.
7. Action runs: imports files and opens a PR.

### 6.3 Issue payload format (machine-readable block)

Embed a YAML block in the issue body:

```txt
<!-- skillhub-import:v1
sourceRepo: https://github.com/OWNER/REPO
ref: main
items:
  - sourcePath: path/in/source/repo/skill-dir
    targetCategory: design
    targetSubcategory: ui-ux
-->
```

Notes:

- This avoids complex issue forms and supports `?title=&body=` prefill URLs.
- Action parses this block, validates it, then proceeds.

### 6.4 Import Action (high level)

Trigger:

- `issues.labeled` when label is `import-approved`

Steps:

- Parse issue body for `skillhub-import:v1` block.
- Clone source repo at the requested `ref`.
- For each item:
  - Verify `skill.yaml` + `SKILL.md` exist.
  - Read `skill.yaml` to get `id` (fallback to directory name).
  - Copy directory to `skills/<category>/<subcategory>/<id>/`.
  - Inject/merge `source` fields (repo/path/ref/commit) into imported `skill.yaml`.
- Run `scripts/validate` + `scripts/build-registry` (optional) to ensure repo stays consistent.
- Create PR (e.g. `peter-evans/create-pull-request`).
- Comment PR link back to the issue; optionally close the issue.

Security controls:

- Action only runs after maintainer adds `import-approved` label.
- Hard limits:
  - max skills per request
  - max total file count and bytes copied
  - reject symlinks
  - ignore `.git`, `node_modules`, and other unsafe paths

## 7. CI / Automation

Workflows:

- `validate.yml` (PR): schema validation + path conventions + unique `id` check.
- `deploy.yml` (main): build registry + build site + deploy to GitHub Pages.
- `import.yml` (issues labeled): import -> PR.

## 8. Node.js CLI (installer)

Package goal: `npx skillhub add <skill-id> --agent <agent> --scope <scope>`.

Architecture:

- Core: resolve skill from this repo (local checkout) or from `registry/index.json` release artifact.
- Adapters:
  - `codex`: install into `~/.codex/skills/<id>` (global) or `./.codex/skills/<id>` (project)
  - `claude-code`: install into `./.claude/commands/<id>.md` or `./.claude/agents/…` (needs a spike)
  - `gemini-cli`, `opencode`: to be researched and implemented as adapters

Key design rule:

- Installer should never mutate user files without showing a plan (`--dry-run`) and supporting uninstall.

## 9. Open Questions

- Skill licensing policy: repo-wide license vs per-skill override.
- Claude Code integration format: commands vs agents vs plugins (needs validation).
- Whether `registry/` is committed or only built for Pages (recommended: build-only).
