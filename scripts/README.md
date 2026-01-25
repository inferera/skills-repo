# scripts/

Build and validation utilities live here.

Planned (RFC-0001):

- `build-registry`: scan `skills/**/skill.yaml` + `SKILL.md` and generate `registry/*.json`
- `validate`: enforce path conventions, required files, unique ids, and schema validation

Implemented:

- `scripts/build-registry.mjs`
- `scripts/validate.mjs`
