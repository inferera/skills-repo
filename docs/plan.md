# Roadmap / Plan

This plan is designed for:

1. Community contributors who want to share skills
2. Internal teams who want to fork, deploy, and migrate registries (GitHub Pages + Vercel)

Constraints:

- Keep docs “latest only” (avoid RFC/duplicated docs)
- Bilingual documentation (EN + zh-CN)
- Functionality must remain complete; changes must be self-tested

## Phase 0 — Align on Single Source of Truth (Docs + Contracts)

Deliverables:

- A docs map with paired files (`docs/x.md` + `docs/x.zh-CN.md`)
- Remove contradictory / obsolete docs
- Clarify distribution contract:
  - skills live under `skills/`
  - `registry/*.json` are required for CLI/site distribution

Acceptance criteria:

- Contributors can find “How to add a skill” in ≤ 2 clicks
- Deployment instructions cover GitHub Pages + Vercel

## Phase 1 — Fix P0/P1 Functionality Bugs (CLI + Importer)

Targets:

- CLI install works on macOS/Linux (BSD/GNU tar)
- Importer works on GitHub Pages `basePath`
- Import issue template matches importer parser
- Remove/avoid unsafe behaviors (path traversal, symlink following)

Acceptance criteria:

- `aiskill add` succeeds for at least one skill
- `/import` loads categories/index correctly under basePath
- Import workflow can parse a v2 issue block

## Phase 2 — Repo Hygiene + Configurability

Targets:

- Remove committed local artifacts (`site/.env.local`, `.<agent>/skills/**`, `*.pyc`)
- Ensure defaults are configurable via environment variables and flags

Acceptance criteria:

- `git status` stays clean after local installs/builds (ignored outputs)
- Forking/migration requires only env changes, not code edits

## Phase 3 — Documentation Rewrite (EN + zh-CN)

Docs should be written for real users:

- Quickstart: install + browse
- Contributing: skill format + validation + PR flow
- CLI: commands + flags + env vars
- Importer: UI flow + issue format + security limits
- Deployment: GitHub Pages + Vercel
- Maintainers: CI, label gates, release/publish
- Troubleshooting: common failures
- Audit: known issues + recommended improvements

Acceptance criteria:

- No duplicated “install” instructions across multiple files
- Examples use placeholders (`OWNER/REPO`) and explain required env vars
- Chinese and English pages are equivalent in content structure

## Phase 4 — Verification / Self-Test Checklist

Run locally from repo root:

```bash
npm run validate
npm run build:registry
npm run build:site
```

CLI smoke tests (in a temp folder):

```bash
mkdir -p /tmp/aiskill-test && cd /tmp/aiskill-test
node /path/to/repo/cli/index.mjs list
node /path/to/repo/cli/index.mjs add ui-ux-pro-max --agent claude --scope project
node /path/to/repo/cli/index.mjs remove ui-ux-pro-max --agent claude --scope project
```

Importer smoke test:

- Create an issue using `.github/ISSUE_TEMPLATE/import-request.md`
- Apply label `import-approved`
- Verify the workflow opens a PR and `npm run validate` passes

## Phase 5 — Optional Future Improvements

High-value follow-ups:

- Make `registry/*.json` deterministic to reduce noisy diffs (`generatedAt`)
- Add schema validation for `_category.yaml`
- Share agent definitions between CLI and site
- Add unit tests for:
  - importer issue parsing
  - CLI registry fetching and path validation

