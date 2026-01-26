# CLI (`aiskill`)

The CLI installs and manages skills in agent directories.

## Commands

### List skills

```bash
npx aiskill list
npx aiskill list --json
```

Options:

- `--registry <url>`: override registry repository
- `--ref <ref>` / `--branch <ref>`: use a specific Git ref (branch/tag)

### Add (install) a skill

```bash
npx aiskill add <skill-id> --agent claude --scope project
```

Options:

- `--agent <name>`: `claude`, `codex`, `opencode`, `cursor`, `antigravity`
- `--scope <scope>`: `project` (default) or `global`
- `--registry <url>`: override registry repository
- `--ref <ref>` / `--branch <ref>`: use a specific Git ref (branch/tag)

Notes:

- The installer excludes `.x_skill.yaml` (registry-only metadata)
- `<skill-id>` must be a slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

### Remove an installed skill

```bash
npx aiskill remove <skill-id> --agent claude --scope project
```

## Environment Variables

- `SKILL_REGISTRY_URL`: default registry GitHub URL (e.g. `https://github.com/OWNER/REPO`)
- `SKILL_REGISTRY_REF`: default Git ref to use (e.g. `main`, `v1.2.3`)

Flags take precedence over env vars.

## How the CLI Works

1. Fetches `registry/index.json` from:
   - `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/registry/index.json`
2. Finds the selected skill’s `repoPath`
3. Downloads the GitHub tarball and extracts only that subdirectory into your agent’s skills dir

## Requirements

- Node.js >= 18
- `curl` and `tar` available in your shell (macOS/Linux are OK; Windows 10+ usually includes both)

