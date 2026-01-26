# scripts/

Build and validation utilities live here.

Implemented:

- `scripts/build-registry.mjs`: scan `skills/**/.x_skill.yaml` + `SKILL.md` and generate:
  - `registry/*.json`
  - `site/public/registry/*.json`
- `scripts/validate.mjs`: validate skill layout + schema + unique ids
