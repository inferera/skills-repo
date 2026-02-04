# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

Открытый реестр навыков для ИИ-агентов программирования, поддерживаемый сообществом. Просматривайте, устанавливайте и делитесь навыками для [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai) и [Antigravity](https://antigravity.ai).

## Отправка навыка

1. Разместите навык в открытом репозитории GitHub с файлом `SKILL.md`.
2. Перейдите на сайт реестра и используйте страницу **Import** для отправки.
3. Мейнтейнер проверит и одобрит импорт.

## Структура репозитория

```
skills/          Метаданные навыков (.x_skill.yaml) и определения категорий
schemas/         JSON Schema для валидации
scripts/         Скрипты сборки, синхронизации и валидации
cli/             CLI-инструмент (aiskill)
site/            Сайт на Next.js (статический экспорт)
config/          Глобальная конфигурация (registry.yaml)
registry/        Сгенерированные индексы реестра (не редактировать вручную)
.github/         CI/CD-потоки (валидация, развёртывание, синхронизация)
```

## Разработка

```bash
npm install                  # Установить зависимости
npm run validate             # Проверить все метаданные навыков
npm run build:registry       # Синхронизировать файлы и собрать реестр
npm run dev:site             # Собрать реестр и запустить сервер разработки
npm run check:registry       # Проверить актуальность реестра
```

## Лицензия

[MIT](./LICENSE)
