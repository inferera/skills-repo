import { HomePageClient } from "./HomePageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export default async function HomePage() {
  const index = await loadRegistryIndex();
  const categories = await loadRegistryCategories();

  return <HomePageClient index={index} categories={categories} />;
}
