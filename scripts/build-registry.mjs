import fs from "node:fs/promises";

import { buildSearchDocs, loadCategoriesFromRepo, scanSkills, writeJson } from "./lib/registry.mjs";

let generatedAt = new Date().toISOString();

let { skills, errors } = await scanSkills({ includeFiles: true, includeSummary: true });
if (errors.length > 0) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

let categories = await loadCategoriesFromRepo(skills);

let index = {
  specVersion: 1,
  generatedAt,
  skills
};

let categoriesJson = {
  specVersion: 1,
  generatedAt,
  categories
};

let searchIndex = {
  specVersion: 1,
  generatedAt,
  docs: buildSearchDocs(skills)
};

// Canonical build outputs (tooling + CI).
await writeJson("registry/index.json", index);
await writeJson("registry/categories.json", categoriesJson);
await writeJson("registry/search-index.json", searchIndex);

// Site consumes these as static public assets.
await fs.mkdir("site/public/registry", { recursive: true });
await writeJson("site/public/registry/index.json", index);
await writeJson("site/public/registry/categories.json", categoriesJson);
await writeJson("site/public/registry/search-index.json", searchIndex);

// SEO assets (optional; emitted when SITE_URL is configured in CI).
if (process.env.SITE_URL) {
  let base = process.env.SITE_URL.replace(/\/+$/, "");
  let urls = [
    `${base}/`,
    `${base}/categories/`,
    ...categories.flatMap((c) => c.subcategories.map((s) => `${base}/c/${c.id}/${s.id}/`)),
    ...skills.map((s) => `${base}/s/${s.id}/`)
  ];

  let xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((loc) => `  <url><loc>${loc}</loc><lastmod>${generatedAt}</lastmod></url>`)
      .join("\n") +
    `\n</urlset>\n`;

  await fs.mkdir("site/public", { recursive: true });
  await fs.writeFile("site/public/sitemap.xml", xml, "utf8");
  await fs.writeFile("site/public/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, "utf8");
}

console.log(`OK: wrote registry (skills=${skills.length})`);
