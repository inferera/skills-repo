# Contributing a Skill

Contributors should **prefer the front-end submission flow** (Importer UI). It keeps the registry structure consistent and reduces “random directory PRs”.

## Preferred: Submit via the Importer UI

1) Prepare your skill in a public GitHub repo (or branch)

- Put your skill in a folder that contains `SKILL.md` (required).
- You may include any supporting files (scripts/assets/templates).
- You do **not** need to include `.x_skill.yaml` (the importer generates it).

2) Submit via the registry site

- Open `/import`
- Paste your repo URL (e.g. `https://github.com/owner/repo`)
- Select detected skills (directories containing `SKILL.md`)
- Choose the target `category/subcategory`
- Click **Open Import Issue**

3) Maintainer approval

- A maintainer adds label `import-approved`
- GitHub Actions imports files into `skills/<category>/<subcategory>/<skill-id>/` and opens a PR

Details: `docs/importer.md`

## Advanced: Direct PRs (maintainers / power users)

If you really need to edit this repo directly, follow the canonical layout:

`skills/<category>/<subcategory>/<skill-id>/`

Rules:

- `<category>`, `<subcategory>`, `<skill-id>` must be slugs: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Required files: `SKILL.md` + `.x_skill.yaml`
- Run from repo root:

```bash
npm install
npm run validate
npm run build:registry
```

Commit your skill folder and the updated `registry/*.json`, then open a PR.
