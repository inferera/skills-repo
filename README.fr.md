# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Un registre de compétences ouvert et maintenu par la communauté pour les agents de programmation IA. Parcourez, installez et partagez des compétences réutilisables compatibles avec [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) et [Antigravity](https://antigravity.ai).

## Soumettre une compétence

1. Hébergez votre compétence dans un dépôt GitHub public contenant un fichier `SKILL.md`.
2. Rendez-vous sur le site du registre et utilisez la page **Import** pour soumettre.
3. Un mainteneur examinera et approuvera l'importation.

## Structure du dépôt

```
skills/          Métadonnées des compétences (.x_skill.yaml) et définitions de catégories
schemas/         JSON Schemas pour la validation
scripts/         Scripts de construction, synchronisation et validation
cli/             Outil CLI (aiskill)
site/            Site web Next.js (export statique)
config/          Configuration globale (registry.yaml)
registry/        Index de registre générés (ne pas modifier manuellement)
.github/         Workflows CI/CD (validation, déploiement, synchronisation)
```

## Développement

```bash
npm install                  # Installer les dépendances
npm run validate             # Valider toutes les métadonnées des compétences
npm run build:registry       # Synchroniser les fichiers et construire le registre
npm run dev:site             # Construire le registre et démarrer le serveur de développement
npm run check:registry       # Vérifier que le registre est à jour
```

## Licence

[MIT](./LICENSE)
