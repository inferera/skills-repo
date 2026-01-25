# Skills Registry (WIP)

Open-source repository for managing a community skills registry:

- 2-level categories: `skills/<category>/<subcategory>/<skill-id>/`
- per-skill metadata: `skill.yaml` (structured) + `SKILL.md` (human instructions)
- static site (Next.js static export) for browsing/searching skills + importer UI
- importer: paste a GitHub repo URL -> select skills -> open an import issue -> GitHub Action opens a PR
- Node.js CLI (planned) to install skills into agent CLIs (codex / claude code / gemini cli / opencode / ...)

Design + architecture spec:

- `docs/RFC-0001-skills-registry.md`
- 部署与使用手册（中文）：`docs/DEPLOYMENT.zh-CN.md`

## Repository Layout

```txt
skills/      # source of truth: community skills
schemas/     # JSON Schemas (skill.yaml)
scripts/     # build/validate utilities
site/        # Next.js static site
docs/        # RFCs and contributor docs
registry/    # generated indexes for the site/tooling
```

Note: `.codex/` is currently a legacy folder used by local tooling; the canonical skill sources live under `skills/`.

## Adding a Skill (v1)

1. Create a folder: `skills/<category>/<subcategory>/<skill-id>/`
2. Add:
   - `SKILL.md`
   - `skill.yaml` (see `schemas/skill.schema.json`)

## Local Dev

From repo root:

```bash
# install tooling deps
npm install

# validate + build generated registry JSON into `registry/` and `site/public/registry/`
npm run validate
npm run build:registry

# run the Next.js site
npm install --prefix site
npm run dev --prefix site
```
