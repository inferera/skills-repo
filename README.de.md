# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Eine offene, von der Community verwaltete Skill-Registry fuer KI-Coding-Agenten. Durchsuchen, installieren und teilen Sie wiederverwendbare Skills fuer [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) und [Antigravity](https://antigravity.ai).

## Skill einreichen

1. Hosten Sie Ihren Skill in einem oeffentlichen GitHub-Repository mit einer `SKILL.md`-Datei.
2. Besuchen Sie die Registry-Website und nutzen Sie die **Import**-Seite zum Einreichen.
3. Ein Maintainer prueft und genehmigt den Import.

## Repository-Struktur

```
skills/          Skill-Metadaten (.x_skill.yaml) und Kategoriedefinitionen
schemas/         JSON Schemas zur Validierung
scripts/         Build-, Sync- und Validierungsskripte
cli/             CLI-Tool (aiskill)
site/            Next.js-Website (statischer Export)
config/          Globale Konfiguration (registry.yaml)
registry/        Generierte Registry-Indizes (nicht manuell bearbeiten)
.github/         CI/CD-Workflows (Validierung, Deployment, Sync)
```

## Entwicklung

```bash
npm install                  # Abhaengigkeiten installieren
npm run validate             # Alle Skill-Metadaten validieren
npm run build:registry       # Skill-Dateien synchronisieren und Registry erstellen
npm run dev:site             # Registry erstellen und Entwicklungsserver starten
npm run check:registry       # Pruefen, ob die Registry aktuell ist
```

## Lizenz

[MIT](./LICENSE)
