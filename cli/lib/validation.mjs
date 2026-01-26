export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSlug(label, value) {
  if (typeof value !== "string" || !SLUG_RE.test(value)) {
    throw new Error(`${label} must match ${SLUG_RE}: ${String(value)}`);
  }
}

export function splitPath(p) {
  return String(p).replaceAll("\\", "/").split("/").filter(Boolean);
}

