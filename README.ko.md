# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

AI 코딩 에이전트를 위한 개방적인 커뮤니티 관리 스킬 레지스트리입니다. [Claude Code](https://claude.ai), [Cursor](https://cursor.com), [Codex](https://openai.com/codex), [OpenCode](https://opencode.ai), [Antigravity](https://antigravity.ai)에서 재사용 가능한 스킬을 검색, 설치, 공유할 수 있습니다.

## 스킬 제출

1. `SKILL.md` 파일이 포함된 공개 GitHub 리포지토리에 스킬을 호스팅합니다.
2. 레지스트리 웹사이트의 **Import** 페이지에서 제출합니다.
3. 관리자 승인 후 자동으로 가져옵니다.

## 리포지토리 구조

```
skills/          스킬 메타데이터 (.x_skill.yaml) 및 카테고리 정의
schemas/         유효성 검사용 JSON Schema
scripts/         빌드, 동기화, 유효성 검사 스크립트
cli/             CLI 도구 (aiskill)
site/            Next.js 웹사이트 (정적 내보내기)
config/          전역 설정 (registry.yaml)
registry/        생성된 레지스트리 인덱스 (수동 편집 금지)
.github/         CI/CD 워크플로우 (유효성 검사, 배포, 동기화)
```

## 개발

```bash
npm install                  # 의존성 설치
npm run validate             # 모든 스킬 메타데이터 검증
npm run build:registry       # 스킬 파일 동기화 및 레지스트리 빌드
npm run dev:site             # 레지스트리 빌드 및 개발 서버 시작
npm run check:registry       # 레지스트리 최신 상태 확인
```

## 라이선스

[MIT](./LICENSE)
