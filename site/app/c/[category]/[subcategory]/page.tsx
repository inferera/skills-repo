import type { Metadata } from "next";

import { CategoryPageClient } from "./CategoryPageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export const dynamicParams = false;

export async function generateStaticParams() {
  const cats = await loadRegistryCategories();
  return cats.categories.flatMap((c) => c.subcategories.map((s) => ({ category: c.id, subcategory: s.id })));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ category: string; subcategory: string }>;
}): Promise<Metadata> {
  const { category, subcategory } = await params;
  const cats = await loadRegistryCategories();
  const cat = cats.categories.find((c) => c.id === category);
  const sub = cat?.subcategories.find((s) => s.id === subcategory);

  const title = sub ? `${cat?.title} / ${sub.title}` : `${category} / ${subcategory}`;
  return {
    title,
    description: `Browse skills in ${title}.`
  };
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  const index = await loadRegistryIndex();
  const cats = await loadRegistryCategories();

  const cat = cats.categories.find((c) => c.id === category) ?? null;
  const sub = cat?.subcategories.find((s) => s.id === subcategory) ?? null;

  const skills = index.skills
    .filter((s) => s.category === category && s.subcategory === subcategory)
    .sort((a, b) => a.title.localeCompare(b.title));

  return <CategoryPageClient category={category} subcategory={subcategory} cat={cat} sub={sub} skills={skills} />;
}
