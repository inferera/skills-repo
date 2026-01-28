// scripts/build-registry.mjs (v2)
import fs from "node:fs/promises";
import { buildSearchDocs, loadCategoriesFromRepo, scanSkills, writeJson } from "./lib/registry.mjs";
import { loadConfig } from "./lib/config.mjs";

const generatedAt = new Date().toISOString();

console.log('🔨 Building registry...\n');

// Load configuration
const config = await loadConfig();

// Scan skills
console.log('📦 Scanning skills...');
let { skills, errors } = await scanSkills({ includeFiles: true, includeSummary: true, config });

if (errors.length > 0) {
  console.error('\n❌ Validation errors:\n');
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log(`  ✓ Found ${skills.length} skills\n`);

// Load categories
console.log('📂 Loading categories...');
let categories = await loadCategoriesFromRepo(skills, config);
console.log(`  ✓ Found ${categories.length} categories\n`);

// Build registry index
let index = {
  specVersion: 2,  // v2: flat categories
  generatedAt,
  skills
};

let categoriesJson = {
  specVersion: 2,
  generatedAt,
  categories
};

let searchIndex = {
  specVersion: 2,
  generatedAt,
  docs: buildSearchDocs(skills)
};

// Write canonical outputs (CLI + CI)
console.log('💾 Writing registry files...');
await writeJson("registry/index.json", index);
await writeJson("registry/categories.json", categoriesJson);
await writeJson("registry/search-index.json", searchIndex);
console.log('  ✓ registry/index.json');
console.log('  ✓ registry/categories.json');
console.log('  ✓ registry/search-index.json');

// Copy to site public assets
console.log('\n📋 Copying to site/public/registry/...');
await fs.mkdir("site/public/registry", { recursive: true });
await writeJson("site/public/registry/index.json", index);
await writeJson("site/public/registry/categories.json", categoriesJson);
await writeJson("site/public/registry/search-index.json", searchIndex);

try {
  await fs.copyFile("registry/agents.json", "site/public/registry/agents.json");
  console.log('  ✓ agents.json (copied)');
} catch {
  // Optional file
}

// Generate SEO assets (if SITE_URL is set)
if (process.env.SITE_URL) {
  console.log('\n🔍 Generating SEO assets...');
  let base = process.env.SITE_URL.replace(/\/+$/, "");
  let urls = [
    `${base}/`,
    `${base}/categories/`,
    // v2: flat categories (no subcategories)
    ...categories.map((c) => `${base}/c/${c.id}/`),
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
  console.log('  ✓ sitemap.xml');
  console.log('  ✓ robots.txt');
}

console.log(`\n✅ Registry build complete!\n`);
console.log(`   Skills: ${skills.length}`);
console.log(`   Categories: ${categories.length}`);
console.log(`   Search docs: ${searchIndex.docs.length}\n`);
