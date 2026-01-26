# Maintainers Guide

## CI Workflows

- `validate`: `.github/workflows/validate.yml`
  - runs `npm ci`
  - runs `npm run validate`
  - builds registry + site to ensure the repo is deployable
- `deploy`: `.github/workflows/deploy.yml`
  - deploys the static site to GitHub Pages on `main`
- `import`: `.github/workflows/import.yml`
  - issue label gate: `import-approved`
  - runs `scripts/import-from-issue.mjs` and opens a PR

## Accepting Skill PRs

Checklist:

1. Skill follows layout: `skills/<category>/<subcategory>/<skill-id>/`
2. `SKILL.md` and `.x_skill.yaml` exist
3. `npm run validate` passes
4. `npm run build:registry` has been run and `registry/*.json` is included in the PR

Why `registry/*.json` matters:

- The CLI fetches `registry/index.json` from GitHub raw URLs
- The static site uses the registry outputs at build time

## Importer Operations

1. Confirm the `import-approved` label exists in the repo
2. Confirm Actions permissions allow PR creation (`contents: write`, `pull-requests: write`)
3. Review the PR created by the importer like any other contribution

Security posture:

- The workflow runs only after maintainers add the label
- The importer skips symlinks and enforces file/size limits

## Publishing the CLI to npm (optional)

This repo exposes the `aiskill` binary via `package.json#bin`.

Suggested steps:

```bash
npm version patch|minor|major
npm publish
```

After publishing, users can run:

```bash
npx aiskill list
```

## Repo Hygiene

Do not commit:

- `site/.env.local`
- installed skill copies under `./.claude/skills/`, `./.codex/skills/`, etc.

