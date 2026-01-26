# Quickstart

## Browse Skills

- Use the static site (`site/`) to browse and search skills.
- Open a skill detail page to read `SKILL.md` and copy an install command.

## Install a Skill (CLI)

The CLI binary is `aiskill`.

### Option A: Run from GitHub (no npm publish needed)

```bash
npx github:OWNER/REPO list
npx github:OWNER/REPO add ui-ux-pro-max --agent claude --scope project
npx github:OWNER/REPO remove ui-ux-pro-max --agent claude --scope project
```

### Option B: Run from npm (after you publish)

```bash
npx aiskill list
npx aiskill add ui-ux-pro-max --agent claude --scope project
npx aiskill remove ui-ux-pro-max --agent claude --scope project
```

## Agents and Scopes

- `--agent`: `claude`, `codex`, `opencode`, `cursor`, `antigravity`
- `--scope`:
  - `project`: installs into `./.<agent>/skills/<skill-id>/`
  - `global`: installs into `~/.<agent>/skills/<skill-id>/`

## Use a Custom Registry (fork / internal)

```bash
export SKILL_REGISTRY_URL="https://github.com/your-org/skills-repo"
export SKILL_REGISTRY_REF="main" # or a tag/branch

npx aiskill list
npx aiskill add your-skill-id --agent codex --scope project
```

See `docs/cli.md` for all flags and configuration.

