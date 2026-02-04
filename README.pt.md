# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Um registro aberto de habilidades mantido pela comunidade para agentes de programação com IA. Navegue, instale e compartilhe habilidades reutilizáveis compatíveis com [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) e [Antigravity](https://antigravity.ai).

## Enviar uma habilidade

1. Hospede sua habilidade em um repositório público do GitHub com um arquivo `SKILL.md`.
2. Acesse o site do registro e use a página **Import** para enviar.
3. Um mantenedor revisará e aprovará a importação.

## Estrutura do repositório

```
skills/          Metadados de habilidades (.x_skill.yaml) e definições de categorias
schemas/         JSON Schemas para validação
scripts/         Scripts de construção, sincronização e validação
cli/             Ferramenta CLI (aiskill)
site/            Site Next.js (exportação estática)
config/          Configuração global (registry.yaml)
registry/        Índices de registro gerados (não editar manualmente)
.github/         Workflows CI/CD (validação, implantação, sincronização)
```

## Desenvolvimento

```bash
npm install                  # Instalar dependências
npm run validate             # Validar todos os metadados de habilidades
npm run build:registry       # Sincronizar arquivos e construir o registro
npm run dev:site             # Construir registro e iniciar servidor de desenvolvimento
npm run check:registry       # Verificar se o registro está atualizado
```

## Licença

[MIT](./LICENSE)
