import { CategoriesPageClient } from "./CategoriesPageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export const dynamic = "error";

export const metadata = {
  title: "Categories"
};

export default async function CategoriesPage() {
  const cats = await loadRegistryCategories();
  const index = await loadRegistryIndex();

  const counts: Record<string, number> = {};
  for (const s of index.skills) {
    const key = `${s.category}/${s.subcategory}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return <CategoriesPageClient cats={cats} counts={counts} />;
}
