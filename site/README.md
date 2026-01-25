# site/

Static site for browsing and importing skills.

Planned (RFC-0001):

- Next.js (static export) site that reads `registry/*.json` during build
- Routes: `/`, `/categories`, `/c/<category>/<subcategory>`, `/s/<skill-id>`, `/import`
- Client-side offline search and filtering

Local dev (after dependencies are installed):

1) From repo root: `npm run build:registry`
2) From repo root: `npm --prefix site install`
3) From repo root: `npm --prefix site run dev`
