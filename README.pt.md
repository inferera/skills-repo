# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Um registro aberto de habilidades mantido pela comunidade para agentes de programacao com IA. Navegue, instale e compartilhe habilidades reutilizaveis compativeis com [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) e [Antigravity](https://antigravity.ai).

## Enviar uma habilidade

1. Hospede sua habilidade em um repositorio publico do GitHub com um arquivo `SKILL.md`.
2. Acesse o site do registro e use a pagina **Import** para enviar.
3. Um mantenedor revisara e aprovara a importacao.

## Estrutura do repositorio

```
skills/          Metadados de habilidades (.x_skill.yaml) e definicoes de categorias
schemas/         JSON Schemas para validacao
scripts/         Scripts de construcao, sincronizacao e validacao
cli/             Ferramenta CLI (aiskill)
site/            Site Next.js (exportacao estatica)
config/          Configuracao global (registry.yaml)
registry/        Indices de registro gerados (nao editar manualmente)
.github/         Workflows CI/CD (validacao, implantacao, sincronizacao)
```

## Desenvolvimento

```bash
npm install                  # Instalar dependencias
npm run validate             # Validar todos os metadados de habilidades
npm run build:registry       # Sincronizar arquivos e construir o registro
npm run dev:site             # Construir registro e iniciar servidor de desenvolvimento
npm run check:registry       # Verificar se o registro esta atualizado
```

## Licenca

[MIT](./LICENSE)
