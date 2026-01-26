# Skills Registry

Community-maintained registry of skills for AI agents:

- Canonical skills: `skills/<category>/<subcategory>/<skill-id>/`
- Per-skill metadata: `.x_skill.yaml` (validated) + `SKILL.md` (instructions)
- Static site (`site/`) for browsing/searching + an Importer UI
- `aiskill` CLI (via `npx`) to install skills into agent directories

Docs:

- English: `docs/index.md`
- 中文：`docs/index.zh-CN.md`

## Quickstart

```bash
# From GitHub (no npm publish needed)
npx github:OWNER/REPO list
npx github:OWNER/REPO add ui-ux-pro-max --agent claude --scope project

# From npm (after publishing)
npx aiskill list
npx aiskill add ui-ux-pro-max --agent claude --scope project
```

## Contribute

Preferred flow for contributors:

- Host your skill in a public GitHub repo (must contain `SKILL.md`)
- Use the site `/import` page to submit an import issue

See `docs/contributing.md` and `docs/importer.md`.

## Repository Layout

```txt
skills/      # source of truth: community skills
schemas/     # JSON Schemas (.x_skill.yaml)
scripts/     # build/validate utilities
cli/         # CLI tool (aiskill)
site/        # Next.js static site (static export)
docs/        # documentation (EN + zh-CN)
registry/    # generated indexes for site/tooling
```

See `docs/contributing.md` for the contribution workflow and `docs/deployment.md` for GitHub Pages/Vercel deployment.
