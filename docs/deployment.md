# Deployment (GitHub Pages + Vercel)

The website lives in `site/` and is built as a **static export** (`output: "export"`). No server runtime is required.

## GitHub Pages (recommended for forks)

This repo includes `.github/workflows/deploy.yml` which:

- builds `registry/*.json`
- builds the Next.js static site into `site/out`
- deploys `site/out` to GitHub Pages

### 1) Enable Pages

GitHub → Settings → Pages:

- Source: **GitHub Actions**

### 2) Configure variables (optional)

GitHub → Settings → Secrets and variables → Actions → Variables:

- `SITE_URL`: public base URL (used to generate `sitemap.xml` and `robots.txt`)
- `SITE_BASE_PATH`: for project pages, usually your repo name; set to `ROOT` for empty basePath

The workflow will auto-detect defaults for user/org pages vs project pages.

## Vercel

You can deploy the static export to Vercel.

### Required settings

- Build command (repo root):
  - `npm ci && npm run build:site`
- Output directory:
  - `site/out`

### Environment variables

Set these in Vercel Project → Settings → Environment Variables:

- `NEXT_PUBLIC_REPO_SLUG` (required): `OWNER/REPO` of your registry repo
- `NEXT_PUBLIC_REPO_REF` (optional): `main` (or a tag/branch)
- `SITE_URL` (recommended): your deployed URL (for sitemap/robots during build)
- `SITE_BASE_PATH` (usually empty on Vercel)

## Notes

- When `SITE_BASE_PATH` is set (GitHub Pages project sites), the Next.js config applies `basePath` + `assetPrefix`.
- The registry JSON files in `registry/` are part of the distribution contract (CLI and site builds rely on them).

