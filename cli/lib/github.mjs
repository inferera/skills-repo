export function parseGitHubRepoSlug(registryUrl) {
  if (typeof registryUrl !== "string" || !registryUrl) {
    throw new Error("Registry URL is required");
  }

  let normalized;
  try {
    normalized = new URL(registryUrl);
  } catch {
    throw new Error(`Invalid registry URL: ${registryUrl}`);
  }

  if (normalized.hostname !== "github.com") {
    throw new Error(`Only github.com is supported for now. Got: ${normalized.hostname}`);
  }

  const parts = normalized.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2) throw new Error(`Invalid GitHub repo URL: ${registryUrl}`);

  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) throw new Error(`Invalid GitHub repo URL: ${registryUrl}`);

  const VALID_SLUG = /^[a-zA-Z0-9._-]+$/;
  if (!VALID_SLUG.test(owner)) throw new Error(`Invalid GitHub owner: ${owner}`);
  if (!VALID_SLUG.test(repo)) throw new Error(`Invalid GitHub repo name: ${repo}`);

  return { owner, repo };
}

export function getCodeloadTarballUrl({ owner, repo, ref }) {
  if (!owner || !repo || !ref) throw new Error("owner/repo/ref required");
  return `https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(ref)}`;
}

export function getArchiveRootDir({ repo, ref }) {
  const safeRef = String(ref).replaceAll("/", "-");
  return `${repo}-${safeRef}`;
}

