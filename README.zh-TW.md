# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

一個開放的、由社群維護的 AI 程式設計代理技能註冊表。支援瀏覽、安裝和分享可複用的技能，相容 [Claude Code](https://claude.ai)、[Cursor](https://cursor.com)、[Codex](https://openai.com/codex)、[OpenCode](https://opencode.ai) 和 [Antigravity](https://antigravity.ai)。

## 提交技能

1. 將你的技能託管在公開的 GitHub 儲存庫中，確保包含 `SKILL.md` 檔案。
2. 前往註冊表網站，使用 **Import** 頁面提交。
3. 維護者審核通過後將自動匯入。

## 儲存庫結構

```
skills/          技能中繼資料 (.x_skill.yaml) 和分類定義
schemas/         用於驗證的 JSON Schema
scripts/         建置、同步和驗證指令碼
cli/             CLI 工具 (aiskill)
site/            Next.js 網站 (靜態匯出)
config/          全域設定 (registry.yaml)
registry/        產生的註冊表索引 (請勿手動編輯)
.github/         CI/CD 工作流程 (驗證、部署、同步)
```

## 開發

```bash
npm install                  # 安裝依賴
npm run validate             # 驗證所有技能中繼資料
npm run build:registry       # 同步技能檔案並建置註冊表
npm run dev:site             # 建置註冊表並啟動開發伺服器
npm run check:registry       # 確認註冊表是否為最新
```

## 授權條款

[MIT](./LICENSE)
