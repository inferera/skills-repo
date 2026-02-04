# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

An open, community-maintained skill registry for AI coding agents. Browse, install, and share reusable skills across [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai), and [Antigravity](https://antigravity.ai).

## Submit a Skill

1. Host your skill in a public GitHub repository with a `SKILL.md` file.
2. Go to the registry website and use the **Import** page to submit.
3. A maintainer will review and approve the import.

## Repository Structure

```
skills/          Skill metadata (.x_skill.yaml) and category definitions
schemas/         JSON Schemas for validation
scripts/         Build, sync, and validation scripts
cli/             CLI tool (aiskill)
site/            Next.js website (static export)
config/          Global configuration (registry.yaml)
registry/        Generated registry indexes (do not edit manually)
.github/         CI/CD workflows (validate, deploy, sync)
```

## Development

```bash
npm install                  # Install dependencies
npm run validate             # Validate all skill metadata
npm run build:registry       # Sync skill files and build registry
npm run dev:site             # Build registry and start dev server
npm run check:registry       # Verify registry is up to date
```

## License

[MIT](./LICENSE)
