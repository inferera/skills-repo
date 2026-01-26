# Troubleshooting

## CLI

### `Skill "x" not found in registry`

Common causes:

- `registry/index.json` was not updated/committed in the registry repo
- you are pointing at the wrong registry (`--registry` or `SKILL_REGISTRY_URL`)
- you are pointing at the wrong ref (`--ref` or `SKILL_REGISTRY_REF`)

Fix:

```bash
npm run validate
npm run build:registry
```

Commit and push `registry/*.json`, then retry.

### `curl` / `tar` not found

The installer shells out to `curl` and `tar`.

- macOS/Linux: usually available by default
- Windows: ensure `curl.exe` and `tar.exe` are in PATH

## Site (GitHub Pages)

### Assets or pages 404 on project pages

Make sure `SITE_BASE_PATH` is set (usually to your repo name) so `basePath`/`assetPrefix` are correct.

## Importer

### Import workflow never runs

- The issue must be labeled `import-approved`
- Check repo Actions permissions allow PR creation

### Importer fails with “Missing SKILL.md”

Ensure `items[].sourcePath` points to a directory containing `SKILL.md`.

### Imported files are missing

Symlinks are skipped for safety. Replace symlinks with real files before importing.

