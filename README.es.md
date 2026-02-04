# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Un registro de habilidades abierto y mantenido por la comunidad para agentes de programación con IA. Explora, instala y comparte habilidades reutilizables compatibles con [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) y [Antigravity](https://antigravity.ai).

## Enviar una habilidad

1. Aloja tu habilidad en un repositorio público de GitHub con un archivo `SKILL.md`.
2. Visita el sitio web del registro y usa la página **Import** para enviarla.
3. Un mantenedor revisará y aprobará la importación.

## Estructura del repositorio

```
skills/          Metadatos de habilidades (.x_skill.yaml) y definiciones de categorías
schemas/         JSON Schemas para validación
scripts/         Scripts de construcción, sincronización y validación
cli/             Herramienta CLI (aiskill)
site/            Sitio web Next.js (exportación estática)
config/          Configuración global (registry.yaml)
registry/        Índices de registro generados (no editar manualmente)
.github/         Flujos de trabajo CI/CD (validación, despliegue, sincronización)
```

## Desarrollo

```bash
npm install                  # Instalar dependencias
npm run validate             # Validar todos los metadatos de habilidades
npm run build:registry       # Sincronizar archivos y construir el registro
npm run dev:site             # Construir registro e iniciar servidor de desarrollo
npm run check:registry       # Verificar que el registro está actualizado
```

## Licencia

[MIT](./LICENSE)
