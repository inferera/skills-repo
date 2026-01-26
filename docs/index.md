# Documentation

This repository is a community **Skills Registry**:

- Canonical skills live in `skills/<category>/<subcategory>/<skill-id>/`
- Each skill has `SKILL.md` (human instructions) + `.x_skill.yaml` (registry metadata)
- `scripts/build-registry.mjs` generates `registry/*.json` used by the CLI and the site
- `site/` is a Next.js static export for browsing/searching + an Importer UI
- `aiskill` is an `npx` CLI for installing skills into agent tool directories

Chinese docs: `docs/index.zh-CN.md`

## Docs Map

- `docs/quickstart.md` — install a skill, browse the site
- `docs/contributing.md` — how to submit a skill (UI-first)
- `docs/cli.md` — `aiskill` CLI usage and configuration
- `docs/importer.md` — Importer UI + issue format + security constraints
- `docs/deployment.md` — GitHub Pages + Vercel deployment (internal or forked registries)
- `docs/maintainers.md` — maintainer workflow, CI, releases
- `docs/troubleshooting.md` — common problems and fixes
- `docs/audit.md` — code audit: issues found + recommended improvements
- `docs/plan.md` — detailed roadmap / refactor plan
