# Importer (GitHub Repo → Issue → PR)

The Importer lets contributors import skills from a public GitHub repository without giving this site any backend credentials.

Flow:

1. Use the site UI (`/import`) to generate an import issue
2. A maintainer applies label `import-approved`
3. GitHub Actions runs the importer and opens a PR into this repo

## Use the UI

1. Open `/import`
2. Paste `https://github.com/owner/repo`
3. Select one or more detected `SKILL.md` directories
4. Pick a target `category/subcategory` for each item
5. Click “Open import issue”

## Issue Format (v2)

The issue body contains a machine-readable block:

```text
<!-- skillhub-import:v2
sourceRepo: https://github.com/OWNER/REPO
ref: main
items:
  - sourcePath: path/to/skill-dir
    id: your-skill-id
    title: Human readable title
    targetCategory: development
    targetSubcategory: frontend
    tags: [tag-a, tag-b]
    isUpdate: true
-->
```

Rules:

- `items[].id`, `targetCategory`, `targetSubcategory` must be slugs
- `items[].sourcePath` must not contain `..`
- `isUpdate: true` allows replacing an existing skill with the same id

Template file: `.github/ISSUE_TEMPLATE/import-request.md`

## What the Importer Does

Workflow: `.github/workflows/import.yml`

Script: `scripts/import-from-issue.mjs`

For each item, it:

1. Clones `sourceRepo` at `ref`
2. Copies `sourcePath` into `skills/<category>/<subcategory>/<id>/`
3. Generates `.x_skill.yaml` (and excludes any source `.x_skill.yaml`)
4. Runs `npm run validate`
5. Opens a PR with the changes

## Security and Limits

Defaults (to reduce risk):

- Max items per issue: 20
- Max copied files per item: 2500
- Max copied bytes per item: 50MB
- Skips symlinks (does not follow them)
- Skips common non-skill folders: `.git/`, `node_modules/`, `.next/`, `dist/`, `out/`

## Known Constraints

- Only public GitHub repositories are supported by the UI (browser GitHub API calls without auth).

