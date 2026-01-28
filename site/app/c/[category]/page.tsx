import type { Metadata } from "next";

import { CategoryPageClient } from "./CategoryPageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";
import { getLocalizedText, DEFAULT_LOCALE } from "@/lib/i18n";

export const dynamicParams = false;

export async function generateStaticParams() {
  const cats = await loadRegistryCategories();
  // v2: flat categories (no subcategories)
  return cats.categories.map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cats = await loadRegistryCategories();
  const cat = cats.categories.find((c) => c.id === category);

  const title = cat ? getLocalizedText(cat.title, DEFAULT_LOCALE) : category;
  const description = cat?.description
    ? getLocalizedText(cat.description, DEFAULT_LOCALE)
    : `Browse skills in ${title}.`;

  return {
    title,
    description
  };
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const index = await loadRegistryIndex();
  const cats = await loadRegistryCategories();

  const cat = cats.categories.find((c) => c.id === category) ?? null;

  // v2: filter by category only
  const skills = index.skills
    .filter((s) => s.category === category)
    .sort((a, b) => a.title.localeCompare(b.title));

  return <CategoryPageClient category={category} cat={cat} skills={skills} />;
}
