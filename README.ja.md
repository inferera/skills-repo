# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

AI コーディングエージェント向けの、オープンなコミュニティ管理型スキルレジストリです。[Claude Code](https://claude.ai)、[Cursor](https://cursor.com)、[Codex](https://openai.com/codex)、[OpenCode](https://opencode.ai)、[Antigravity](https://antigravity.ai) に対応した再利用可能なスキルを閲覧、インストール、共有できます。

## スキルの提出

1. `SKILL.md` ファイルを含む公開 GitHub リポジトリにスキルをホストします。
2. レジストリのウェブサイトにアクセスし、**Import** ページから提出します。
3. メンテナーの承認後、自動的にインポートされます。

## リポジトリ構成

```
skills/          スキルメタデータ (.x_skill.yaml) とカテゴリ定義
schemas/         バリデーション用 JSON Schema
scripts/         ビルド、同期、バリデーションスクリプト
cli/             CLI ツール (aiskill)
site/            Next.js ウェブサイト (静的エクスポート)
config/          グローバル設定 (registry.yaml)
registry/        生成されたレジストリインデックス (手動編集不可)
.github/         CI/CD ワークフロー (バリデーション、デプロイ、同期)
```

## 開発

```bash
npm install                  # 依存関係をインストール
npm run validate             # すべてのスキルメタデータを検証
npm run build:registry       # スキルファイルを同期しレジストリをビルド
npm run dev:site             # レジストリをビルドし開発サーバーを起動
npm run check:registry       # レジストリが最新か確認
```

## ライセンス

[MIT](./LICENSE)
