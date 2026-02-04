# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Un registre de competences ouvert et maintenu par la communaute pour les agents de programmation IA. Parcourez, installez et partagez des competences reutilisables compatibles avec [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) et [Antigravity](https://antigravity.ai).

## Soumettre une competence

1. Hebergez votre competence dans un depot GitHub public contenant un fichier `SKILL.md`.
2. Rendez-vous sur le site du registre et utilisez la page **Import** pour soumettre.
3. Un mainteneur examinera et approuvera l'importation.

## Structure du depot

```
skills/          Metadonnees des competences (.x_skill.yaml) et definitions de categories
schemas/         JSON Schemas pour la validation
scripts/         Scripts de construction, synchronisation et validation
cli/             Outil CLI (aiskill)
site/            Site web Next.js (export statique)
config/          Configuration globale (registry.yaml)
registry/        Index de registre generes (ne pas modifier manuellement)
.github/         Workflows CI/CD (validation, deploiement, synchronisation)
```

## Developpement

```bash
npm install                  # Installer les dependances
npm run validate             # Valider toutes les metadonnees des competences
npm run build:registry       # Synchroniser les fichiers et construire le registre
npm run dev:site             # Construire le registre et demarrer le serveur de developpement
npm run check:registry       # Verifier que le registre est a jour
```

## Licence

[MIT](./LICENSE)
