# Codebase Audit (Issues + Recommendations)

This document summarizes what the repo is doing, what the current design implies, and the highest-impact issues found during review (with concrete file locations and recommended fixes).

## What This Repo Is

This repository is a **Skills Registry** with three distribution surfaces:

1. **Source of truth**: `skills/<category>/<subcategory>/<skill-id>/`
   - Required: `SKILL.md` + `.x_skill.yaml`
2. **Generated registry**: `registry/*.json` (built from `skills/`)
   - Consumed by the CLI and the site
3. **Static website**: `site/` (Next.js static export)
   - Browsing/searching
   - Importer UI (`/import`) to generate an issue that triggers a PR

Supporting automation:

- `scripts/build-registry.mjs` builds `registry/*.json` and copies them to `site/public/registry/*.json`
- `scripts/validate.mjs` validates `.x_skill.yaml` against `schemas/skill.schema.json`
- `.github/workflows/import.yml` runs `scripts/import-from-issue.mjs` to import skills from external repos via an issue label gate

## P0 / P1 Bugs and Risks (and Where)

### 1) CLI install pathing and tarball root mismatch (fixed)

Where:

- `cli/commands/add.mjs`
- Docs/UI also referenced the wrong tarball structure in older content (e.g. `INSTALL.md`, site install snippets).

Why it was a bug:

- GitHub tarballs have a top-level root directory (e.g. `<repo>-<ref>`). If you compute it incorrectly, `tar` extraction fails (“Not found in archive”).
- BSD `tar` (macOS) is stricter about flag ordering; placing options after the file list can break extraction.

Fix applied:

- Reworked `cli/commands/add.mjs` to use:
  - `https://codeload.github.com/<owner>/<repo>/tar.gz/<ref>` tarball
  - correct archive root + `--strip-components` math
  - portable tar option ordering
- Added shared helpers under `cli/lib/` to avoid re-implementing GitHub/tar logic across commands.

### 2) Importer UI broke on GitHub Pages `basePath` (fixed)

Where:

- Previously: `site/app/import/page.tsx` fetched absolute URLs like `fetch("/registry/index.json")`.

Why it was a bug:

- On GitHub Pages project sites, the site is served under `/<repo-name>/…`. Absolute fetches to `/registry/*` bypass the base path and 404.

Fix applied:

- Refactored Importer into:
  - server route: `site/app/import/page.tsx` (loads registry via `site/lib/registry.ts`)
  - client UI: `site/app/import/ImportClient.tsx` (receives the registry data as props)

### 3) Import request template incompatible with importer parser (fixed)

Where:

- `.github/ISSUE_TEMPLATE/import-request.md`
- `scripts/import-from-issue.mjs`

Why it was a bug:

- The issue template was `skillhub-import:v1` and missing required `items[].id` fields.
- `scripts/import-from-issue.mjs` requires `items[].id` and other fields to generate `.x_skill.yaml`.

Fix applied:

- Updated `.github/ISSUE_TEMPLATE/import-request.md` to `skillhub-import:v2` and included required fields.

### 4) Importer followed symlinks (security risk) (fixed)

Where:

- `scripts/import-from-issue.mjs` (`copyDirChecked`)

Why it is risky:

- Following symlinks during import can copy files outside the repo checkout (e.g. host files or runner workspace), which is a classic supply-chain + secret exfiltration footgun.

Fix applied:

- Importer now **skips symlinks** (logs a warning, does not follow).

### 5) Broken / duplicate installer implementation (fixed by removal)

Where:

- `scripts/install-skill.mjs`

Why it was a bug:

- The script crashed on startup (`Extract` import from `node:stream` is invalid).
- It duplicated the responsibility of the real CLI (`cli/`) and drifted.

Fix applied:

- Removed `scripts/install-skill.mjs` to reduce maintenance surface.

### 6) Tracked local artifacts polluted the repo (fixed)

Where:

- `site/.env.local` was committed.
- Installed skill copies were committed under:
  - `.codex/skills/**`
  - `.claude/skills/**`
- `.codex/skills/**` contained committed `__pycache__/*.pyc` binaries.

Why it matters:

- Confuses the “source of truth” (skills are under `skills/`, not `.codex/skills/`).
- Bloats GitHub tarballs and slows down installs/builds.
- Committing `.env.local` is almost always wrong (local-only).

Fix applied:

- Deleted the tracked artifacts and added ignores:
  - `.gitignore`: `site/.env.local` + `.<agent>/skills/`
  - `.npmignore`: ignore agent folders so npm package stays small
- Updated `site/.env.example` to include `NEXT_PUBLIC_REPO_REF`.

## Maintainability / Design Issues (Recommendations)

### A) “Generated files must be committed” vs. “CI generates them” contradiction

Where:

- Old docs contradicted each other (e.g. Chinese deployment doc claimed registry outputs don’t need committing).

Why it matters:

- The CLI fetches `registry/index.json` via GitHub raw URLs.
- If `registry/*.json` are not committed, the CLI cannot reliably install skills from GitHub.

Recommendation:

- Make one policy the single source of truth:
  - Either commit `registry/*.json` (current distribution contract), or
  - change the CLI to fetch registry from a guaranteed published artifact (e.g. GitHub Releases, npm package assets, or a hosted endpoint).

### B) Duplication of agent definitions across CLI and site

Where:

- CLI: `cli/lib/agents.mjs`
- Site: `site/components/QuickInstallClient.tsx`

Recommendation:

- Put agent metadata in one shared file (e.g. `shared/agents.json`) and import it in both places.

### C) Registry generation churn (`generatedAt`) makes “up to date” checks hard

Where:

- `scripts/build-registry.mjs` embeds `generatedAt = new Date().toISOString()` into outputs.

Why it matters:

- Any rebuild changes outputs even if skills didn’t change, creating noisy diffs.
- Hard to enforce “registry is up to date” in CI using `git diff --exit-code`.

Recommendation:

- Make `generatedAt` deterministic (e.g. based on `git rev-parse HEAD` or omit it), or add a mode for deterministic builds in CI.

### D) Importer UI rate-limits and robustness

Where:

- `site/app/import/ImportClient.tsx` calls GitHub REST APIs from the browser without auth.

Risks:

- GitHub unauthenticated rate limits can break imports for heavy use.

Recommendation:

- Keep it as-is for OSS simplicity, but document the constraint and consider an optional token input (client-side) if needed.

### E) `_category.yaml` has no schema validation

Where:

- `scripts/lib/registry.mjs` loads `_category.yaml` but doesn’t validate shape beyond `id` mismatch checks.

Recommendation:

- Add a JSON schema for `_category.yaml` and validate in `scripts/validate.mjs`.

### F) Site performance lint warnings (optional)

Where:

- `site/components/SkillCard.tsx` and `site/components/SkillMiniCard.tsx` use `<img>` (Next recommends `<Image />`).

Recommendation:

- Consider migrating to `next/image` if you want best LCP, or keep `<img>` since this site is a fully static export.

