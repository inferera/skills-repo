# Skill Installation Guide

## Overview

This repository provides multiple ways to install agent skills to your local development environment.

## Installation Methods

### Method 1: One-Line Install (Recommended)

The simplest way to install a skill is using the provided one-line command. This method downloads the skill files directly from GitHub and places them in the appropriate directory.

**Example:**
```bash
# Install ui-ux-pro-max to Claude Code project skills
mkdir -p ".claude/skills/ui-ux-pro-max"
curl -sL "https://github.com/xue1213888/skills-repo/archive/refs/heads/main.tar.gz" | \
  tar -xz --strip-components=5 \
  "skills-repo-main/skills/design/ui-ux/ui-ux-pro-max" \
  --exclude=".x_skill.yaml" \
  -C ".claude/skills/ui-ux-pro-max/"
```

**What it does:**
1. Creates the target directory
2. Downloads the repository as a tarball
3. Extracts only the specific skill files
4. Excludes internal metadata (`.x_skill.yaml`)

### Method 2: CLI Tool

Use the included CLI tool for a more interactive experience:

```bash
# Install to project (current directory)
node scripts/install-skill.mjs ui-ux-pro-max --agent claude --scope project

# Install globally (user home directory)
node scripts/install-skill.mjs ui-ux-pro-max --agent claude --scope global

# List available skills
node scripts/install-skill.mjs --list

# Get help
node scripts/install-skill.mjs --help
```

**Supported Agents:**
- `claude` - Claude Code
- `codex` - Codex
- `opencode` - OpenCode
- `cursor` - Cursor
- `antigravity` - Antigravity

**Supported Scopes:**
- `project` - Install to `.agent/skills/` in current directory
- `global` - Install to `~/.agent/skills/` in home directory

### Method 3: Manual Installation

1. Navigate to the [Skills Registry](https://your-site.com)
2. Browse or search for the skill you want
3. Click on the skill card
4. Copy the install command from the skill detail page
5. Run the command in your terminal

## Directory Structure

Skills are installed in the following locations:

**Project Scope:**
```
your-project/
├── .claude/skills/
│   └── skill-name/
├── .codex/skills/
│   └── skill-name/
└── ...
```

**Global Scope:**
```
~/
├── .claude/skills/
│   └── skill-name/
├── .codex/skills/
│   └── skill-name/
└── ...
```

## What Gets Installed

When you install a skill, the following files are copied:
- `SKILL.md` - Skill documentation and instructions
- All supporting files (scripts, configs, templates, etc.)

The `.x_skill.yaml` file is **excluded** as it's internal metadata used only by the registry.

## Verification

After installation, verify the skill was installed correctly:

```bash
# Check if skill directory exists
ls -la .claude/skills/skill-name/

# View the skill documentation
cat .claude/skills/skill-name/SKILL.md
```

## Troubleshooting

**Permission denied:**
```bash
# Make sure you have write permissions
chmod +w .claude/skills/
```

**Skill already exists:**
```bash
# Remove existing installation first
rm -rf .claude/skills/skill-name/
```

**Network issues:**
```bash
# Try with verbose output
curl -v "https://github.com/xue1213888/skills-repo/archive/refs/heads/main.tar.gz"
```

## Advanced Usage

### Install from a specific branch or commit

```bash
# Replace 'main' with your branch/tag/commit
curl -sL "https://github.com/xue1213888/skills-repo/archive/refs/heads/develop.tar.gz" | \
  tar -xz --strip-components=5 \
  "skills-repo-develop/skills/design/ui-ux/ui-ux-pro-max" \
  --exclude=".x_skill.yaml" \
  -C ".claude/skills/ui-ux-pro-max/"
```

### Batch install multiple skills

```bash
# Install multiple skills at once
for skill in "skill-1" "skill-2" "skill-3"; do
  node scripts/install-skill.mjs "$skill" --agent claude
done
```

## Contributing

If you encounter issues with the installation process, please [open an issue](https://github.com/xue1213888/skills-repo/issues).
